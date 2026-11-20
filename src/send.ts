/**
 * Send USDC or a token on Arc. Decode, guard, sign, broadcast, verify.
 *
 * The order is the whole point:
 *
 *     1. decode + guard     decide BEFORE signing, on what the transaction
 *                           actually does. No mandate, no transaction.
 *    1b. simulate           rehearse it on the node. Would revert? Stop: a
 *                           failed transaction still costs gas.
 *     2. nonce              read it once, reuse it on retry. This is the
 *                           protocol's idempotency key.
 *     3. sign + broadcast
 *     4. receipt            poll until mined. status 1 = success, 0 = reverted.
 *     5. reconcile          compare what was intended against what happened.
 *
 * Step 5 exists because step 3 can time out after the transaction already
 * landed. A retry that re-signs with a NEW nonce sends the money twice. A retry
 * that reuses the SAME nonce cannot: the chain rejects the duplicate.
 *
 * Every send, native or token, goes through execute(). A token transfer is a
 * contract call with value 0, so step 1 decodes the calldata and the guard
 * judges the real recipient and amount, never the value field.
 *
 * Key handling: the private key is read from a file that must be gitignored,
 * never from source, never from a chat. Use a throwaway testnet wallet.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

import { erc20Abi } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";

import { loadAccount } from "./account.ts";
import * as arc from "./arc.ts";
import { CONTRACTS, EURC, type KnownContract, TOKENS } from "./contracts.ts";
import * as guard from "./guard.ts";
import { decodeIntent, encodeApprove, encodeTransfer, type TxRequest } from "./intent.ts";
import { tokenInfo } from "./read.ts";
import { simulate } from "./simulate.ts";

// Code lives in src/; the evidence lives at the repo root.
const LOG_FILE = join(import.meta.dirname, "..", "evidence", "sends.jsonl");

export { loadAccount };

/**
 * The same text Python's json.dumps(record, sort_keys=True) writes, so lines
 * from before the TypeScript port and after it look identical in the file.
 */
function pythonStyleJson(record: Record<string, unknown>): string {
  const fields = Object.keys(record)
    .sort()
    .map((k) => `${JSON.stringify(k)}: ${JSON.stringify(record[k])}`);
  return `{${fields.join(", ")}}`;
}

/** Append-only evidence. One JSON object per line, never rewritten. */
function log(record: Record<string, unknown>, logFile: string): void {
  mkdirSync(dirname(logFile), { recursive: true });
  appendFileSync(logFile, pythonStyleJson(record) + "\n");
}

/** The fields of an evidence line that the totals read. */
type SpendLine = {
  from?: string;
  broadcast?: boolean;
  kind?: string;          // absent on native lines written before Stage 5
  amount_usdc?: string;   // native lines
  amount?: string;        // token lines
  asset?: string;
  decimals?: number;
};

/**
 * What this script has recorded as broadcast from this address, per asset.
 * Approvals count too: an approval is money someone else may take. USDC is
 * summed at 18 decimals, whether it moved natively or through its token.
 */
export function alreadySent(sender: string, logFile = LOG_FILE): guard.Spent {
  const totals = new Map<string, { units: bigint; decimals: number }>();
  const add = (symbol: string, amount: string, decimals: number) => {
    const t = totals.get(symbol) ?? { units: 0n, decimals };
    t.units += guard.toUnits(amount, decimals);
    totals.set(symbol, t);
  };

  if (existsSync(logFile)) {
    for (const line of readFileSync(logFile, "utf8").split("\n")) {
      if (!line.trim()) {
        continue;
      }
      const r = JSON.parse(line) as SpendLine;
      if ((r.from ?? "").toLowerCase() !== sender.toLowerCase() || !r.broadcast) {
        continue;
      }
      if ((r.kind ?? "native") === "native") {
        add("USDC", r.amount_usdc ?? "0", guard.ARC_USDC_DECIMALS);
      } else if (r.asset !== undefined && r.amount !== undefined) {
        add(r.asset, r.amount, r.asset === "USDC" ? guard.ARC_USDC_DECIMALS : (r.decimals ?? 18));
      }
    }
  }
  return Object.fromEntries([...totals].map(([s, t]) => [s, guard.fromUnits(t.units, t.decimals) ?? "0"]));
}

/** Poll until mined. Returns null on timeout — UNKNOWN stays UNKNOWN. */
async function waitForReceipt(txHash: string, timeoutMs: number, intervalMs = 3_000): Promise<arc.Receipt | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await arc.receipt(txHash);
    if (r !== null) {
      return r;
    }
    await sleep(intervalMs);
  }
  return null;
}

/** A value the node must have answered. A missing one stops the send. */
function required<T>(value: T | null, what: string): T {
  if (value === null) {
    throw new Error(`node returned no ${what}; stopping before signing`);
  }
  return value;
}

