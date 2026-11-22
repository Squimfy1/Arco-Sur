/**
 * The Send screen's Review: the guard and a rehearsal, never a signature.
 *
 * The node is a fake that records what it was asked, so the tests prove a
 * refused payment never reaches it, and an allowed one is only rehearsed.
 */

import { expect, test, vi } from "vitest";

import { toWei } from "../src/lib/server/guard.ts";
import { makeMandate } from "../src/lib/server/guard.ts";
import { DEFAULTS } from "../src/lib/server/limits.ts";
import { walletMandate } from "../src/lib/server/mandate.ts";
import { readForm, review } from "../src/lib/server/review.ts";

const ME = "0xCbEB3dcd3A96843b0324a983658bD31393466486";
const STRANGER = "0x1111111111111111111111111111111111111111";

function node() {
  return {
    simulateCall: vi.fn(async () => "0x" as const),
    estimateGas: vi.fn(async () => 21000n),
    gasPrice: vi.fn(async () => 25_000_000_000n),
  };
}

const ctx = (n = node(), spent = {}) => ({ me: ME, mandate: walletMandate(ME, DEFAULTS), spent, node: n });

test("an allowed payment is rehearsed, priced, and reported ready to send", async () => {
  const n = node();
  const r = await review({ to: ME, amount: "0.1", asset: "USDC" }, ctx(n));
  expect(r.tone).toBe("ok");
  expect(r.title).toBe("Ready to Send");
  expect(r.steps.map((s) => [s.label, s.tone])).toEqual([["Mandate", "ok"], ["Rehearsal", "ok"]]);
  expect(r.steps[1]!.text).toBe("the node accepts it: 21000 gas, fee about 0.000525 USDC");
  expect(n.simulateCall).toHaveBeenCalledWith(ME, { to: ME.toLowerCase(), value: toWei("0.1"), data: "0x" });
});

test.each([
  [{ to: STRANGER, amount: "0.1", asset: "USDC" }, "recipient not on the allowlist"],
  [{ to: ME, amount: "2", asset: "USDC" }, "exceeds per-payment limit 1"],
  [{ to: ME, amount: "0", asset: "USDC" }, "must be positive"],
  [{ to: "me", amount: "0.1", asset: "USDC" }, "not an address"],
  [{ to: ME, amount: "lots", asset: "USDC" }, "not a USDC amount"],
  [{ to: ME, amount: "0.1", asset: "DOGE" }, "not an asset this wallet sends"],
  [{ to: "", amount: "0.1", asset: "USDC" }, "no recipient given"],
  [{ to: ME, amount: "", asset: "USDC" }, "no amount given"],
  [{ to: ME, amount: "", asset: "EURC" }, "no amount given"],
])("refused before the node is asked anything: %o", async (form, reason) => {
  const n = node();
  const r = await review(form, ctx(n));
  expect(r.tone).toBe("bad");
  expect(r.steps.at(-1)!.text).toContain(reason);
  expect(n.simulateCall).not.toHaveBeenCalled();
  expect(r.form).toEqual(form);
});

test("what was already sent counts: the total limit is enforced for someone else", async () => {
  const both = makeMandate({ allowedRecipients: [ME, STRANGER], maxAmountUsdc: "1", maxTotalUsdc: "5", chainId: 5042002 });
  const r = await review({ to: STRANGER, amount: "0.5", asset: "USDC" }, { ...ctx(node(), { USDC: "4.9" }), mandate: both });
  expect(r.steps.at(-1)!.text).toContain("would exceed total limit 5");
});

test("a payment to this wallet itself uses none of the total", async () => {
  const r = await review({ to: ME, amount: "0.5", asset: "USDC" }, ctx(node(), { USDC: "4.9" }));
  expect(r.tone).toBe("ok");
  expect(r.steps[0]!.text).toContain("to itself, so it uses none of the total");
});

test("a passed review carries a quote: fee, total and what stays", async () => {
  const balance = async () => ({ units: toWei("10"), decimals: 18 });
  const r = await review({ to: ME, amount: "0.1", asset: "USDC" }, { ...ctx(), balance });
  expect(r.quote).toEqual({
    amount: "0.1 USDC",
    to: "This Wallet",
    fee: "about 0.000525 USDC",
    total: "0.100525 USDC",
    after: "9.99 USDC",
  });
});

test("a payment the node would reject stops at the rehearsal", async () => {
  const n = node();
  const { RpcError } = await import("../src/lib/server/arc.ts");
  n.simulateCall.mockRejectedValueOnce(new RpcError("eth_call: insufficient funds", { message: "insufficient funds" }));
  const r = await review({ to: ME, amount: "0.1", asset: "USDC" }, ctx(n));
  expect(r).toMatchObject({ tone: "bad", title: "The Chain Would Reject This" });
  expect(r.steps.map((s) => s.label)).toEqual(["Mandate", "Rehearsal"]);
  expect(n.gasPrice).not.toHaveBeenCalled();
});

test("the form is read as trimmed strings, USDC by default", () => {
  const f = new FormData();
  f.set("to", `  ${ME} `);
  f.set("amount", "0.1 ");
  expect(readForm(f)).toEqual({ to: ME, amount: "0.1", asset: "USDC" });
});
