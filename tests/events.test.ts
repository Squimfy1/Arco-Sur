/**
 * Stage 7: prove from the receipt's logs what a token call actually did.
 *
 * The first log below is copied from the real receipt of nonce 6 (0.1 USDC
 * through the token contract, to self, 2026-11-20).
 */

import { decodeEventLog, encodeAbiParameters, erc20Abi, pad } from "viem";
import { describe, expect, test } from "vitest";

import { APPROVAL_TOPIC, type Log, TRANSFER_TOPIC, decodeTokenEvents, proveEffect } from "../src/lib/server/events.ts";

const USDC = "0x3600000000000000000000000000000000000000";
const ME = "0xcbeb3dcd3a96843b0324a983658bd31393466486";
const BOB = "0x2222222222222222222222222222222222222222";
const FAKE_TOKEN = "0x9999999999999999999999999999999999999999";

const REAL_LOG: Log = {
  address: USDC,
  topics: [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x000000000000000000000000cbeb3dcd3a96843b0324a983658bd31393466486",
    "0x000000000000000000000000cbeb3dcd3a96843b0324a983658bd31393466486",
  ],
  data: "0x00000000000000000000000000000000000000000000000000000000000186a0",
};

/** A Transfer or Approval log, as a token contract would emit it. */
function tokenLog(topic: string, token: string, a: string, b: string, amount: bigint): Log {
  return {
    address: token,
    topics: [topic, pad(a as `0x${string}`), pad(b as `0x${string}`)],
    data: encodeAbiParameters([{ type: "uint256" }], [amount]),
  };
}

const expected = { kind: "transfer" as const, token: USDC, from: ME, to: ME, amount: 100_000n };

describe("decoding", () => {
  test("the Transfer topic is keccak256 of the event's signature", () => {
    expect(TRANSFER_TOPIC).toBe("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef");
    expect(APPROVAL_TOPIC).toBe("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925");
  });

  test("the real event decodes to 0.1 USDC from me to me", () => {
    expect(decodeTokenEvents([REAL_LOG])).toEqual([
      { kind: "transfer", token: USDC, from: ME, to: ME, amount: 100_000n },
    ]);
  });

  test("hand decoding agrees with viem's ABI decoder", () => {
    const viem = decodeEventLog({
      abi: erc20Abi,
      data: REAL_LOG.data as `0x${string}`,
      topics: REAL_LOG.topics as [`0x${string}`, ...`0x${string}`[]],
    });
    expect(viem.eventName).toBe("Transfer");
    expect(viem.args).toEqual({ from: "0xCbEB3dcd3A96843b0324a983658bD31393466486", to: "0xCbEB3dcd3A96843b0324a983658bD31393466486", value: 100_000n });
  });

  test("an NFT Transfer (4 topics, same signature) is not mistaken for a token transfer", () => {
    const nft: Log = { ...REAL_LOG, topics: [...REAL_LOG.topics, pad("0x01")], data: "0x" };
    expect(decodeTokenEvents([nft])).toEqual([]);
  });
});

describe("proof", () => {
  test("the matching event proves the transfer", () => {
    expect(proveEffect([REAL_LOG], expected)).toEqual({ proven: true });
  });

  test("a different amount in the event is not proof, and both amounts are named", () => {
    const result = proveEffect([tokenLog(TRANSFER_TOPIC, USDC, ME, ME, 200_000n)], expected);
    expect(result.proven).toBe(false);
    expect(!result.proven && result.reason).toContain("200000");
    expect(!result.proven && result.reason).toContain("100000");
  });

  test("a different recipient in the event is not proof", () => {
    const result = proveEffect([tokenLog(TRANSFER_TOPIC, USDC, ME, BOB, 100_000n)], expected);
    expect(result.proven).toBe(false);
  });

  test("the same event emitted by a DIFFERENT contract is not proof", () => {
    // Any contract can emit a log that looks like a USDC Transfer. Only the
    // token contract itself is believed.
    const result = proveEffect([tokenLog(TRANSFER_TOPIC, FAKE_TOKEN, ME, ME, 100_000n)], expected);
    expect(result.proven).toBe(false);
    expect(!result.proven && result.reason).toContain("no Transfer event from the token");
  });

  test("no events at all is not proof", () => {
    expect(proveEffect([], expected)).toEqual({ proven: false, reason: "no Transfer event from the token 0x3600…0000" });
  });

  test("an approval is proven by its Approval event", () => {
    const log = tokenLog(APPROVAL_TOPIC, USDC, ME, BOB, 500n);
    expect(proveEffect([log], { kind: "approve", token: USDC, from: ME, to: BOB, amount: 500n })).toEqual({ proven: true });
  });

  test("two matching events is not proof of one payment: it is ambiguous", () => {
    const result = proveEffect([REAL_LOG, REAL_LOG], expected);
    expect(result.proven).toBe(false);
    expect(!result.proven && result.reason).toContain("2 matching");
  });
});
