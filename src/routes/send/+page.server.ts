/**
 * The Send screen's action: Review. It runs the guard and a rehearsal on
 * the node (src/lib/server/review.ts) and returns what they said, with a
 * quote. It never signs: the Send button that follows posts to /api/send.
 */

import { readAccount } from "#lib/server/account.ts";
import * as arc from "#lib/server/arc.ts";
import { CIRBTC, EURC } from "#lib/server/contracts.ts";
import { tokenBalance } from "#lib/server/read.ts";
import { walletMandate } from "#lib/server/mandate.ts";
import { readForm, review } from "#lib/server/review.ts";
import { alreadySent } from "#lib/server/send.ts";

import type { Actions } from "./$types";

export const actions: Actions = {
  review: async ({ request }) => {
    const me = readAccount().address;
    const balance = async (asset: string) => {
      if (asset === "USDC") {
        const wei = await arc.balanceWei(me);
        return wei === null ? null : { units: wei, decimals: 18 };
      }
      const token = asset === "EURC" ? EURC : asset === "cirBTC" ? CIRBTC : null;
      if (token === null) return null;
      const b = await tokenBalance(token, me);
      return { units: b.raw, decimals: b.decimals };
    };
    return { review: await review(readForm(await request.formData()), { me, mandate: walletMandate(me), spent: alreadySent(me), balance }) };
  },
};
