/**
 * Read everything the screens show, on the server, once per refresh.
 *
 * Every screen (portfolio, operations, send, receive, swap, rules) shares
 * this one reading, so they can never disagree with each other. The screens
 * never talk to the chain and never see the key: this file reads the chain
 * and the evidence log with the same code the CLI uses, then buildView turns
 * the readings into the data contract (src/lib/contract.ts).
 */

import { existsSync } from "node:fs";

import { error } from "@sveltejs/kit";

import { NoKeyError, readAccount } from "#lib/server/account.ts";
import * as arc from "#lib/server/arc.ts";
import { TOKENS } from "#lib/server/contracts.ts";
import { walletMandate } from "#lib/server/mandate.ts";
import { remembering } from "#lib/server/memo.ts";
import { LOG_FILE } from "#lib/server/paths.ts";
import { tokenBalance } from "#lib/server/read.ts";
import { type Report, readLog, reconcile } from "#lib/server/reconcile.ts";
import { alreadySent } from "#lib/server/send.ts";
import { buildView } from "#lib/server/view.ts";

import type { LayoutServerLoad } from "./$types";

// One per server process: in the desktop app, for as long as it is open.
const chain = remembering(arc);

/** The native balance where it changed: before the first send, after each mined one, and now. */
async function balanceHistory(me: string, report: Report, now: bigint | null) {
  const blocks = new Set<bigint>();
  for (const s of report.senders) if (s.balance !== null) blocks.add(s.balance.startBlock);
  for (const r of report.rows) if (r.block !== null) blocks.add(r.block);
  if (now !== null) blocks.add(now);
  const read = await Promise.all([...blocks].map(async (block) => ({ block, wei: await chain.balanceAt(me, block) })));
  return read.filter((p): p is { block: bigint; wei: bigint } => p.wei !== null);
}

export const load: LayoutServerLoad = async () => {
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
      reconcile(lines, chain),
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
      history: await balanceHistory(me, report, block),
    });
  } catch (e) {
    if (e instanceof arc.RpcError) {
      error(502, `The Arc node did not answer: ${e.message}`);
    }
    throw e;
  }
};
