/**
 * Swaps: Circle's quote becomes two transactions, and the guard reads the
 * swap call itself. It must refuse a swap that pays anyone but this wallet,
 * one through any contract but Circle's, and one over the per-payment limit.
 *
 * The quote is a real answer from Circle's Stablecoin Service (testnet,
 * 21 Nov 2026), for 0.1 USDC to EURC, priced for a sample address.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { decodeFunctionData, erc20Abi } from "viem";
import { expect, test } from "vitest";

import { SWAP_ADAPTER } from "../src/lib/server/contracts.ts";
import { type Swap, checkIntent, makeMandate } from "../src/lib/server/guard.ts";
import { decodeIntent } from "../src/lib/server/intent.ts";
import { DEFAULTS } from "../src/lib/server/limits.ts";
import { walletMandate } from "../src/lib/server/mandate.ts";
import { quoteView } from "../src/lib/server/progress.ts";
import { SwapError, quoteSwap } from "../src/lib/server/swap.ts";

const QUOTE = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/circle-swap-quote.json"), "utf8"));
const ME = QUOTE.fromAddress as string;
const STRANGER = "0x1111111111111111111111111111111111111111";
const USDC_TOKEN = "0x3600000000000000000000000000000000000000";
const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

const service = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

test("a quote becomes an exact approval and one swap call, with what to expect", async () => {
  const q = await quoteSwap({ from: "USDC", to: "EURC", amount: "0.1" }, ME, service(QUOTE));
  expect(q).toMatchObject({ amountIn: 100000n, estimatedOut: 145295n, minOut: 140936n, fee: 20n });

  // The approval: on USDC's token view, to Circle's swap contract, for exactly 0.1.
  expect(q.approve.to).toBe(USDC_TOKEN);
  const approve = decodeFunctionData({ abi: erc20Abi, data: q.approve.data });
  expect(approve).toMatchObject({ functionName: "approve", args: [SWAP_ADAPTER.address, 100000n] });

  // The swap, read back the way the guard reads it.
  expect(decodeIntent(q.swap)).toEqual({
    kind: "swap",
    via: SWAP_ADAPTER.address,
    tokenIn: USDC_TOKEN,
    amountIn: 100000n,
    tokenOut: EURC,
    minOut: 140936n,
    beneficiaries: [ME, ME],
  });
});

test("the quote is worded for the screen", async () => {
  const v = quoteView(await quoteSwap({ from: "USDC", to: "EURC", amount: "0.1" }, ME, service(QUOTE)));
  expect(v).toMatchObject({ pay: "0.1 USDC", receive: "0.145295 EURC", estimate: "0.145295", atLeast: "0.140936 EURC", rate: "1 USDC = 1.45295 EURC" });
});

test.each([
  [{ from: "USDC", to: "USDC", amount: "0.1" }, "to itself"],
  [{ from: "DOGE", to: "EURC", amount: "0.1" }, "swaps are between"],
  [{ from: "USDC", to: "EURC", amount: "" }, "no amount given"],
  [{ from: "USDC", to: "EURC", amount: "0" }, "more than zero"],
])("a swap that makes no sense is refused before Circle is asked: %o", async (asked, reason) => {
  let asks = 0;
  const counting = async () => {
    asks += 1;
    return new Response("{}");
  };
  await expect(quoteSwap(asked, ME, counting)).rejects.toThrow(reason);
  expect(asks).toBe(0);
});

test("a quote for someone else, or for other tokens, is not used", async () => {
  await expect(quoteSwap({ from: "USDC", to: "EURC", amount: "0.1" }, STRANGER, service(QUOTE))).rejects.toThrow(SwapError);
  await expect(quoteSwap({ from: "USDC", to: "cirBTC", amount: "0.1" }, ME, service(QUOTE))).rejects.toThrow("does not match");
  await expect(quoteSwap({ from: "USDC", to: "EURC", amount: "0.1" }, ME, service({ message: "no route" }, 400))).rejects.toThrow("no route");
});

// --- the guard on swaps -------------------------------------------------------

const swap = (over: Partial<Swap> = {}): Swap => ({
  kind: "swap",
  via: SWAP_ADAPTER.address,
  tokenIn: USDC_TOKEN,
  amountIn: 100000n,
  tokenOut: EURC,
  minOut: 140936n,
  beneficiaries: [ME, ME],
  ...over,
});
const judge = (s: Swap, mandate = walletMandate(ME, DEFAULTS)) => checkIntent(mandate, s, { chainId: 5042002, sender: ME });

test("a swap through Circle's contract, paying only this wallet, within the limit, is allowed", () => {
  expect(judge(swap())).toMatchObject({ allowed: true });
});

test.each([
  ["pays a stranger", swap({ beneficiaries: [ME, STRANGER] }), "would pay someone else"],
  ["names no one", swap({ beneficiaries: [] }), "would pay someone else"],
  ["goes through another contract", swap({ via: STRANGER }), "swap contract not allowed"],
  ["is over the per-payment limit", swap({ amountIn: 1_000_001n }), "exceeds the per-payment limit 1"],
  ["buys a token the rules do not know", swap({ tokenOut: STRANGER }), "not in the mandate"],
  ["guarantees nothing back", swap({ minOut: 0n }), "minimum out is 0"],
  ["swaps a token for itself", swap({ tokenOut: USDC_TOKEN }), "to itself"],
])("a swap that %s is refused", (_, s, reason) => {
  const v = judge(s);
  expect(v.allowed).toBe(false);
  expect(v.reason).toContain(reason);
});

test("with no spender in the rules, no swap passes", () => {
  const none = makeMandate({ allowedRecipients: [ME], maxAmountUsdc: "1", maxTotalUsdc: "5", chainId: 5042002 });
  expect(judge(swap(), none)).toMatchObject({ allowed: false });
});

test("the approval for a swap is checked like any approval: exact, capped, to Circle only", () => {
  const mandate = walletMandate(ME, DEFAULTS);
  const approve = (spender: string, amount: bigint) =>
    checkIntent(mandate, { kind: "approve", token: USDC_TOKEN, spender, amount }, { chainId: 5042002, decimals: 6, sender: ME });
  expect(approve(SWAP_ADAPTER.address, 100000n).allowed).toBe(true);
  expect(approve(STRANGER, 100000n).reason).toContain("spender not allowed");
  expect(approve(SWAP_ADAPTER.address, 2n ** 256n - 1n).reason).toContain("unbounded");
  expect(approve(SWAP_ADAPTER.address, 2_000_000n).reason).toContain("per-payment limit");
});

// --- Operations: a logged swap checked against the chain ------------------------

import { pad, toHex } from "viem";

import { TRANSFER_TOPIC } from "../src/lib/server/events.ts";
import { reconcile } from "../src/lib/server/reconcile.ts";

async function reconciled(received: bigint) {
  const q = await quoteSwap({ from: "USDC", to: "EURC", amount: "0.1" }, ME, service(QUOTE));
  const hash = `0x${"cd".repeat(32)}`;
  const transfer = (token: string, from: string, to: string, amount: bigint) => ({
    address: token,
    topics: [TRANSFER_TOPIC, pad(from as `0x${string}`), pad(to as `0x${string}`)],
    data: pad(toHex(amount)),
  });
  const chain = {
    transaction: async () => ({ from: ME, to: SWAP_ADAPTER.address, value: "0x0", input: q.swap.data, nonce: "0x3", blockNumber: "0x10" }),
    receipt: async () => ({
      status: "0x1", gasUsed: "0x1", effectiveGasPrice: "0x1", blockNumber: "0x10",
      logs: [transfer(USDC_TOKEN, ME, SWAP_ADAPTER.address, 100000n), transfer(EURC, SWAP_ADAPTER.address, ME, received)],
    }),
    nonce: async () => 4,
    balanceAt: async () => null,
  };
  const line = {
    ts: 1795279149, from: ME, to: SWAP_ADAPTER.address, broadcast: true, kind: "swap" as const, asset: "USDC",
    token: USDC_TOKEN, decimals: 6, amount: "0.1", out_asset: "EURC", out_token: EURC, out_decimals: 6, out_min: "0.140936",
    nonce: 3, tx_hash: hash,
  };
  return (await reconcile([{ line: 1, record: line }], chain as never)).rows[0]!;
}

test("a logged swap matches the chain when at least the minimum arrived", async () => {
  const row = await reconciled(145295n);
  expect(row).toMatchObject({ status: "MATCHED", problems: [] });
  // 0.1 USDC left through its token view: the balance check counts it, at 18 decimals.
  expect(row.outflow).toBe(10n ** 17n);
});

test("a logged swap that paid back less than the minimum is divergent", async () => {
  const row = await reconciled(100n);
  expect(row.status).toBe("DIVERGENT");
  expect(row.problems[0]).toContain("below the minimum");
});
