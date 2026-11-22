/**
 * The mandate this wallet runs under: one definition, read by the CLI
 * (send.ts) and by the web page, so the two can never disagree about it.
 *
 * This account may pay ITSELF, up to 1 USDC per payment, 1 EURC per payment
 * and 0.0001 cirBTC per payment (the faucet gives 0.0001 at a time).
 * Payments to itself never leave the wallet, so they do not use the totals.
 *
 * It may approve ONE spender, Circle's swap contract, for exactly one swap's
 * amount at a time, never more than one payment's worth.
 *
 * The totals are MONTHLY limits, set on the Settings screen (limits.ts):
 * how much of each asset may leave in one calendar month. Approvals count
 * toward them, since a swap really spends. A limit below one payment's worth
 * lowers the per-payment limit to match.
 */

import { CHAIN_ID } from "./arc.ts";
import { CIRBTC, EURC, SWAP_ADAPTER } from "./contracts.ts";
import { type Mandate, makeMandate, toUnits } from "./guard.ts";
import { ASSETS, type MonthlyLimits, loadLimits } from "./limits.ts";

const PER_PAYMENT: Record<string, string> = { USDC: "1", EURC: "1", cirBTC: "0.0001" };

/** One payment's worth, never above the month's whole limit. */
function perPayment(asset: string, monthly: string): string {
  const decimals = ASSETS.find((a) => a.asset === asset)?.decimals ?? 18;
  const usual = PER_PAYMENT[asset] ?? monthly;
  return toUnits(monthly, decimals) < toUnits(usual, decimals) ? monthly : usual;
}

export function walletMandate(me: string, limits: MonthlyLimits = loadLimits()): Mandate {
  const monthly = (asset: string) => limits[asset] ?? "0";
  return makeMandate({
    allowedRecipients: [me],
    maxAmountUsdc: perPayment("USDC", monthly("USDC")),
    maxTotalUsdc: monthly("USDC"),
    chainId: CHAIN_ID,
    tokens: [
      { address: EURC.address, symbol: "EURC", decimals: 6, maxAmount: perPayment("EURC", monthly("EURC")), maxTotal: monthly("EURC") },
      { address: CIRBTC.address, symbol: "cirBTC", decimals: 8, maxAmount: perPayment("cirBTC", monthly("cirBTC")), maxTotal: monthly("cirBTC") },
    ],
    allowedSpenders: [SWAP_ADAPTER.address],
  });
}
