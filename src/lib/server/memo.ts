/**
 * Remember what the chain can no longer change.
 *
 * A mined transaction, its receipt, and a balance at a past block are
 * permanent (Arc blocks are final once made). The desktop app keeps one
 * server running for as long as the window is open, so it asks for each of
 * those once, and a Refresh only asks for what can still move: the latest
 * block, balances, nonces, and anything still pending.
 *
 * Only answers that are final are kept. A pending transaction (no block
 * yet), a missing receipt, or "latest" is asked again every time.
 */

import type { ChainTx, Receipt } from "./arc.ts";
import type { Chain } from "./reconcile.ts";

export function remembering(chain: Chain): Chain {
  const txs = new Map<string, ChainTx>();
  const receipts = new Map<string, Receipt>();
  const balances = new Map<string, bigint>();

  return {
    async transaction(hash) {
      const known = txs.get(hash);
      if (known) return known;
      const tx = await chain.transaction(hash);
      if (tx !== null && tx.blockNumber !== null) txs.set(hash, tx);
      return tx;
    },
    async receipt(hash) {
      const known = receipts.get(hash);
      if (known) return known;
      const r = await chain.receipt(hash);
      if (r !== null && r.blockNumber !== undefined) receipts.set(hash, r);
      return r;
    },
    nonce: (address) => chain.nonce(address),
    async balanceAt(address, block) {
      if (block === "latest") return chain.balanceAt(address, block);
      const key = `${address.toLowerCase()}@${block}`;
      const known = balances.get(key);
      if (known !== undefined) return known;
      const wei = await chain.balanceAt(address, block);
      if (wei !== null) balances.set(key, wei);
      return wei;
    },
  };
}
