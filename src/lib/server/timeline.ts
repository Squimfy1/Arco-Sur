/**
 * The native balance over time, read from the chain itself.
 *
 * The evidence log only knows the sends this wallet made. Money that
 * arrives (a faucet drip, a transfer from anyone) never appears in it. So
 * this asks the node what the balance was at past blocks and finds every
 * block where it changed: if two blocks show different balances, it changed
 * somewhere between them, so look at a few blocks in that stretch at once
 * and keep narrowing until the change sits on a single block.
 *
 * Arc blocks are final, so what is found never needs reading again. It is
 * kept in cache/timeline.json and each run reads only the stretch since the
 * last one. Every reading of the wallet runs this, so a send or an incoming
 * payment shows as soon as its block exists.
 *
 * One known limit: a balance that changes and changes back between two
 * looks (+5 then -5 and nothing else) shows the same value at both ends and
 * is not seen. Every block in the evidence log is always looked at, so the
 * wallet's own sends are never missed this way.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** From `block` on, the balance was `wei`; `time` is that block's time in seconds. */
export type Change = { block: bigint; wei: bigint; time: bigint };

export type Timeline = { address: string; upTo: bigint; changes: Change[] };

export type TimelineChain = {
  balanceAt(address: string, block: bigint): Promise<bigint | null>;
  blockTime(block: bigint): Promise<bigint | null>;
};

type Seen = { block: bigint; wei: bigint };

// How many blocks to look at at once inside a stretch. Eight looks per round
// narrow 73 million blocks to one in about nine rounds.
const SPLIT = 8n;

class Unanswered extends Error {}

// The public node turns away bursts (HTTP 429), so at most this many
// questions are in flight, and a turned-away one waits and asks again.
const AT_ONCE = 4;
const RETRIES = 6;
let inFlight = 0;
const waiting: (() => void)[] = [];

async function politely<T>(ask: () => Promise<T>): Promise<T> {
  while (inFlight >= AT_ONCE) await new Promise<void>((go) => waiting.push(go));
  inFlight++;
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        return await ask();
      } catch (e) {
        if (attempt >= RETRIES || !String((e as Error).message).includes("429")) throw e;
        await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
      }
    }
  } finally {
    inFlight--;
    waiting.shift()?.();
  }
}

async function seen(chain: TimelineChain, address: string, block: bigint): Promise<Seen> {
  const wei = await politely(() => chain.balanceAt(address, block));
  if (wei === null) throw new Unanswered(`no balance for block ${block}`);
  return { block, wei };
}

/** Every block after `lo` and up to `hi` where the balance takes a new value. */
async function changesBetween(chain: TimelineChain, address: string, lo: Seen, hi: Seen): Promise<Seen[]> {
  if (lo.wei === hi.wei) return [];
  const gap = hi.block - lo.block;
  if (gap <= 1n) return [hi];
  const looks = gap - 1n < SPLIT ? gap - 1n : SPLIT;
  const step = gap / (looks + 1n);
  const inside = await Promise.all(
    Array.from({ length: Number(looks) }, (_, i) => seen(chain, address, lo.block + step * BigInt(i + 1))),
  );
  const marks = [lo, ...inside, hi];
  const parts = await Promise.all(marks.slice(1).map((m, i) => changesBetween(chain, address, marks[i]!, m)));
  return parts.flat();
}

/**
 * The timeline up to `head`, starting from what was already known. `always`
 * lists blocks that must be looked at (the ones in the evidence log), with
 * the block before each, so the wallet's own sends are never skipped.
 * If the node fails to answer, nothing new is kept: the old timeline returns.
 */
