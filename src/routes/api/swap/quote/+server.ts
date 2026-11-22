/** Price a swap for the Swap screen: Circle's quote, worded. Nothing is signed. */

import { json } from "@sveltejs/kit";

import { readAccount } from "#lib/server/account.ts";
import { quoteView } from "#lib/server/progress.ts";
import { SwapError, quoteSwap, readSwap } from "#lib/server/swap.ts";

import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const asked = readSwap(await request.json().catch(() => ({})));
  try {
    return json({ quote: quoteView(await quoteSwap(asked, readAccount().address)) });
  } catch (e) {
    if (e instanceof SwapError) return json({ error: e.message }, { status: 400 });
    throw e;
  }
};
