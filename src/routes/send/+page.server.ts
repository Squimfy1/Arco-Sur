/**
 * The Send screen's one action: Review. It runs the guard and a rehearsal on
 * the node (src/lib/server/review.ts) and returns what they said. It never
 * signs; signing from the app is Stage 10.
 */

import { readAccount } from "#lib/server/account.ts";
import { walletMandate } from "#lib/server/mandate.ts";
import { readForm, review } from "#lib/server/review.ts";
import { alreadySent } from "#lib/server/send.ts";

import type { Actions } from "./$types";

export const actions: Actions = {
  review: async ({ request }) => {
    const me = readAccount().address;
    return { review: await review(readForm(await request.formData()), { me, mandate: walletMandate(me), spent: alreadySent(me) }) };
  },
};
