/**
 * Stage 3: reconcile the evidence log against the chain.
 *
 * Two records of the same events, no shared clock, either may be stale. The
 * chain here is a fake built from a list of "on-chain" transactions, so every
 * case is exact and needs no network.
 */

import { describe, expect, test } from "vitest";

import type { ChainTx, Receipt } from "../src/arc.ts";
import { toWei } from "../src/guard.ts";
import { type Chain, type Entry, reconcile } from "../src/reconcile.ts";

const ME = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
const BOB = "0x2222222222222222222222222222222222222222";
const hash = (n: number) => "0x" + n.toString(16).padStart(64, "0");

type OnChain = { nonce: number; to?: string; amount?: string; status?: "0x1" | "0x0" | null };

/** A chain that knows exactly these transactions, and records what it is asked. */
function fakeChain(onChain: OnChain[], chainNonce = onChain.length) {
  const asked: string[] = [];
  const txs = new Map<string, { tx: ChainTx; receipt: Receipt | null }>();
  for (const t of onChain) {
    const status = t.status === undefined ? "0x1" : t.status;
    txs.set(hash(t.nonce), {
      tx: {
        hash: hash(t.nonce),
        from: ME,
        to: t.to ?? ME,
        value: "0x" + toWei(t.amount ?? "0.1").toString(16),
        nonce: "0x" + t.nonce.toString(16),
        blockNumber: "0x10",
      },
      receipt: status === null ? null : { status, gasUsed: "0x5208", blockNumber: "0x10" },
    });
  }
  const chain: Chain = {
    async transaction(h) {
      asked.push(h);
      return txs.get(h)?.tx ?? null;
    },
    async receipt(h) {
      return txs.get(h)?.receipt ?? null;
    },
    async nonce() {
      return chainNonce;
    },
  };
  return { chain, asked };
}

/** One log line for a broadcast send, as send.ts writes it. */
function sent(line: number, nonce: number, amount = "0.1", to = ME): Entry {
  return {
    line,
    record: { ts: 0, from: ME, to, amount_usdc: amount, nonce, tx_hash: hash(nonce), broadcast: true },
  };
}

const statuses = (rows: { status: string }[]) => rows.map((r) => r.status);

// --- the three cases from the plan -----------------------------------------

describe("the plan's three cases", () => {
  test("1. clean log: every row MATCHED", async () => {
    const { chain } = fakeChain([{ nonce: 0 }, { nonce: 1 }, { nonce: 2 }]);
    const report = await reconcile([sent(1, 0), sent(2, 1), sent(3, 2)], chain);

    expect(statuses(report.rows)).toEqual(["MATCHED", "MATCHED", "MATCHED"]);
    expect(report.senders[0]?.gaps).toEqual([]);
    expect(report.ok).toBe(true);
  });

  test("2. one corrupted amount: DIVERGENT on that row only, naming both values", async () => {
    const { chain } = fakeChain([{ nonce: 0 }, { nonce: 1 }, { nonce: 2 }]);
    const report = await reconcile([sent(1, 0), sent(2, 1, "0.5"), sent(3, 2)], chain);

    expect(statuses(report.rows)).toEqual(["MATCHED", "DIVERGENT", "MATCHED"]);
    expect(report.rows[1]?.problems).toEqual(["amount: log 0.5 USDC, chain 0.1 USDC"]);
    expect(report.ok).toBe(false);
  });

  test("3. a deleted line: the chain has a nonce the log does not", async () => {
    // Nonce 1 happened on chain, but its log line is gone.
    const { chain } = fakeChain([{ nonce: 0 }, { nonce: 1 }, { nonce: 2 }]);
    const report = await reconcile([sent(1, 0), sent(2, 2)], chain);

    expect(statuses(report.rows)).toEqual(["MATCHED", "MATCHED"]);
    expect(report.senders[0]?.gaps).toEqual([1]);
    expect(report.ok).toBe(false);
  });
});

// --- everything else the log and the chain can disagree about --------------

describe("other disagreements", () => {
  test("a send made outside this tool after the last logged one is a gap", async () => {
    // e.g. sent from MetaMask: the chain's nonce moved on, the log did not.
    const { chain } = fakeChain([{ nonce: 0 }, { nonce: 1 }], 3);
    const report = await reconcile([sent(1, 0), sent(2, 1)], chain);
    expect(report.senders[0]?.gaps).toEqual([2]);
  });

  test("wrong recipient is DIVERGENT and names both addresses", async () => {
    const { chain } = fakeChain([{ nonce: 0, to: BOB }]);
    const report = await reconcile([sent(1, 0)], chain);
    expect(report.rows[0]?.status).toBe("DIVERGENT");
    expect(report.rows[0]?.problems[0]).toContain(BOB.toLowerCase());
    expect(report.rows[0]?.problems[0]).toContain(ME.toLowerCase());
  });

  test("a hash the chain has never seen is MISSING", async () => {
    const { chain } = fakeChain([], 0);
    const report = await reconcile([sent(1, 0)], chain);
    expect(report.rows[0]?.status).toBe("MISSING");
    expect(report.ok).toBe(false);
  });

  test("known to the chain but not yet mined is PENDING", async () => {
    const { chain } = fakeChain([{ nonce: 0, status: null }], 0);
    const report = await reconcile([sent(1, 0)], chain);
    expect(report.rows[0]?.status).toBe("PENDING");
    expect(report.ok).toBe(false);
  });

  test("mined with status 0 is REVERTED", async () => {
    const { chain } = fakeChain([{ nonce: 0, status: "0x0" }]);
    const report = await reconcile([sent(1, 0)], chain);
    expect(report.rows[0]?.status).toBe("REVERTED");
    expect(report.ok).toBe(false);
  });

  test("the same nonce logged twice is flagged: at most one of them can be real", async () => {
    const { chain } = fakeChain([{ nonce: 0 }]);
    const report = await reconcile([sent(1, 0), sent(2, 0)], chain);
    expect(report.senders[0]?.duplicates).toEqual([0]);
    expect(report.ok).toBe(false);
  });

  test("a refusal is reported as REFUSED and never looked up on chain", async () => {
    const { chain, asked } = fakeChain([{ nonce: 0 }]);
    const refusal: Entry = {
      line: 2,
      record: {
        ts: 0, from: ME, to: BOB, amount_usdc: "0.1", broadcast: false,
        refused_because: "recipient not on the allowlist",
      },
    };
    const report = await reconcile([sent(1, 0), refusal], chain);

    expect(statuses(report.rows)).toEqual(["MATCHED", "REFUSED"]);
    expect(asked).toEqual([hash(0)]);
    expect(report.ok).toBe(true);
  });
});
