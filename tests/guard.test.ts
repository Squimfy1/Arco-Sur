/**
 * Tests for the mandate. No network, no keys, no chain.
 *
 * The important tests are the refusals. A guard that only proves it permits
 * good payments has not been tested at all.
 */

import { describe, expect, test } from "vitest";

import {
  ARC_USDC_DECIMALS,
  MandateError,
  check,
  fromWei,
  makeMandate,
  normalise,
  toWei,
} from "../src/lib/server/guard.ts";

const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";
const ARC = 5042002;

function mandate() {
  return makeMandate({
    allowedRecipients: [ALICE],
    maxAmountUsdc: "5",
    maxTotalUsdc: "20",
    chainId: ARC,
  });
}

// --- the happy path, one test ---------------------------------------------

test("payment within mandate is allowed", () => {
  const v = check(mandate(), { to: ALICE, amountUsdc: "1", chainId: ARC });
  expect(v.allowed).toBe(true);
  expect(v.reason).toBe("within mandate");
});

// --- the refusals, which are the point ------------------------------------

describe("refusals", () => {
  test("unknown recipient refused", () => {
    const v = check(mandate(), { to: BOB, amountUsdc: "1", chainId: ARC });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("allowlist");
  });

  test("amount over per-payment limit refused", () => {
    const v = check(mandate(), { to: ALICE, amountUsdc: "5.01", chainId: ARC });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("per-payment limit");
  });

  test("exactly at limit is allowed", () => {
    // Boundary: <= passes, > fails. Off-by-one here is a real bug.
    expect(check(mandate(), { to: ALICE, amountUsdc: "5", chainId: ARC }).allowed).toBe(true);
  });

  test("cumulative limit refused", () => {
    const v = check(mandate(), {
      to: ALICE,
      amountUsdc: "5",
      chainId: ARC,
      alreadySentUsdc: "16",
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("cumulative");
  });

  test("wrong chain refused", () => {
    // A mainnet transaction must not pass a testnet mandate.
    const v = check(mandate(), { to: ALICE, amountUsdc: "1", chainId: 1 });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("wrong chain");
  });

  test("zero and negative refused", () => {
    for (const bad of ["0", "-1"]) {
      const v = check(mandate(), { to: ALICE, amountUsdc: bad, chainId: ARC });
      expect(v.allowed).toBe(false);
    }
  });

  test("number amount refused", () => {
    // Numbers are rejected outright: 0.1 + 0.2 !== 0.3 and money is exact.
    const v = check(mandate(), { to: ALICE, amountUsdc: 1.0, chainId: ARC });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("decimal string");
  });

  test("malformed addresses refused", () => {
    for (const bad of ["0x123", "", null, "nonsense", ALICE.slice(0, -1) + "g", 42]) {
      const v = check(mandate(), { to: bad, amountUsdc: "1", chainId: ARC });
      expect(v.allowed, `${JSON.stringify(bad)} should have been refused`).toBe(false);
    }
  });

  test("case does not bypass the allowlist", () => {
    const v = check(mandate(), {
      to: ALICE.toUpperCase().replace("0X", "0x"),
      amountUsdc: "1",
      chainId: ARC,
    });
    expect(v.allowed).toBe(true);
  });
});

// --- a mandate that permits nothing is a configuration error --------------

describe("mandate construction", () => {
  test("empty allowlist rejected at construction", () => {
    expect(() =>
      makeMandate({ allowedRecipients: [], maxAmountUsdc: "1", maxTotalUsdc: "1", chainId: ARC }),
    ).toThrow(MandateError);
  });

  test("total below per-payment rejected", () => {
    expect(() =>
      makeMandate({ allowedRecipients: [ALICE], maxAmountUsdc: "10", maxTotalUsdc: "5", chainId: ARC }),
    ).toThrow(MandateError);
  });

  test("a mandate cannot be edited after it is made", () => {
    // New in the TypeScript port. Python's frozen dataclass did this for
    // free; here Object.freeze does it, and it must reach the allowlist too.
    const m = mandate();
    expect(() => {
      (m as { maxAmountUsdc: string }).maxAmountUsdc = "1000";
    }).toThrow(TypeError);
    expect(() => {
      (m.allowedRecipients as string[]).push(BOB);
    }).toThrow(TypeError);
  });
});

// --- unit conversion: Arc USDC is 18 decimals, not the usual 6 ------------

describe("unit conversion", () => {
  test("Arc USDC is eighteen decimals", () => {
    expect(ARC_USDC_DECIMALS).toBe(18);
    expect(toWei("1")).toBe(10n ** 18n);
  });

  test("wei round trip", () => {
    for (const v of ["1", "0.5", "40", "0.000000000000000001"]) {
      expect(fromWei(toWei(v))).toBe(v);
    }
  });

  test("number rejected by toWei", () => {
    expect(() => toWei(1.5 as unknown as string)).toThrow(TypeError);
  });

  test("sub-wei amount rejected", () => {
    expect(() => toWei("0.0000000000000000001")).toThrow(RangeError);
  });

  test("normalise returns null, not garbage", () => {
    expect(normalise("0xdeadbeef")).toBeNull();
    expect(normalise(null)).toBeNull();
  });
});
