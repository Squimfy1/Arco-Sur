/**
 * The app remembers only what the chain can no longer change.
 */

import { expect, test, vi } from "vitest";

import { remembering } from "../src/lib/server/memo.ts";

const HASH = `0x${"ab".repeat(32)}`;
const mined = { hash: HASH, from: "0x1", to: "0x2", value: "0x0", nonce: "0x0", blockNumber: "0x10", input: "0x" };

function chain() {
  return {
    transaction: vi.fn(async () => mined as typeof mined | null),
    receipt: vi.fn(async () => ({ status: "0x1", blockNumber: "0x10" }) as { status: string; blockNumber?: string } | null),
    nonce: vi.fn(async () => 3),
    balanceAt: vi.fn(async () => 5n as bigint | null),
  };
}

test("a mined transaction, its receipt and a past balance are asked for once", async () => {
  const c = chain();
  const m = remembering(c);
  for (let i = 0; i < 3; i++) {
    expect(await m.transaction(HASH)).toBe(mined);
    expect(await m.receipt(HASH)).toMatchObject({ status: "0x1" });
    expect(await m.balanceAt("0xAbC", 7n)).toBe(5n);
  }
  expect(c.transaction).toHaveBeenCalledTimes(1);
  expect(c.receipt).toHaveBeenCalledTimes(1);
  expect(c.balanceAt).toHaveBeenCalledTimes(1);
  // The same address in other letter case is the same address.
  await m.balanceAt("0xabc", 7n);
  expect(c.balanceAt).toHaveBeenCalledTimes(1);
});

test("anything that can still change is asked for every time", async () => {
  const c = chain();
  c.transaction.mockResolvedValue({ ...mined, blockNumber: null } as never);   // pending
  c.receipt.mockResolvedValue(null);                                         // not mined yet
  c.balanceAt.mockResolvedValue(null);                                       // node keeps no history
  const m = remembering(c);
  for (let i = 0; i < 2; i++) {
    await m.transaction(HASH);
    await m.receipt(HASH);
    await m.nonce("0x1");
    await m.balanceAt("0x1", "latest");
    await m.balanceAt("0x1", 7n);
  }
  expect(c.transaction).toHaveBeenCalledTimes(2);
  expect(c.receipt).toHaveBeenCalledTimes(2);
  expect(c.nonce).toHaveBeenCalledTimes(2);
  expect(c.balanceAt).toHaveBeenCalledTimes(4);
});
