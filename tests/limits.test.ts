/**
 * Monthly limits: set on the Settings screen, saved on the server, read by
 * the guard. Only this calendar month's spending counts against them.
 */

import { appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { checkIntent } from "../src/lib/server/guard.ts";
import { DEFAULTS, checkLimits, loadLimits, monthStart, saveLimits } from "../src/lib/server/limits.ts";
import { walletMandate } from "../src/lib/server/mandate.ts";
import { alreadySent } from "../src/lib/server/send.ts";

const ME = "0xCbEB3dcd3A96843b0324a983658bD31393466486";
const STRANGER = "0x1111111111111111111111111111111111111111";
const temp = () => join(mkdtempSync(join(tmpdir(), "arco-limits-")), "limits.json");

test("limits must be a positive amount for every asset", () => {
  expect(checkLimits({ USDC: "50", EURC: "10", cirBTC: "0.001" })).toEqual({ USDC: "50", EURC: "10", cirBTC: "0.001" });
  expect(() => checkLimits({ USDC: "", EURC: "1", cirBTC: "0.001" })).toThrow("USDC: no limit given");
  expect(() => checkLimits({ USDC: "lots", EURC: "1", cirBTC: "0.001" })).toThrow("not an amount");
  expect(() => checkLimits({ USDC: "0", EURC: "1", cirBTC: "0.001" })).toThrow("more than zero");
  expect(() => checkLimits({ USDC: "1", EURC: "1", cirBTC: "0.000000001" })).toThrow("not an amount");
});

test("saved limits come back as saved; none saved, or a broken file, gives the starting ones", () => {
  const file = temp();
  expect(loadLimits(file)).toEqual(DEFAULTS);
  saveLimits({ USDC: "20", EURC: "3", cirBTC: "0.0002" }, file);
  expect(loadLimits(file)).toEqual({ USDC: "20", EURC: "3", cirBTC: "0.0002" });
  writeFileSync(file, "not json");
  expect(loadLimits(file)).toEqual(DEFAULTS);
});

test("the month starts at midnight on the 1st", () => {
  expect(monthStart(new Date(2026, 10, 21, 18, 30))).toBe(new Date(2026, 10, 1).getTime() / 1000);
});

test("only this month's spending counts", () => {
  const log = join(mkdtempSync(join(tmpdir(), "arco-limits-")), "sends.jsonl");
  const lastMonth = new Date(2026, 9, 20).getTime() / 1000;
  const thisMonth = new Date(2026, 10, 5).getTime() / 1000;
  appendFileSync(log, [
    { ts: lastMonth, from: ME, to: STRANGER, amount_usdc: "3", broadcast: true },
    { ts: thisMonth, from: ME, to: STRANGER, amount_usdc: "0.5", broadcast: true },
  ].map((l) => JSON.stringify(l)).join("\n") + "\n");
  expect(alreadySent(ME, log, monthStart(new Date(2026, 10, 21)))).toEqual({ USDC: "0.5" });
});

test("the guard uses the limits set: the month's limit, and a per-payment limit never above it", () => {
  const strict = walletMandate(ME, { USDC: "0.5", EURC: "5", cirBTC: "0.0005" });
  expect(strict.maxTotalUsdc).toBe("0.5");
  expect(strict.maxAmountUsdc).toBe("0.5");
  const roomy = walletMandate(ME, { USDC: "100", EURC: "5", cirBTC: "0.0005" });
  expect(roomy).toMatchObject({ maxTotalUsdc: "100", maxAmountUsdc: "1" });

  // Spending already near the month's limit: an approval for a swap that would pass it is refused.
  const approve = { kind: "approve" as const, token: "0x3600000000000000000000000000000000000000", spender: "0xBBD70b01a1CAbc96d5b7b129Ae1AAabdf50dd40b", amount: 400000n };
  const verdict = checkIntent(strict, approve, { chainId: 5042002, decimals: 6, alreadySent: { USDC: "0.2" }, sender: ME });
  expect(verdict.reason).toContain("past its total limit 0.5");
});
