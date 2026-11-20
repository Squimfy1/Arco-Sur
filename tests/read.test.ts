/**
 * Stage 4: read any contract with eth_call.
 *
 * The chain is a fake that answers with real ABI-encoded bytes, so encoding
 * and decoding are tested exactly, with no network.
 */

import { encodeFunctionData, encodeFunctionResult, erc20Abi, type Hex, toFunctionSelector } from "viem";
import { describe, expect, test } from "vitest";

import { RpcError } from "../src/lib/server/arc.ts";
import { CONTRACTS, EURC, PERMIT2, USDC } from "../src/lib/server/contracts.ts";
import { normalise } from "../src/lib/server/guard.ts";
import {
  BALANCE_OF_SELECTOR,
  ContractReadError,
  encodeBalanceOf,
  type Reader,
  readContract,
  tokenBalance,
  tokenInfo,
} from "../src/lib/server/read.ts";

const HOLDER = "0xCbEB3dcd3A96843b0324a983658bD31393466486";

type Handler = (data: Hex) => Hex;

/** A chain where only the given addresses hold contracts. Records every call. */
function fakeReader(contracts: Record<string, Handler>) {
  const calls: { to: string; data: Hex }[] = [];
  const byAddress = new Map(Object.entries(contracts).map(([a, h]) => [a.toLowerCase(), h]));
  const reader: Reader = {
    async code(address) {
      return byAddress.has(address.toLowerCase()) ? "0x6080" : "0x";
    },
    async call(to, data) {
      calls.push({ to, data });
      const handler = byAddress.get(to.toLowerCase());
      return handler ? handler(data) : "0x";
    },
  };
  return { reader, calls };
}

/** A token contract that answers symbol, decimals and balanceOf. */
function fakeToken({ symbol = "USDC", decimals = 6, balance = 0n }: { symbol?: string; decimals?: number; balance?: bigint }): Handler {
  return (data) => {
    const selector = data.slice(0, 10);
    if (selector === toFunctionSelector("symbol()")) {
      return encodeFunctionResult({ abi: erc20Abi, functionName: "symbol", result: symbol });
    }
    if (selector === toFunctionSelector("decimals()")) {
      return encodeFunctionResult({ abi: erc20Abi, functionName: "decimals", result: decimals });
    }
    if (selector === BALANCE_OF_SELECTOR) {
      return encodeFunctionResult({ abi: erc20Abi, functionName: "balanceOf", result: balance });
    }
    throw new Error(`fake token has no function ${selector}`);
  };
}

// --- encoding: where the bytes come from -----------------------------------

describe("encoding", () => {
  test("the plan's precomputed selectors are the first 4 bytes of keccak(signature)", () => {
    expect(toFunctionSelector("balanceOf(address)")).toBe("0x70a08231");
    expect(toFunctionSelector("decimals()")).toBe("0x313ce567");
    expect(toFunctionSelector("transfer(address,uint256)")).toBe("0xa9059cbb");
    expect(toFunctionSelector("approve(address,uint256)")).toBe("0x095ea7b3");
  });

  test("hand-encoded balanceOf matches viem's ABI encoder byte for byte", () => {
    const byHand = encodeBalanceOf(HOLDER);
    const byViem = encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [HOLDER] });
    expect(byHand).toBe(byViem);
    // 4-byte selector + one 32-byte argument = 36 bytes = 72 hex characters + "0x".
    expect(byHand).toHaveLength(2 + 8 + 64);
  });

  test("a malformed holder address is refused, not padded into something", () => {
    expect(() => encodeBalanceOf("0x123")).toThrow(TypeError);
  });
});

// --- reading ----------------------------------------------------------------

describe("reading", () => {
  test("token balance is decoded and formatted with the token's own decimals", async () => {
    const { reader } = fakeReader({ [USDC.address]: fakeToken({ balance: 39_997_276n }) });
    const b = await tokenBalance(USDC, HOLDER, reader);
    expect(b).toEqual({ symbol: "USDC", decimals: 6, raw: 39_997_276n, formatted: "39.997276" });
  });

  test("a contract returning several values is decoded into all of them", async () => {
    // Permit2.allowance returns (uint160 amount, uint48 expiration, uint48 nonce).
    const { reader } = fakeReader({
      [PERMIT2.address]: () =>
        encodeFunctionResult({ abi: PERMIT2.abi, functionName: "allowance", result: [500n, 1_800_000_000, 3] }),
    });
    const result = await readContract(PERMIT2, "allowance", [HOLDER, USDC.address, HOLDER], reader);
    expect(result).toEqual([500n, 1_800_000_000, 3]);
  });
});

// --- the traps ----------------------------------------------------------------

describe("refusals", () => {
  test("an address with no contract is refused, never read as a zero balance", async () => {
    const { reader, calls } = fakeReader({});
    await expect(tokenBalance(USDC, HOLDER, reader)).rejects.toThrow(ContractReadError);
    await expect(tokenBalance(USDC, HOLDER, reader)).rejects.toThrow(/no contract/);
    // It stopped before asking: an empty address answers "0x" to anything.
    expect(calls).toEqual([]);
  });

  test("nonsense decimals are refused, not used", async () => {
    const { reader } = fakeReader({ [USDC.address]: fakeToken({ decimals: 255 }) });
    await expect(tokenInfo(USDC, reader)).rejects.toThrow(/decimals/);
  });

  test("a contract that rejects the call is a clear read error, not a raw node error", async () => {
    const { reader } = fakeReader({
      [USDC.address]: () => {
        throw new RpcError('eth_call: {"code":3,"message":"execution reverted"}');
      },
    });
    await expect(tokenInfo(USDC, reader)).rejects.toThrow(ContractReadError);
    await expect(tokenInfo(USDC, reader)).rejects.toThrow(/USDC\.decimals failed on chain/);
  });

  test("a contract that answers with nothing is refused", async () => {
    const { reader } = fakeReader({ [USDC.address]: () => "0x" });
    await expect(tokenInfo(USDC, reader)).rejects.toThrow(ContractReadError);
  });
});

// --- the registry ---------------------------------------------------------------

describe("registry", () => {
  test("every known contract has a valid, unique address and a unique name", () => {
    const addresses = CONTRACTS.map((c) => normalise(c.address));
    expect(addresses).not.toContain(null);
    expect(new Set(addresses).size).toBe(CONTRACTS.length);
    expect(new Set(CONTRACTS.map((c) => c.name)).size).toBe(CONTRACTS.length);
  });

  test("tokens are marked as tokens", () => {
    expect(USDC.kind).toBe("token");
    expect(EURC.kind).toBe("token");
    expect(PERMIT2.kind).toBe("infrastructure");
  });
});
