/**
 * Reconcile the evidence log against the chain.
 *
 * Two records of the same events, no shared clock, either may be stale:
 *
 *   evidence/sends.jsonl   what this program says it did
 *   the chain              what actually happened
 *
 * For every log line, fetch the transaction and its receipt and compare who,
 * to whom, how much, and which nonce. Then, per sender, compare the nonces
 * the log knows about with the chain's count: a nonce the chain has used but
 * the log never recorded is a send that happened without evidence. That is
 * the case a log cannot catch by checking only its own lines.
 *
 * Finally, follow the money (Stage 8). Every mined transaction cost a fee,
 * failed ones included. The wallet's balance just before its first logged
 * transaction, minus every fee, minus every USDC sent to someone else, must
 * equal its balance now. Whatever is left over moved without being logged:
 * a deposit, or a send this program never recorded.
 *
 * Read-only. The log is never edited; the chain is never written to.
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { parseArgs } from "node:util";

import * as arc from "./arc.ts";
import { proveEffect } from "./events.ts";
import { ARC_USDC_TOKEN, fromUnits, fromWei, normalise, toUnits, toWei } from "./guard.ts";
import { decodeIntent } from "./intent.ts";
import { LOG_FILE } from "./paths.ts";


/**
 * One send line of evidence/sends.jsonl, as send.ts writes it.
 *
 * Native payments carry amount_usdc. Token calls (from Stage 5) carry kind,
 * asset, token, decimals and amount instead; `to` is the real recipient (or
 * the spender, for an approval), not the token contract. A line with no
 * `kind` is a native payment.
 */
export type LogRecord = {
  ts: number;
  from: string;
  to: string;
  broadcast: boolean;
  amount_usdc?: string;
  kind?: "native" | "transfer" | "approve" | "unknown";
  asset?: string;
  token?: string;
  decimals?: number;
  amount?: string;
  nonce?: number;
  tx_hash?: string;
  refused_because?: string;
};

/**
 * What send.ts appends once a receipt arrives (from Stage 8): the outcome
 * and the fee it cost. A separate line, because the log is append-only and
 * the send line was already written before the receipt existed.
 */
export type OutcomeRecord = {
  type: "outcome";
  ts: number;
  from: string;
  tx_hash: string;
  nonce: number;
  status: number;
  block: number | null;
  gas_used: number;
  fee_usdc: string;
};

/** A log record plus its line number, so a report can point at the line. */
export type Entry = { line: number; record: LogRecord };
export type OutcomeEntry = { line: number; record: OutcomeRecord };

const isOutcome = (e: Entry | OutcomeEntry): e is OutcomeEntry =>
  (e.record as { type?: string }).type === "outcome";

/** The amount and asset a line claims, for display. */
export function claimed(r: LogRecord): { amount: string; asset: string } {
  return (r.kind ?? "native") === "native"
    ? { amount: r.amount_usdc ?? "?", asset: "USDC" }
    : { amount: r.amount ?? "?", asset: r.asset ?? "?" };
}

/** The questions reconcile asks the chain. arc.ts answers them live. */
export type Chain = {
  transaction(txHash: string): Promise<arc.ChainTx | null>;
  receipt(txHash: string): Promise<arc.Receipt | null>;
  nonce(address: string): Promise<number | null>;
  /** Native balance at a past block. null if the node keeps no history. */
  balanceAt(address: string, block: bigint | "latest"): Promise<bigint | null>;
};

export type Status =
  | "MATCHED"    // the chain agrees with the log on every field, and it succeeded
  | "DIVERGENT"  // the chain disagrees with the log; problems says how
  | "PENDING"    // the chain knows the transaction but has not mined it yet
  | "MISSING"    // the chain has never seen this hash
  | "REVERTED"   // mined, but failed: no money moved, the fee was still paid
  | "REFUSED";   // the guard said no; nothing was broadcast, nothing to check

export type Row = {
  entry: Entry;
  status: Status;
  problems: string[];
  block: bigint | null;
  fee: bigint | null;       // gasUsed × effectiveGasPrice, in wei, once mined
  outflow: bigint;          // USDC (wei) the chain says left this wallet to someone else
};

export type BalanceCheck = {
  startBlock: bigint;
  start: bigint;            // just before the first logged transaction
  end: bigint;              // now
  fees: bigint;
  outflow: bigint;
  unexplained: bigint;      // (end - start) + fees + outflow; 0 when the log explains everything
};

export type SenderCheck = {
  address: string;
  chainNonce: number;
  gaps: number[];           // used on chain, absent from the log
  duplicates: number[];     // logged more than once
  fees: bigint;             // every fee this wallet paid for logged transactions
  balance: BalanceCheck | null;   // null: nothing mined yet, or no balance history
};