/** A registered token, or an ad-hoc ERC-20 entry for an address we do not know. */
function tokenAt(address: string): KnownContract {
  const known = CONTRACTS.find((c) => c.address.toLowerCase() === address.toLowerCase());
  return known ?? { name: address, address: address as `0x${string}`, abi: erc20Abi, kind: "token", note: "" };
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Options exist so tests can use a throwaway wallet and a temporary log,
 * and never touch the real key or the real evidence.
 */
export type SendOptions = {
  account?: PrivateKeyAccount;
  logFile?: string;
  receiptTimeoutMs?: number;
};

/** The one pipeline every send goes through. Returns the tx hash, or null if refused. */
export async function execute(
  mandate: guard.Mandate,
  tx: TxRequest,
  { account, logFile = LOG_FILE, receiptTimeoutMs = 120_000 }: SendOptions = {},
): Promise<string | null> {
  const acct = account ?? loadAccount();
  const refuseAndLog = (fields: Record<string, unknown>, reason: string, label = "guard: REFUSE"): null => {
    console.log(`${label} — ${reason}`);
    log({ ts: Date.now() / 1000, from: acct.address, ...fields, broadcast: false, refused_because: reason }, logFile);
    return null;
  };

  // 1. DECODE, THEN DECIDE. Nothing is signed until the mandate allows what
  //    the transaction actually does.
  const intent = decodeIntent(tx);
  let decimals: number | undefined;
  let entry: Record<string, unknown>;
  let described: string;

  if (intent.kind === "native") {
    entry = { to: intent.to, amount_usdc: guard.fromWei(intent.amount) };
    described = `${guard.fromWei(intent.amount)} USDC -> ${intent.to}`;
  } else if (intent.kind === "unknown") {
    entry = { kind: "unknown", to: tx.to, amount: "0", asset: "?" };
    described = `unknown call to ${tx.to}`;
  } else {
    let symbol: string;
    try {
      ({ decimals, symbol } = await tokenInfo(tokenAt(intent.token)));
    } catch (e) {
      return refuseAndLog(
        { kind: intent.kind, token: intent.token, to: intent.kind === "transfer" ? intent.to : intent.spender, amount: "?", asset: "?" },
        `could not read the token: ${(e as Error).message}`,
      );
    }
    const counterparty = intent.kind === "transfer" ? intent.to : intent.spender;
    const amount = guard.fromUnits(intent.amount, decimals);
    entry = { kind: intent.kind, asset: symbol, token: intent.token, decimals, to: counterparty, amount };
    described = `${intent.kind} ${amount} ${symbol} (token ${short(intent.token)}) -> ${counterparty}`;
  }

  const verdict = guard.checkIntent(mandate, intent, {
    chainId: arc.CHAIN_ID,
    decimals,
    alreadySent: alreadySent(acct.address, logFile),
  });
  if (!verdict.allowed) {
    return refuseAndLog(entry, verdict.reason);
  }
  console.log(`guard: ALLOW — ${verdict.reason}`);

  // 1b. REHEARSE. The node runs the transaction without keeping it. If it
  //     would revert, it would still cost gas for nothing: stop here.
  const sim = await simulate(acct.address, tx);
  if (!sim.ok) {
    return refuseAndLog(entry, `simulation: ${sim.reason}`, "simulate: REVERT");
  }
  console.log(`simulate: OK — gas limit ${sim.gas}`);
  const gas = sim.gas;

  // 2. Nonce: read once. On retry this same value must be reused.
  const n = required(await arc.nonce(acct.address), "nonce");
  const price = required(await arc.gasPrice(), "gas price");

  const balance = required(await arc.balanceWei(acct.address), "balance");
  const cost = tx.value + gas * price;
  if (balance < cost) {
    console.log(
      `insufficient: have ${guard.fromWei(balance)}, ` +
        `need ${guard.fromWei(cost)} incl gas`,
    );
    return null;
  }

  console.log(`intent: ${described}  nonce=${n}`);

  // 3. Sign and broadcast.
  const signed = await acct.signTransaction({
    type: "legacy",
    to: tx.to,
    value: tx.value,
    ...(tx.data === "0x" ? {} : { data: tx.data }),
    gas,
    gasPrice: price,
    nonce: n,
    chainId: arc.CHAIN_ID,
  });
  const txHash = (await arc.ask("eth_sendRawTransaction", [signed])) as string;

  log({
    ts: Date.now() / 1000, from: acct.address, ...entry,
    nonce: n, tx_hash: txHash, broadcast: true,
  }, logFile);
  console.log(`broadcast: ${txHash}`);

  // 4. Verify. What actually happened, not what was intended.
  const r = await waitForReceipt(txHash, receiptTimeoutMs);
  if (r === null) {
    console.log("receipt: UNKNOWN — still pending after timeout.");
    console.log(`         Do NOT resend. Re-check with nonce ${n}.`);
    return txHash;
  }

  const status = arc.toInt(r.status);
  const gasUsed = arc.toInt(r.gasUsed);
  console.log(
    `receipt: status=${status} ` +
      `(${status === 1n ? "SUCCESS" : "REVERTED"}) gasUsed=${gasUsed}`,
  );

  // 5. Reconcile: intended vs actual.
  if (status === 1n) {
    const after = await arc.nonce(acct.address);
    console.log(
      `reconcile: nonce ${n} -> ${after} ` +
        `(${after === n + 1 ? "consistent" : "UNEXPECTED"})`,
    );
  }

  return txHash;
}

/** Send native USDC. */
export async function send(
  mandate: guard.Mandate,
  to: string,
  amountUsdc: string,
  options: SendOptions = {},
): Promise<string | null> {
  let value: bigint;
  try {
    value = guard.toWei(amountUsdc);
  } catch {
    value = -1n; // not a real amount: the guard refuses it below and says why
  }
  if (value < 0n) {
    const acct = options.account ?? loadAccount();
    const reason = `amount is not a valid USDC amount: ${JSON.stringify(amountUsdc)}`;
    console.log(`guard: REFUSE — ${reason}`);
    log({ ts: Date.now() / 1000, from: acct.address, to, amount_usdc: amountUsdc, broadcast: false, refused_because: reason },
      options.logFile ?? LOG_FILE);
    return null;
  }
  return execute(mandate, { to: to as `0x${string}`, value, data: "0x" }, options);
}

/** Read a token's decimals from the chain and turn a decimal amount into base units. */
async function tokenUnits(token: KnownContract, amount: string): Promise<bigint> {
  const { decimals } = await tokenInfo(token);
  return guard.toUnits(amount, decimals);
}

/** Send an ERC-20 token: a call to the token contract, value 0. */
export async function sendToken(
  mandate: guard.Mandate,
  token: KnownContract,
  to: string,
  amount: string,
  options: SendOptions = {},
): Promise<string | null> {
  const units = await tokenUnits(token, amount);
  return execute(mandate, { to: token.address, value: 0n, data: encodeTransfer(to as `0x${string}`, units) }, options);
}

/** Approve a spender for a token. "max" asks for unlimited, which the guard always refuses. */
export async function approveToken(
  mandate: guard.Mandate,
  token: KnownContract,
  spender: string,
  amount: string,
  options: SendOptions = {},
): Promise<string | null> {
  const units = amount === "max" ? 2n ** 256n - 1n : await tokenUnits(token, amount);
  return execute(mandate, { to: token.address, value: 0n, data: encodeApprove(spender as `0x${string}`, units) }, options);
}

// Runs only when this file is started directly (node src/send.ts),
// never when another file imports it.
//
//   npm run send                                         0.1 USDC to yourself
//   npm run send -- --to 0x… --amount 0.25               native USDC
//   npm run send -- --token EURC --amount 0.5            a token transfer
//   npm run send -- --token EURC --approve 0x… --amount max    an approval
//
// The guard still decides: anything outside the mandate is refused and
// logged, not sent.
if (import.meta.main) {
  const { values: args } = parseArgs({
    options: {
      to: { type: "string" },
      amount: { type: "string", default: "0.1" },
      token: { type: "string" },
      approve: { type: "string" },
    },
  });

  const acct = loadAccount();
  const me = acct.address;
  console.log(`address: ${me}`);
  console.log(`balance: ${guard.fromWei(await arc.balanceWei(me))} USDC`);

  // Mandate: this account may pay ITSELF, up to 1 USDC (5 total) and up to
  // 1 EURC (5 total). It may approve no one.
  const mandate = guard.makeMandate({
    allowedRecipients: [me],
    maxAmountUsdc: "1",
    maxTotalUsdc: "5",
    chainId: arc.CHAIN_ID,
    tokens: [{ address: EURC.address, symbol: "EURC", decimals: 6, maxAmount: "1", maxTotal: "5" }],
    allowedSpenders: [],
  });

  const token = args.token === undefined
    ? undefined
    : TOKENS.find((t) => t.name.toLowerCase() === args.token!.toLowerCase());
  if (args.token !== undefined && token === undefined) {
    console.error(`unknown token ${args.token}; known: ${TOKENS.map((t) => t.name).join(", ")}`);
    process.exit(1);
  }

  if (args.approve !== undefined) {
    if (token === undefined) {
      console.error("--approve needs --token");
      process.exit(1);
    }
    await approveToken(mandate, token, args.approve, args.amount, { account: acct });
  } else if (token !== undefined) {
    await sendToken(mandate, token, args.to ?? me, args.amount, { account: acct });
  } else {
    await send(mandate, args.to ?? me, args.amount, { account: acct });
  }
}
