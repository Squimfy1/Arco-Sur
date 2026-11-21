/**
 * The mosaic wall: the Cathedral cross, set in small square tiles on a field
 * of dark ones.
 *
 * This file is the geometry, as plain maths so it can be tested: which tile
 * belongs to the mark and which to the field. Mosaic.svelte draws it and
 * lights tiles where the pointer passes. The mark itself is the cross from
 * the Cathedral logo (cross.ts); this file only places it, and asks a
 * predicate whether a point of the mark's own drawing is inside it.
 */

export type Kind = "field" | "mark";

export type Tile = {
  kind: Kind;
  /** 0..1, a stable per-tile variation, so the field reads as stone, not paint. */
  grain: number;
  /** Which stained-glass colour this tile takes when lit: 0..5. */
  glass: number;
};

/** A stable pseudo-random number in 0..1 for a tile. Same tile, same value. */
export function hash(x: number, y: number, seed = 0): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Where the mark sits on the wall, in tiles. */
export type Placement = { left: number; top: number; width: number; height: number };

/**
 * Place a mark of the given aspect (width / height) so it is `fill` of the
 * wall's height, its middle at `centre` of the width.
 */
export function place(cols: number, rows: number, aspect: number, fill = 0.82, centre = 0.5): Placement {
  const height = rows * fill;
  const width = height * aspect;
  return { left: cols * centre - width / 2, top: (rows - height) / 2, width, height };
}

/**
 * The whole wall as tiles, row by row. `inMark(u, v)` answers for a point
 * of the mark in 0..1 across and down its own box.
 */
export function wall(cols: number, rows: number, at: Placement, inMark: (u: number, v: number) => boolean): Tile[] {
  const tiles: Tile[] = [];
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      // Sample each tile at its centre, in the mark's own 0..1 box.
      const u = (tx + 0.5 - at.left) / at.width;
      const v = (ty + 0.5 - at.top) / at.height;
      const mark = u >= 0 && u <= 1 && v >= 0 && v <= 1 && inMark(u, v);
      tiles.push({ kind: mark ? "mark" : "field", grain: hash(tx, ty), glass: Math.floor(hash(tx, ty, 9) * 6) });
    }
  }
  return tiles;
}

/** "#rrggbb" to [r, g, b]. Anything else is black, never a crash. */
export function channels(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** a + (b - a) × t, per channel, as a CSS colour. */
export function mix(a: readonly number[], b: readonly number[], t: number): string {
  const c = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * t);
  return `rgb(${c(0)} ${c(1)} ${c(2)})`;
}
