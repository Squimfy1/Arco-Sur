/**
 * Stage 9: read everything the page shows, on the server, at request time.
 *
 * The browser never talks to the chain and never sees the key. This file
 * reads the chain and the evidence log with the same code the CLI uses
 * (read.ts, reconcile.ts, send.ts's spend totals), then hands the readings
 * to buildView, which turns them into finished strings.
 */

import { existsSync } from "node:fs";

import { error } from "@sveltejs/kit";

import { NoKeyError, readAccount } from "#lib/server/account.ts";
import * as arc from "#lib/server/arc.ts";
import { TOKENS } from "#lib/server/contracts.ts";
import { walletMandate } from "#lib/server/mandate.ts";
import { LOG_FILE } from "#lib/server/paths.ts";
import { tokenBalance } from "#lib/server/read.ts";
import { readLog, reconcile } from "#lib/server/reconcile.ts";
import { alreadySent } from "#lib/server/send.ts";
import { buildView } from "#lib/server/view.ts";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  let me: string;
  try {
    me = readAccount().address;
  } catch (e) {
    if (e instanceof NoKeyError) error(503, e.message);
    throw e;
  }

  try {
    const lines = existsSync(LOG_FILE) ? readLog() : [];
    const [block, nativeWei, tokens, report] = await Promise.all([
      arc.blockNumber(),
      arc.balanceWei(me),
      Promise.all(TOKENS.map(async (contract) => ({ contract, balance: await tokenBalance(contract, me) }))),
      reconcile(lines),
    ]);
    return buildView({
      me,
      readAt: new Date(),
      block,
      nativeWei,
      tokens,
      report,
      spent: alreadySent(me),
      mandate: walletMandate(me),
    });
  } catch (e) {
    if (e instanceof arc.RpcError) {
      error(502, `The Arc node did not answer: ${e.message}`);
    }
    throw e;
  }
};
