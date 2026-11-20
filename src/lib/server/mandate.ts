/**
 * The mandate this wallet runs under: one definition, read by the CLI
 * (send.ts) and by the web page, so the two can never disagree about it.
 *
 * This account may pay ITSELF, up to 1 USDC per payment (5 total) and up to
 * 1 EURC per payment (5 total). It may approve no one.
 */

import { CHAIN_ID } from "./arc.ts";
import { EURC } from "./contracts.ts";
import { type Mandate, makeMandate } from "./guard.ts";

export function walletMandate(me: string): Mandate {
  return makeMandate({
    allowedRecipients: [me],
    maxAmountUsdc: "1",
    maxTotalUsdc: "5",
    chainId: CHAIN_ID,
    tokens: [{ address: EURC.address, symbol: "EURC", decimals: 6, maxAmount: "1", maxTotal: "5" }],
    allowedSpenders: [],
  });
}
