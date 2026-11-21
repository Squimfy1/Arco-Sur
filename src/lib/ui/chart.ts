/**
 * Draw the balance history. The backend says where each point sits as a
 * fraction (0..1) of the chart; this file alone decides the chart's size
 * and shape. Layout arithmetic only: no amount is computed here, the labels
 * the backend wrote carry the money.
 */

import type { History } from "../contract.ts";

export type Drawn = { line: string; area: string };

/** A step line (a balance holds until the next change) and the area under it. */
export function draw(points: History["points"], width: number, height: number, pad = 12): Drawn {
  const x = (f: number) => (f * width).toFixed(1);
  const y = (f: number) => (pad + (1 - f) * (height - 2 * pad)).toFixed(1);
  const [first, ...rest] = points;
  if (first === undefined) return { line: "", area: "" };
  let line = `M${x(first.x)},${y(first.y)}`;
  for (const p of rest) line += ` H${x(p.x)} V${y(p.y)}`;
  return { line, area: `${line} V${height} H0 Z` };
}