export type Report = { rows: Row[]; senders: SenderCheck[]; orphans: OutcomeEntry[]; ok: boolean };

export function readLog(logFile = LOG_FILE): (Entry | OutcomeEntry)[] {
  return readFileSync(logFile, "utf8")
    .split("\n")
    .map((text, i) => ({ text, line: i + 1 }))
    .filter(({ text }) => text.trim() !== "")
    .map(({ text, line }) => ({ line, record: JSON.parse(text) }));
}

/** Compare one send line, and any outcome line for it, with what the chain recorded. */
async function checkRow(entry: Entry, outcomes: OutcomeEntry[], chain: Chain): Promise<Row> {
  const r = entry.record;
  const row = (status: Status, problems: string[] = [], block: bigint | null = null, fee: bigint | null = null, outflow = 0n): Row => ({
    entry, status, problems, block, fee, outflow,
  });

  if (!r.broadcast) {
    return row("REFUSED");
  }
  if (!r.tx_hash) {
    return row("DIVERGENT", ["log says broadcast but has no tx_hash"]);
  }

  const tx = await chain.transaction(r.tx_hash);
  if (tx === null) {
    return row("MISSING", ["the chain has never seen this hash"]);
  }

  const rcpt = await chain.receipt(r.tx_hash);
  const block = rcpt ? arc.toInt(rcpt.blockNumber) : null;
  const chainStatus = rcpt ? arc.toInt(rcpt.status) : null;
  const gasUsed = rcpt ? arc.toInt(rcpt.gasUsed) : null;
  const gasPrice = rcpt ? arc.toInt(rcpt.effectiveGasPrice) : null;
  const fee = gasUsed !== null && gasPrice !== null ? gasUsed * gasPrice : null;

  const problems: string[] = [];
  const sender = normalise(r.from);

  const chainFrom = normalise(tx.from);
  if (sender !== chainFrom) {
    problems.push(`from: log ${sender ?? r.from}, chain ${chainFrom ?? tx.from}`);
  }

  const kind = r.kind ?? "native";
  let outflow = 0n;   // what the CHAIN says left this wallet, if it succeeded

  if (kind === "native") {
    const logTo = normalise(r.to);
    const chainTo = normalise(tx.to);
    if (logTo !== chainTo) {
      problems.push(`to: log ${logTo ?? r.to}, chain ${chainTo ?? "(none)"}`);
    }

    const chainValue = BigInt(tx.value);
    let logValue: bigint | null = null;
    try {
      logValue = toWei(r.amount_usdc ?? "");
    } catch {
      // An unreadable amount is reported below, never guessed at.
    }
    if (logValue !== chainValue) {
      problems.push(`amount: log ${r.amount_usdc} USDC, chain ${fromWei(chainValue)} USDC`);
    }
    if (tx.input !== undefined && tx.input !== "0x") {
      problems.push("call: log says a plain payment, chain shows a contract call");
    }
    if (chainTo !== chainFrom) {
      outflow = chainValue;
    }
  } else if (tx.to === null) {
    problems.push("call: chain shows a contract creation, not a token call");
  } else {
    // A token call: the chain's `to` is the TOKEN, and the real recipient and
    // amount are inside the calldata. Decode it, exactly as the guard did.
    if (normalise(r.token) !== normalise(tx.to)) {
      problems.push(`token: log ${normalise(r.token) ?? r.token}, chain ${normalise(tx.to)}`);
    }
    const onChain = decodeIntent({
      to: tx.to as `0x${string}`,
      value: BigInt(tx.value),
      data: tx.input as `0x${string}`,
    });
    if (onChain.kind !== kind) {
      problems.push(`call: log ${kind}, chain ${onChain.kind}`);
    } else if (onChain.kind === "transfer" || onChain.kind === "approve") {
      const counterparty = onChain.kind === "transfer" ? onChain.to : onChain.spender;
      if (normalise(r.to) !== normalise(counterparty)) {
        problems.push(`to: log ${normalise(r.to) ?? r.to}, chain ${normalise(counterparty)}`);
      }
      let logUnits: bigint | null = null;
      try {
        logUnits = toUnits(r.amount ?? "", r.decimals ?? -1);
      } catch {
        // Unreadable amount or decimals: reported below, never guessed at.
      }
      if (logUnits !== onChain.amount) {
        const chainAmount = r.decimals === undefined ? `${onChain.amount} base units` : fromUnits(onChain.amount, r.decimals);
        problems.push(`amount: log ${r.amount} ${r.asset}, chain ${chainAmount} ${r.asset}`);
      }
      // USDC moved through its token contract leaves the native balance too.
      if (onChain.kind === "transfer" && normalise(tx.to) === ARC_USDC_TOKEN && normalise(onChain.to) !== chainFrom) {
        outflow = onChain.amount * 10n ** 12n;
      }
    }
  }

  const chainNonce = Number(BigInt(tx.nonce));
  if (r.nonce !== chainNonce) {
    problems.push(`nonce: log ${r.nonce}, chain ${chainNonce}`);
  }

  // Stage 8: an outcome line must agree with the receipt it claims to record.
  if (outcomes.length > 1) {
    problems.push(`outcome: recorded ${outcomes.length} times (lines ${outcomes.map((o) => o.line).join(", ")})`);
  }
  for (const { record: o } of outcomes) {
    if (chainStatus !== null && BigInt(o.status) !== chainStatus) {
      problems.push(`outcome: log status ${o.status}, chain ${chainStatus}`);
    }
    if (fee !== null && o.fee_usdc !== fromWei(fee)) {
      problems.push(`fee: log ${o.fee_usdc} USDC, chain ${fromWei(fee)} USDC`);
    }
  }

  const succeeded = chainStatus === 1n;
  if (problems.length > 0) {
    return row("DIVERGENT", problems, block, fee, succeeded ? outflow : 0n);
  }
  if (rcpt === null) {
    return row("PENDING");
  }
  if (!succeeded) {
    return row("REVERTED", [], block, fee);
  }

  // Stage 7: for a token call, status 1 is not enough. The token's own event
  // must show this sender, this counterparty and this amount.
  if ((kind === "transfer" || kind === "approve") && r.decimals !== undefined && r.amount !== undefined) {
    const proof = proveEffect(rcpt.logs ?? [], {
      kind,
      token: r.token ?? "",
      from: r.from,
      to: r.to,
      amount: toUnits(r.amount, r.decimals),
    });
    if (!proof.proven) {
      return row("DIVERGENT", [`events: ${proof.reason}`], block, fee, outflow);
    }
  }
  return row("MATCHED", [], block, fee, outflow);
}

