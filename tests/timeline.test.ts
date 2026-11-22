/**
 * The balance timeline: every block where the native balance changed, found
 * from the chain alone, and kept so only new blocks are read again.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { extend, load, save, type TimelineChain } from "../src/lib/server/timeline.ts";

const ME = "0xCbEB3dcd3A96843b0324a983658bD31393466486";

/** A fake chain whose balance steps at the given blocks; block b was made at time 2b. */
function chainWith(steps: [bigint, bigint][], fail = false) {
  let asked = 0;
  const chain: TimelineChain = {
    async balanceAt(_a, block) {
      asked++;
      if (fail) return null;
      let wei = 0n;
      for (const [b, w] of steps) if (block >= b) wei = w;
      return wei;
    },
    async blockTime(block) {
      return block * 2n;
    },
  };
  return { chain, asked: () => asked };
}

test("finds every block where the balance changed, exactly, with its time", async () => {
  const { chain } = chainWith([[1_000n, 20n], [1_017n, 40n], [500_123n, 39n], [999_998n, 79n]]);
  const t = await extend(chain, ME, null, 1_000_000n);
  expect(t.changes).toEqual([
    { block: 1_000n, wei: 20n, time: 2_000n },
    { block: 1_017n, wei: 40n, time: 2_034n },
    { block: 500_123n, wei: 39n, time: 1_000_246n },
    { block: 999_998n, wei: 79n, time: 1_999_996n },
  ]);
  expect(t.upTo).toBe(1_000_000n);
});

test("a later run reads only the new blocks and adds what changed there", async () => {
  const steps: [bigint, bigint][] = [[1_000n, 20n]];
  const { chain, asked } = chainWith(steps);
  const first = await extend(chain, ME, null, 100_000n);
  const before = asked();
  expect(await extend(chain, ME, first, 100_000n)).toBe(first); // nothing new: nothing asked
  steps.push([100_050n, 25n]); // money arrives
  const second = await extend(chain, ME, first, 100_100n);
  expect(second.changes.at(-1)).toEqual({ block: 100_050n, wei: 25n, time: 200_100n });
  expect(asked() - before).toBeLessThan(30);
});

test("the log's own blocks are always looked at, so a change and change back is not missed", async () => {
  // +5 at 2,000 and back at 2,010: both ends of the stretch look the same.
  const steps: [bigint, bigint][] = [[10n, 5n], [2_000n, 10n], [2_010n, 5n]];
  expect((await extend(chainWith(steps).chain, ME, null, 1_000_000n)).changes).toHaveLength(1);
  const seen = await extend(chainWith(steps).chain, ME, null, 1_000_000n, [2_000n]);
  expect(seen.changes.map((c) => c.block)).toEqual([10n, 2_000n, 2_010n]);
});

test("when the node does not answer, what was known is kept", async () => {
  const known = await extend(chainWith([[5n, 1n]]).chain, ME, null, 100n);
  expect(await extend(chainWith([], true).chain, ME, known, 200n)).toBe(known);
  expect(await extend(chainWith([], true).chain, ME, null, 200n)).toEqual({ address: ME, upTo: 0n, changes: [] });
});

test("the timeline survives a round trip through its file; a damaged file is read again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "timeline-"));
  const file = join(dir, "cache", "timeline.json");
  const t = await extend(chainWith([[7n, 3n]]).chain, ME, null, 50n);
  save(file, t);
  expect(load(file)).toEqual(t);
  writeFileSync(file, "{ not json");
  expect(load(file)).toBeNull();
  expect(load(join(dir, "missing.json"))).toBeNull();
});
