/**
 * Swap from the app. The body is {from, to, amount}; a FRESH quote is taken
 * here, right before signing, since a quote expires in minutes. The answer
 * is a stream of Progress events (src/lib/server/progress.ts).
 */

import { json } from "@sveltejs/kit";

import { loadAccount } from "#lib/server/account.ts";
import { walletMandate } from "#lib/server/mandate.ts";
import { swapWithProgress } from "#lib/server/progress.ts";
import { progressStream } from "#lib/server/stream.ts";
import { SwapError, quoteSwap, readSwap } from "#lib/server/swap.ts";

import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const asked = readSwap(await request.json().catch(() => ({})));
  const account = loadAccount();
  let quote;
  try {
    quote = await quoteSwap(asked, account.address);
  } catch (e) {
    if (e instanceof SwapError) return json({ error: e.message }, { status: 400 });
    throw e;
  }
  return progressStream((emit) => swapWithProgress(quote, { account, mandate: walletMandate(account.address) }, emit));
};