/**
 * Per sender: which nonces the chain has used that the log never recorded,
 * and whether the balance history is explained by the logged transactions.
 */
async function checkSender(address: string, entries: Entry[], rows: Row[], chain: Chain): Promise<SenderCheck> {
  const chainNonce = await chain.nonce(address);
  if (chainNonce === null) {
    throw new Error(`node returned no nonce for ${address}`);
  }

  const seen = new Map<number, number>();
  for (const { record } of entries) {
    if (record.broadcast && record.nonce !== undefined && normalise(record.from) === address) {
      seen.set(record.nonce, (seen.get(record.nonce) ?? 0) + 1);
    }
  }

  const gaps: number[] = [];
  for (let n = 0; n < chainNonce; n++) {
    if (!seen.has(n)) {
      gaps.push(n);
    }
  }
  const duplicates = [...seen].filter(([, count]) => count > 1).map(([n]) => n).sort((a, b) => a - b);

  // Follow the money: every fee and every USDC that left to someone else.
  const mine = rows.filter((r) => normalise(r.entry.record.from) === address);
  const fees = mine.reduce((sum, r) => sum + (r.fee ?? 0n), 0n);
  const outflow = mine.reduce((sum, r) => sum + r.outflow, 0n);

  const blocks = mine.map((r) => r.block).filter((b): b is bigint => b !== null);
  let balance: BalanceCheck | null = null;
  if (blocks.length > 0) {
    const startBlock = blocks.reduce((a, b) => (b < a ? b : a)) - 1n;
    const start = await chain.balanceAt(address, startBlock);
    const end = await chain.balanceAt(address, "latest");
    if (start !== null && end !== null) {
      balance = { startBlock, start, end, fees, outflow, unexplained: end - start + fees + outflow };
    }
  }

  return { address, chainNonce, gaps, duplicates, fees, balance };
}

