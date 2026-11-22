/**
 * Monthly limits: how much of each asset may leave this wallet in one
 * calendar month, set on the Settings screen.
 *
 * They are rules, not looks, so they live here on the server, in one small
 * file (settings/limits.json, kept out of git), and the guard reads them
 * through walletMandate(): the app, `npm run send` and every swap obey the
 * same numbers. Payments to the wallet itself never count (they never
 * leave); approvals do, since a swap spends.
 *
 * A month is the calendar month on this computer's clock: the count starts
 * again at midnight on the 1st.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { ARC_USDC_DECIMALS, toUnits } from "./guard.ts";
import { LIMITS_FILE } from "./paths.ts";

/** Each asset's monthly limit, as a decimal string ("5"). */
export type MonthlyLimits = Readonly<Record<string, string>>;

/** The assets that have a monthly limit, their decimals, and where they start. */
export const ASSETS: readonly { asset: string; decimals: number; start: string }[] = [
  { asset: "USDC", decimals: ARC_USDC_DECIMALS, start: "5" },
  { asset: "EURC", decimals: 6, start: "5" },
  { asset: "cirBTC", decimals: 8, start: "0.0005" },
];

export const DEFAULTS: MonthlyLimits = Object.fromEntries(ASSETS.map((a) => [a.asset, a.start]));

export class LimitError extends Error {
  name = "LimitError";
}

/** Check a set of limits: every asset present, each a positive amount it can hold. Returns them tidied. */
export function checkLimits(input: Record<string, unknown>): MonthlyLimits {
  const out: Record<string, string> = {};
  for (const { asset, decimals } of ASSETS) {
    const raw = input[asset];
    const text = typeof raw === "string" ? raw.trim() : "";
    let units: bigint;
    try {
      units = toUnits(text, decimals);
    } catch {
      throw new LimitError(text === "" ? `${asset}: no limit given` : `${asset}: ${JSON.stringify(text)} is not an amount`);
    }
    if (units <= 0n) {
      throw new LimitError(`${asset}: the limit must be more than zero`);
    }
    out[asset] = text.replace(/^0+(?=\d)/, "");
  }
  return Object.freeze(out);
}

/** The limits in force: the saved ones, or the starting ones if none are saved or the file is unreadable. */
export function loadLimits(file = LIMITS_FILE): MonthlyLimits {
  if (!existsSync(file)) return DEFAULTS;
  try {
    return checkLimits({ ...DEFAULTS, ...(JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) });
  } catch {
    return DEFAULTS;
  }
}

export function saveLimits(limits: Record<string, unknown>, file = LIMITS_FILE): MonthlyLimits {
  const checked = checkLimits(limits);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(checked, null, 2)}\n`);
  return checked;
}

/** The start of the calendar month `now` is in, in seconds, on this computer's clock. */
export function monthStart(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
}
