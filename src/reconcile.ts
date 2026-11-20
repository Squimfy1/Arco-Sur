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
 * Read-only. The log is never edited; the chain is never written to.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";

import * as arc from "./arc.ts";
import { fromWei, normalise, toWei } from "./guard.ts";

const ROOT = join(import.meta.dirname, "..");
const LOG_FILE = join(ROOT, "evidence", "sends.jsonl");

/** One line of evidence/sends.jsonl, as send.ts writes it. */
export type LogRecord = {
  ts: number;
  from: string;
  to: string;
  amount_usdc: string;
  broadcast: boolean;
  nonce?: number;
  tx_hash?: string;
  refused_because?: string;
};

/** A log record plus its line number, so a report can point at the line. */
export type Entry = { line: number; record: LogRecord };

/** The three questions reconcile asks the chain. arc.ts answers them live. */
export type Chain = {
  transaction(txHash: string): Promise<arc.ChainTx | null>;
  receipt(txHash: string): Promise<arc.Receipt | null>;
  nonce(address: string): Promise<number | null>;
};

export type Status =
  | "MATCHED"    // the chain agrees with the log on every field, and it succeeded
  | "DIVERGENT"  // the chain disagrees with the log; problems says how
  | "PENDING"    // the chain knows the transaction but has not mined it yet
  | "MISSING"    // the chain has never seen this hash
  | "REVERTED"   // mined, but failed: no money moved, the fee was still paid
  | "REFUSED";   // the guard said no; nothing was broadcast, nothing to check

export type Row = { entry: Entry; status: Status; problems: string[]; block: bigint | null };

export type SenderCheck = {
  address: string;
  chainNonce: number;
  gaps: number[];        // used on chain, absent from the log
  duplicates: number[];  // logged more than once
};

export type Report = { rows: Row[]; senders: SenderCheck[]; ok: boolean };

export function readLog(logFile = LOG_FILE): Entry[] {
  return readFileSync(logFile, "utf8")
    .split("\n")
    .map((text, i) => ({ text, line: i + 1 }))
    .filter(({ text }) => text.trim() !== "")
    .map(({ text, line }) => ({ line, record: JSON.parse(text) as LogRecord }));
}

/** Compare one log line with what the chain recorded for its hash. */
async function checkRow(entry: Entry, chain: Chain): Promise<Row> {
  const r = entry.record;
  const row = (status: Status, problems: string[] = [], block: bigint | null = null): Row => ({
    entry, status, problems, block,
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

  const problems: string[] = [];

  const logFrom = normalise(r.from);
  const chainFrom = normalise(tx.from);
  if (logFrom !== chainFrom) {
    problems.push(`from: log ${logFrom ?? r.from}, chain ${chainFrom ?? tx.from}`);
  }

  const logTo = normalise(r.to);
  const chainTo = normalise(tx.to);
  if (logTo !== chainTo) {
    problems.push(`to: log ${logTo ?? r.to}, chain ${chainTo ?? "(none)"}`);
  }

  const chainValue = BigInt(tx.value);
  let logValue: bigint | null = null;
  try {
    logValue = toWei(r.amount_usdc);
  } catch {
    // An unreadable amount is reported below, never guessed at.
  }
  if (logValue !== chainValue) {
    problems.push(`amount: log ${r.amount_usdc} USDC, chain ${fromWei(chainValue)} USDC`);
  }

  const chainNonce = Number(BigInt(tx.nonce));
  if (r.nonce !== chainNonce) {
    problems.push(`nonce: log ${r.nonce}, chain ${chainNonce}`);
  }

  if (problems.length > 0) {
    return row("DIVERGENT", problems);
  }

  const rcpt = await chain.receipt(r.tx_hash);
  if (rcpt === null) {
    return row("PENDING");
  }
  const block = arc.toInt(rcpt.blockNumber);
  if (arc.toInt(rcpt.status) !== 1n) {
    return row("REVERTED", [], block);
  }
  return row("MATCHED", [], block);
}

/** Per sender: which nonces the chain has used that the log never recorded. */
async function checkSender(address: string, entries: Entry[], chain: Chain): Promise<SenderCheck> {
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

  return { address, chainNonce, gaps, duplicates };
}

export async function reconcile(entries: Entry[], chain: Chain = arc): Promise<Report> {
  const rows: Row[] = [];
  for (const entry of entries) {
    rows.push(await checkRow(entry, chain));
  }

  const addresses = new Set<string>();
  for (const { record } of entries) {
    const a = normalise(record.from);
    if (record.broadcast && a !== null) {
      addresses.add(a);
    }
  }
  const senders: SenderCheck[] = [];
  for (const a of addresses) {
    senders.push(await checkSender(a, entries, chain));
  }

  const ok =
    rows.every((r) => r.status === "MATCHED" || r.status === "REFUSED") &&
    senders.every((s) => s.gaps.length === 0 && s.duplicates.length === 0);

  return { rows, senders, ok };
}

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export function formatReport(report: Report): string {
  const out: string[] = [];
  out.push("line  nonce  status      amount     to            detail");

  for (const { entry, status, problems, block } of report.rows) {
    const r = entry.record;
    const nonce = r.nonce === undefined ? "-" : String(r.nonce);
    let detail = "";
    if (status === "REFUSED") detail = `never broadcast: ${r.refused_because ?? "no reason logged"}`;
    else if (block !== null) detail = `block ${block}`;
    out.push(
      `${String(entry.line).padEnd(5)} ${nonce.padEnd(6)} ${status.padEnd(11)} ` +
        `${r.amount_usdc.padEnd(10)} ${short(r.to).padEnd(13)} ${detail}`,
    );
    for (const p of problems) {
      out.push(`${" ".repeat(25)}↳ ${p}`);
    }
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
