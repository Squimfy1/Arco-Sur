/**
 * Stage 6: rehearse a transaction on the node before signing it.
 *
 * The node is a fake that either answers or reverts, so every outcome is
 * exact and needs no network.
 */

import { describe, expect, test, vi } from "vitest";

import { RpcError } from "../src/lib/server/arc.ts";
import { encodeTransfer } from "../src/lib/server/intent.ts";
import { type Simulator, simulate } from "../src/lib/server/simulate.ts";

const ME = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const TRUE = `0x${"0".repeat(63)}1` as const;
const FALSE = `0x${"0".repeat(64)}` as const;

const native = { to: ME, value: 10n ** 17n, data: "0x" } as const;
const transfer = { to: EURC, value: 0n, data: encodeTransfer(ME, 500_000n) } as const;

function node(call: () => Promise<`0x${string}`>, gas = 40_000n): Simulator & { estimates: number } {
  const s = {
    estimates: 0,
    simulateCall: vi.fn(call),
    estimateGas: vi.fn(async () => {
      s.estimates++;
      return gas;
    }),
  };
  return s;
}

const revert = (message: string) => async (): Promise<never> => {
  throw new RpcError(`eth_call: {"code":3,"message":"${message}"}`, { code: 3, message });
};

describe("simulate", () => {
  test("a revert stops the send and keeps the chain's own reason", async () => {
    const result = await simulate(ME, transfer, node(revert("execution reverted: ERC20: transfer amount exceeds balance")));
    expect(result).toEqual({ ok: false, reason: "execution reverted: ERC20: transfer amount exceeds balance" });
  });

  test("a token call that returns false is a failure, even though it did not revert", async () => {
    const result = await simulate(ME, transfer, node(async () => FALSE));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("returned false");
  });

  test("a token call that succeeds gets its gas estimate plus a 20% margin", async () => {
    const result = await simulate(ME, transfer, node(async () => TRUE, 40_000n));
    expect(result).toEqual({ ok: true, gas: 48_000n });
  });

  test("a plain payment uses the fixed 21000 gas and is still rehearsed", async () => {
    const n = node(async () => "0x");
    const result = await simulate(ME, native, n);
    expect(result).toEqual({ ok: true, gas: 21_000n });
    expect(n.simulateCall).toHaveBeenCalledOnce();
    expect(n.estimates).toBe(0);
  });

  test("a failing gas estimate is a failure too", async () => {
    const n: Simulator = {
      simulateCall: async () => TRUE,
      estimateGas: revert("execution reverted: out of gas"),
    };
    expect(await simulate(ME, transfer, n)).toEqual({ ok: false, reason: "execution reverted: out of gas" });
  });

  test("an error that is not the node's answer (network down) is not swallowed", async () => {
    const n = node(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(simulate(ME, transfer, n)).rejects.toThrow("fetch failed");
  });
});
