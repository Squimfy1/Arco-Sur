/**
 * Send from the app. The body is the reviewed form ({to, amount, asset});
 * the answer is a stream of Progress events (src/lib/server/progress.ts).
 * The same build(), guard and execute() as Review and `npm run send`.
 */

import { loadAccount } from "#lib/server/account.ts";
import { walletMandate } from "#lib/server/mandate.ts";
import { sendWithProgress } from "#lib/server/progress.ts";
import { readJson } from "#lib/server/review.ts";
import { progressStream } from "#lib/server/stream.ts";

import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const form = readJson(await request.json().catch(() => ({})));
  const account = loadAccount();
  return progressStream((emit) => sendWithProgress(form, { account, mandate: walletMandate(account.address) }, emit));
};