export async function reconcile(lines: readonly (Entry | OutcomeEntry)[], chain: Chain = arc): Promise<Report> {
  const entries = lines.filter((e): e is Entry => !isOutcome(e));
  const outcomes = lines.filter(isOutcome);

  const byHash = new Map<string, OutcomeEntry[]>();
  for (const o of outcomes) {
    const key = o.record.tx_hash.toLowerCase();
    byHash.set(key, [...(byHash.get(key) ?? []), o]);
  }

  const rows: Row[] = [];
  for (const entry of entries) {
    const mine = entry.record.tx_hash ? (byHash.get(entry.record.tx_hash.toLowerCase()) ?? []) : [];
    rows.push(await checkRow(entry, mine, chain));
  }

  // An outcome for a transaction no send line mentions: the log is inconsistent.
  const sent = new Set(entries.map((e) => e.record.tx_hash?.toLowerCase()).filter(Boolean));
  const orphans = outcomes.filter((o) => !sent.has(o.record.tx_hash.toLowerCase()));

  const addresses = new Set<string>();
  for (const { record } of entries) {
    const a = normalise(record.from);
    if (record.broadcast && a !== null) {
      addresses.add(a);
    }
  }
  const senders: SenderCheck[] = [];
  for (const a of addresses) {
    senders.push(await checkSender(a, entries, rows, chain));
  }

  const ok =
    rows.every((r) => r.status === "MATCHED" || r.status === "REFUSED") &&
    senders.every((s) => s.gaps.length === 0 && s.duplicates.length === 0 && (s.balance?.unexplained ?? 0n) === 0n) &&
    orphans.length === 0;

  return { rows, senders, orphans, ok };
}

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export function formatReport(report: Report): string {
  const out: string[] = [];
  out.push("line  nonce  status      kind      amount          to            fee (USDC)    detail");

  for (const { entry, status, problems, block, fee } of report.rows) {
    const r = entry.record;
    const nonce = r.nonce === undefined ? "-" : String(r.nonce);
    const { amount, asset } = claimed(r);
    const shown = amount.length > 10 ? `${amount.slice(0, 9)}…` : amount;
    let detail = "";
    if (status === "REFUSED") detail = `never broadcast: ${r.refused_because ?? "no reason logged"}`;
    else if (block !== null) detail = `block ${block}`;
    out.push(
      `${String(entry.line).padEnd(5)} ${nonce.padEnd(6)} ${status.padEnd(11)} ` +
        `${(r.kind ?? "native").padEnd(9)} ${`${shown} ${asset}`.padEnd(15)} ${short(r.to).padEnd(13)} ` +
        `${(fee === null ? "-" : (fromWei(fee) ?? "-")).padEnd(13)} ${detail}`,
    );
    for (const p of problems) {
      out.push(`${" ".repeat(25)}↳ ${p}`);
    }
  }

  for (const o of report.orphans) {
    out.push(`line ${o.line}: outcome for ${short(o.record.tx_hash)}, a transaction no line records sending`);
  }

  out.push("");
  for (const s of report.senders) {
    out.push(`sender ${s.address}: chain nonce ${s.chainNonce}`);
    out.push(
      s.gaps.length === 0
        ? "  nonce gaps: none, every transaction on chain is in the log"
        : `  nonce gaps: ${s.gaps.join(", ")} — on chain, NOT in the log`,
    );
    if (s.duplicates.length > 0) {
      out.push(`  logged twice: ${s.duplicates.join(", ")} — at most one of each can be real`);
    }
    out.push(`  fees paid: ${fromWei(s.fees)} USDC`);
    const b = s.balance;
    if (b === null) {
      out.push("  balance: not checked (nothing mined yet, or the node keeps no balance history)");
    } else {
      out.push(`  balance before the first logged transaction (block ${b.startBlock}): ${fromWei(b.start)} USDC`);
      out.push(`  minus fees ${fromWei(b.fees)}, minus sent to others ${fromWei(b.outflow)}: expect ${fromWei(b.start - b.fees - b.outflow)} USDC`);
      out.push(`  balance now: ${fromWei(b.end)} USDC`);
      out.push(
        b.unexplained === 0n
          ? "  unexplained: 0 — every USDC of change is accounted for"
          : `  unexplained: ${fromWei(b.unexplained)} USDC — moved without being logged ` +
              `(${b.unexplained > 0n ? "a deposit, or a refund" : "a send or fee the log never recorded"})`,
      );
    }
  }

  const count = (st: Status) => report.rows.filter((r) => r.status === st).length;
  const gaps = report.senders.reduce((n, s) => n + s.gaps.length, 0);
  out.push("");
  out.push(
    `summary: ${count("MATCHED")} matched, ${count("DIVERGENT")} divergent, ` +
      `${count("PENDING")} pending, ${count("MISSING")} missing, ` +
      `${count("REVERTED")} reverted, ${count("REFUSED")} refused, ${gaps} gaps`,
  );
  out.push(report.ok ? "result: RECONCILED" : "result: NOT RECONCILED");
  return out.join("\n");
}

// Runs only when this file is started directly:
//   npm run reconcile                     checks evidence/sends.jsonl
//   npm run reconcile -- --log some.jsonl checks another file
// Exits with code 1 when the log and the chain do not agree.
if (import.meta.main) {
  const { values: args } = parseArgs({ options: { log: { type: "string" } } });
  const logFile = args.log ?? LOG_FILE;
  const shown = relative(process.cwd(), logFile);
  console.log(
    `reconcile: ${shown.startsWith("..") ? logFile : shown} ` +
      `against Arc testnet (chain ${arc.CHAIN_ID})\n`,
  );
  const report = await reconcile(readLog(logFile));
  console.log(formatReport(report));
  process.exitCode = report.ok ? 0 : 1;
}
