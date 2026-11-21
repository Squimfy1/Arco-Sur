/**
 * The mosaic wall's geometry: where the mark sits, which tiles are the
 * mark, and that the per-tile variation is stable. The drawing and the
 * pointer are the browser's; this is the part that can be wrong silently.
 */

import { expect, test } from "vitest";

import { CROSS_BOX } from "../src/lib/ui/cross.ts";
import { channels, hash, mix, place, wall } from "../src/lib/ui/mosaic.ts";

test("the mark is placed at the given height and centre, inside the wall", () => {
  const at = place(200, 50, CROSS_BOX.w / CROSS_BOX.h, 0.84, 0.72);
  expect(at.height).toBeCloseTo(42);
  expect(at.width).toBeCloseTo(42 * (245 / 550));
  expect(at.left + at.width / 2).toBeCloseTo(144);
  expect(at.top).toBeCloseTo(4);
  expect(at.left).toBeGreaterThan(0);
  expect(at.left + at.width).toBeLessThan(200);
});

test("tiles inside the mark's box ask the mark; the rest are field", () => {
  // A stand-in mark: the left half of its box.
  const at = { left: 2, top: 2, width: 4, height: 4 };
  const tiles = wall(8, 8, at, (u) => u < 0.5);
  const row = (y: number) => tiles.slice(y * 8, y * 8 + 8).map((t) => (t.kind === "mark" ? "#" : "."));
  expect(row(0).join("")).toBe("........");
  expect(row(3).join("")).toBe("..##....");
  expect(row(7).join("")).toBe("........");
  expect(tiles.filter((t) => t.kind === "mark")).toHaveLength(8);
});

test("the predicate is only asked about points inside the mark's box", () => {
  const asked: [number, number][] = [];
  wall(10, 10, { left: 3, top: 3, width: 4, height: 4 }, (u, v) => {
    asked.push([u, v]);
    return false;
  });
  expect(asked).toHaveLength(16);
  expect(asked.every(([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1)).toBe(true);
});

test("each tile's grain and glass colour are stable and in range", () => {
  const a = wall(20, 10, place(20, 10, 0.5), () => true);
  const b = wall(20, 10, place(20, 10, 0.5), () => true);
  expect(a).toEqual(b);
  expect(a.every((t) => t.grain >= 0 && t.grain < 1 && Number.isInteger(t.glass) && t.glass >= 0 && t.glass < 6)).toBe(true);
  expect(new Set(a.map((t) => t.glass)).size).toBe(6);
  expect(hash(3, 4)).toBe(hash(3, 4));
  expect(hash(3, 4)).not.toBe(hash(4, 3));
});

test("colours: theme hex to channels, and blending between two", () => {
  expect(channels("#f2232b")).toEqual([242, 35, 43]);
  expect(channels(" #000000 ")).toEqual([0, 0, 0]);
  expect(channels("not a colour")).toEqual([0, 0, 0]);
  expect(mix([0, 0, 0], [200, 100, 50], 0.5)).toBe("rgb(100 50 25)");
  expect(mix([10, 20, 30], [200, 100, 50], 0)).toBe("rgb(10 20 30)");
});
