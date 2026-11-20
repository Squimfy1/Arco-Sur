/**
 * Send USDC on Arc. Guard decides, then sign, broadcast, verify.
 *
 * The order is the whole point:
 *
 *     1. guard.check()      decide BEFORE signing. No mandate, no transaction.
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
 * Key handling: the private key is read from a file that must be gitignored,
 * never from source, never from a chat. Use a throwaway testnet wallet.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

import * as arc from "./arc.ts";
import * as guard from "./guard.ts";

// Code lives in src/; the key and the evidence live at the repo root.
const ROOT = join(import.meta.dirname, "..");
const KEY_FILE = join(ROOT, ".testnet_key");
const LOG_FILE = join(ROOT, "evidence", "sends.jsonl");

// 21000 is the fixed cost of a plain value transfer.
const GAS_LIMIT = 21000n;

export function loadAccount(): PrivateKeyAccount {
  if (!existsSync(KEY_FILE)) {
    console.error(
      `No key at ${KEY_FILE}.\n` +
        "Create a THROWAWAY testnet wallet and put its private key there.\n" +
        "Never use a key that holds real funds.",
    );
    process.exit(1);
  }
  let key = readFileSync(KEY_FILE, "utf8").trim();
  if (!key.startsWith("0x")) {
    key = "0x" + key;
  }
  return privateKeyToAccount(key as `0x${string}`);
}

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
function log(record: Record<string, unknown>): void {
  mkdirSync(dirname(LOG_FILE), { recursive: true });
  appendFileSync(LOG_FILE, pythonStyleJson(record) + "\n");
}

/** Total USDC this script has recorded as broadcast from this address. */
export function alreadySent(sender: string): string {
  if (!existsSync(LOG_FILE)) {
    return "0";
  }
  let total = 0n;
  for (const line of readFileSync(LOG_FILE, "utf8").split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const r = JSON.parse(line) as { from?: string; broadcast?: boolean; amount_usdc: string };
    if ((r.from ?? "").toLowerCase() === sender.toLowerCase() && r.broadcast) {
      total += guard.toWei(r.amount_usdc);
    }
  }
  return guard.fromWei(total) ?? "0";
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

export async function send(
  mandate: guard.Mandate,
  to: string,
  amountUsdc: string,
  { receiptTimeoutMs = 120_000 } = {},
): Promise<string | null> {
  const acct = loadAccount();

  // 1. DECIDE FIRST. Nothing is signed until the mandate allows it.
  const verdict = guard.check(mandate, {
    to,
    amountUsdc,
    chainId: arc.CHAIN_ID,
    alreadySentUsdc: alreadySent(acct.address),
  });
  console.log(`guard: ${verdict.allowed ? "ALLOW" : "REFUSE"} — ${verdict.reason}`);
  if (!verdict.allowed) {
    log({
      ts: Date.now() / 1000, from: acct.address, to,
      amount_usdc: amountUsdc, broadcast: false,
      refused_because: verdict.reason,
    });
    return null;
  }

  // 2. Nonce: read once. On retry this same value must be reused.
  const n = required(await arc.nonce(acct.address), "nonce");
  const price = required(await arc.gasPrice(), "gas price");
  const value = guard.toWei(amountUsdc);

  const balance = required(await arc.balanceWei(acct.address), "balance");
  const cost = value + GAS_LIMIT * price;
  if (balance < cost) {
    console.log(
      `insufficient: have ${guard.fromWei(balance)}, ` +
        `need ${guard.fromWei(cost)} incl gas`,
    );
    return null;
  }

  console.log(`intent: ${amountUsdc} USDC -> ${to}  nonce=${n}`);

  // 3. Sign and broadcast.
  const signed = await acct.signTransaction({
    type: "legacy",
    to: to as `0x${string}`,
    value,
    gas: GAS_LIMIT,
    gasPrice: price,
    nonce: n,
    chainId: arc.CHAIN_ID,
  });
  const txHash = (await arc.ask("eth_sendRawTransaction", [signed])) as string;

  log({
    ts: Date.now() / 1000, from: acct.address, to,
    amount_usdc: amountUsdc, nonce: n,
    tx_hash: txHash, broadcast: true,
  });
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

// Runs only when this file is started directly (node src/send.ts),
// never when another file imports it.
if (import.meta.main) {
  const acct = loadAccount();
  const me = acct.address;
  console.log(`address: ${me}`);
  console.log(`balance: ${guard.fromWei(await arc.balanceWei(me))} USDC`);

  // Mandate: this account may pay ITSELF, up to 1 USDC, 5 USDC total.
  const mandate = guard.makeMandate({
    allowedRecipients: [me],
    maxAmountUsdc: "1",
    maxTotalUsdc: "5",
    chainId: arc.CHAIN_ID,
  });

  await send(mandate, me, "0.1");
}
