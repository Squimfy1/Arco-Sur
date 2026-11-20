/**
 * Stage 5: a token transfer is judged on its decoded calldata, not its value.
 *
 * Every test builds real calldata with intent.ts, decodes it, and hands the
 * result to the guard, exactly as send.ts does.
 */

import { describe, expect, test } from "vitest";

import {
  ARC_USDC_TOKEN,
  type Intent,
  MandateError,
  UNBOUNDED_APPROVAL,
  checkIntent,
  makeMandate,
  toUnits,
} from "../src/guard.ts";
import { decodeIntent, encodeApprove, encodeTransfer } from "../src/intent.ts";

const ME = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
const STRANGER = "0x1111111111111111111111111111111111111111";
const DEX = "0x2222222222222222222222222222222222222222";
const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const USDC = ARC_USDC_TOKEN as `0x${string}`;
const ARC = 5042002;

function mandate(allowedSpenders: string[] = []) {
  return makeMandate({
    allowedRecipients: [ME],
    maxAmountUsdc: "1",
    maxTotalUsdc: "5",
    chainId: ARC,
    tokens: [{ address: EURC, symbol: "EURC", decimals: 6, maxAmount: "1", maxTotal: "5" }],
    allowedSpenders,
  });
}

const eurc = (n: string) => toUnits(n, 6);

/** Build the transaction bytes, decode them, and ask the guard. */
function judge(to: `0x${string}`, data: `0x${string}`, decimals = 6, alreadySent = {}, m = mandate()) {
  const intent = decodeIntent({ to, value: 0n, data });
  return { intent, verdict: checkIntent(m, intent, { chainId: ARC, decimals, alreadySent }) };
}

// --- the lesson: value is 0, the amount is in the data ---------------------

describe("token transfers", () => {
  test("the guard sees the true amount inside the calldata, not the zero value", () => {
    // A transfer of a billion EURC. Its `value` field is 0.
    const { intent, verdict } = judge(EURC, encodeTransfer(ME, eurc("1000000000")));
    expect(intent).toEqual({ kind: "transfer", token: EURC, to: ME, amount: eurc("1000000000") });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("1000000000 EURC exceeds per-payment limit 1");
  });

  test("a transfer within the token's limits is allowed", () => {
    expect(judge(EURC, encodeTransfer(ME, eurc("0.5"))).verdict.allowed).toBe(true);
  });

  test("a token transfer to someone not on the allowlist is refused", () => {
    const { verdict } = judge(EURC, encodeTransfer(STRANGER, eurc("0.5")));
    expect(verdict.reason).toContain("allowlist");
  });

  test("a token the mandate does not list is refused", () => {
    const { verdict } = judge(DEX, encodeTransfer(ME, 1n));
    expect(verdict.reason).toContain("token not in the mandate");
  });

  test("decimals from the chain must match the mandate's, or nothing is sent", () => {
    const { verdict } = judge(EURC, encodeTransfer(ME, eurc("0.5")), 18);
    expect(verdict.reason).toContain("decimals mismatch for EURC: mandate says 6, chain says 18");
  });

  test("the token's total limit counts what was already sent", () => {
    const { verdict } = judge(EURC, encodeTransfer(ME, eurc("0.5")), 6, { EURC: "4.8" });
    expect(verdict.reason).toContain("cumulative 5.3 EURC");
  });

  test("USDC through its token contract obeys the same USDC limits as native sends", () => {
    // 0.6 already sent natively + 0.5 as a token is still within 5...
    expect(judge(USDC, encodeTransfer(ME, toUnits("0.5", 6)), 6, { USDC: "0.6" }).verdict.allowed).toBe(true);
    // ...and 2 USDC as a token breaks the 1 USDC per-payment limit, like a native send would.
    expect(judge(USDC, encodeTransfer(ME, toUnits("2", 6))).verdict.reason).toContain("per-payment limit");
  });
});

// --- approvals: a standing permission to take your tokens -------------------

describe("approvals", () => {
  test("an unbounded approval is always refused, even to an allowed spender", () => {
    const max = 2n ** 256n - 1n;
    const { intent, verdict } = judge(EURC, encodeApprove(DEX, max), 6, {}, mandate([DEX]));
    expect(intent.kind).toBe("approve");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("unbounded approval");
    expect(UNBOUNDED_APPROVAL <= max).toBe(true);
  });

  test("an approval to a spender not in the mandate is refused", () => {
    const { verdict } = judge(EURC, encodeApprove(DEX, eurc("0.5")));
    expect(verdict.reason).toContain("spender not allowed");
  });

  test("a bounded approval to an allowed spender, within one payment, is allowed", () => {
    expect(judge(EURC, encodeApprove(DEX, eurc("0.5")), 6, {}, mandate([DEX])).verdict.allowed).toBe(true);
  });

  test("an approval larger than one payment is refused", () => {
    const { verdict } = judge(EURC, encodeApprove(DEX, eurc("3")), 6, {}, mandate([DEX]));
    expect(verdict.reason).toContain("exceeds the per-payment limit");
  });

  test("a USDC approval counts against the USDC total", () => {
    const { verdict } = judge(USDC, encodeApprove(DEX, toUnits("0.5", 6)), 6, { USDC: "4.8" }, mandate([DEX]));
    expect(verdict.reason).toContain("past its total limit");
  });
});

// --- anything else is refused ---------------------------------------------

describe("default deny", () => {
  test("calldata that is not a token function is refused", () => {
    const { intent, verdict } = judge(EURC, "0xdeadbeef00000000");
    expect(intent.kind).toBe("unknown");
    expect(verdict.reason).toContain("not a payment this guard understands");
  });

  test("transferFrom is refused: it spends someone else's approval", () => {
    const data = ("0x23b872dd" + "0".repeat(192)) as `0x${string}`;
    expect(judge(EURC, data).verdict.allowed).toBe(false);
  });

  test("native value and a contract call in one transaction is refused", () => {
    const intent = decodeIntent({ to: EURC, value: 1n, data: encodeTransfer(ME, 1n) });
    expect(intent.kind).toBe("unknown");
  });

  test("empty calldata is a plain native payment, judged by the original rules", () => {
    const intent: Intent = decodeIntent({ to: ME, value: toUnits("0.1", 18), data: "0x" });
    expect(intent).toEqual({ kind: "native", to: ME, amount: toUnits("0.1", 18) });
    expect(checkIntent(mandate(), intent, { chainId: ARC }).allowed).toBe(true);
  });
});

describe("token rules in the mandate", () => {
  test("a token rule for USDC is rejected: USDC already has its own limits", () => {
    expect(() =>
      makeMandate({
        allowedRecipients: [ME], maxAmountUsdc: "1", maxTotalUsdc: "5", chainId: ARC,
        tokens: [{ address: USDC, symbol: "USDC", decimals: 6, maxAmount: "1", maxTotal: "5" }],
      }),
    ).toThrow(MandateError);
  });

  test("the token rules are frozen with the mandate", () => {
    const m = mandate();
    expect(() => {
      (m.tokens[0] as { maxAmount: string }).maxAmount = "1000";
    }).toThrow(TypeError);
  });
});