export async function extend(
  chain: TimelineChain,
  address: string,
  known: Timeline | null,
  head: bigint,
  always: readonly bigint[] = [],
): Promise<Timeline> {
  const prev = known && known.address.toLowerCase() === address.toLowerCase() ? known : null;
  const from = prev ? prev.upTo : 0n;
  if (head <= from && prev) return prev;
  try {
    const startWei = prev ? (prev.changes.at(-1)?.wei ?? 0n) : (await seen(chain, address, 0n)).wei;
    const blocks = new Set<bigint>([head]);
    for (const b of always) {
      if (b > from && b < head) blocks.add(b);
      if (b - 1n > from && b - 1n < head) blocks.add(b - 1n);
    }
    const marks = [{ block: from, wei: startWei }, ...(await Promise.all([...blocks].sort(cmp).map((b) => seen(chain, address, b))))];
    const found = (await Promise.all(marks.slice(1).map((m, i) => changesBetween(chain, address, marks[i]!, m)))).flat();
    if (!prev && startWei !== 0n) found.unshift({ block: 0n, wei: startWei });
    const changes = await Promise.all(
      found.map(async (c) => {
        const time = await politely(() => chain.blockTime(c.block));
        if (time === null) throw new Unanswered(`no time for block ${c.block}`);
        return { ...c, time };
      }),
    );
    return { address, upTo: head, changes: [...(prev?.changes ?? []), ...changes] };
  } catch (e) {
    // The node did not answer (or kept turning us away): keep what was known.
    if (!(e instanceof Unanswered) && !String((e as Error).message).includes("HTTP")) throw e;
    return prev ?? { address, upTo: 0n, changes: [] };
  }
}

const cmp = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

// --- the file -------------------------------------------------------------

type Stored = { address: string; upTo: string; changes: { block: string; wei: string; time: string }[] };

export function load(file: string): Timeline | null {
  if (!existsSync(file)) return null;
  try {
    const s = JSON.parse(readFileSync(file, "utf8")) as Stored;
    return {
      address: s.address,
      upTo: BigInt(s.upTo),
      changes: s.changes.map((c) => ({ block: BigInt(c.block), wei: BigInt(c.wei), time: BigInt(c.time) })),
    };
  } catch {
    return null; // a damaged file is read again from the chain
  }
}

export function save(file: string, t: Timeline): void {
  const s: Stored = {
    address: t.address,
    upTo: String(t.upTo),
    changes: t.changes.map((c) => ({ block: String(c.block), wei: String(c.wei), time: String(c.time) })),
  };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(s, null, 2) + "\n");
}

// --- the command line -----------------------------------------------------
//
//   npm run history                       the wallet in .testnet_key
//   npm run history -- --address 0x…      any address (not kept on disk)
//
// Prints every change of the native USDC balance, read from the chain, with
// the time, the block, the balance from then on, and the difference.
if (import.meta.main) {
  const { parseArgs } = await import("node:util");
  const arc = await import("./arc.ts");
  const { fromWei, normalise } = await import("./guard.ts");
  const { TIMELINE_FILE } = await import("./paths.ts");
  const { values: args } = parseArgs({ options: { address: { type: "string" } } });

  let holder = args.address;
  const own = holder === undefined;
  if (holder === undefined) {
    const { loadAccount } = await import("./account.ts");
    holder = loadAccount().address;
  }
  if (normalise(holder) === null) {
    console.error(`not an address: ${holder}`);
    process.exit(1);
  }
  const head = await arc.blockNumber();
  if (head === null) {
    console.error("the node did not say which block it is on");
    process.exit(1);
  }

  const before = own ? load(TIMELINE_FILE) : null;
  const t = await extend({ balanceAt: arc.balanceAt, blockTime: arc.blockTime }, holder, before, head);
  if (own && t !== before) save(TIMELINE_FILE, t);

  const when = (s: bigint) => new Date(Number(s) * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  console.log(`address: ${holder}  (Arc testnet, up to block ${t.upTo})\n`);
  console.log(`${"when".padEnd(24)}${"block".padEnd(11)}${"balance".padEnd(18)}change`);
  let prev = 0n;
  for (const c of t.changes) {
    const d = c.wei - prev;
    const sign = d > 0n ? "+" : "−";
    console.log(`${when(c.time).padEnd(24)}${String(c.block).padEnd(11)}${String(fromWei(c.wei)).padEnd(18)}${sign}${fromWei(d < 0n ? -d : d)}`);
    prev = c.wei;
  }
  if (t.changes.length === 0) console.log("(no balance yet)");
  if (t.upTo < head) {
    console.log("\nthe node did not answer every question; the history above may be incomplete");
    process.exitCode = 1;
  }
}
