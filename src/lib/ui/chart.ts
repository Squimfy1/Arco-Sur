/**
 * Draw the balance history. The backend says where each point sits as a
 * fraction (0..1) of the chart; this file alone decides the chart's size
 * and shape. Layout arithmetic only: no amount is computed here, the labels
 * the backend wrote carry the money.
 */

type Place = { x: number; y: number };

export type Drawn = { line: string; area: string };

/** A step line (a balance holds until the next change) and the area under it. */
export function draw(points: readonly Place[], width: number, height: number, pad = 12): Drawn {
  const x = (f: number) => (f * width).toFixed(1);
  const y = (f: number) => (pad + (1 - f) * (height - 2 * pad)).toFixed(1);
  const [first, ...rest] = points;
  if (first === undefined) return { line: "", area: "" };
  let line = `M${x(first.x)},${y(first.y)}`;
  for (const p of rest) line += ` H${x(p.x)} V${y(p.y)}`;
  return { line, area: `${line} V${height} H0 Z` };
}

/**
 * Where a place sits as percentages of the plot, for HTML laid over the
 * drawing (labels, the hover dot). `edge` keeps labels off the very sides.
 */
export function percent(place: Place, height: number, pad = 12, edge = 0): { left: string; top: string } {
  const left = Math.min(100 - edge, Math.max(edge, place.x * 100));
  const top = ((pad + (1 - place.y) * (height - 2 * pad)) / height) * 100;
  return { left: `${left.toFixed(2)}%`, top: `${top.toFixed(2)}%` };
}

/** Which point's balance holds at a place across the chart (0..1): the last one at or before it. */
export function at(points: readonly Place[], fx: number): number {
  let i = 0;
  for (let k = 0; k < points.length; k++) if (points[k]!.x <= fx) i = k;
  return i;
}

/** A straight line through every point (a rate or a total moving day to day) and the area under it. */
export function drawLine(points: readonly Place[], width: number, height: number, pad = 12): Drawn {
  const x = (f: number) => (f * width).toFixed(1);
  const y = (f: number) => (pad + (1 - f) * (height - 2 * pad)).toFixed(1);
  const [first, ...rest] = points;
  if (first === undefined) return { line: "", area: "" };
  let line = `M${x(first.x)},${y(first.y)}`;
  for (const p of rest) line += ` L${x(p.x)},${y(p.y)}`;
  const last = points[points.length - 1]!;
  return { line, area: `${line} L${x(last.x)},${height} L${x(first.x)},${height} Z` };
}

/** Which point is nearest a place across the chart (0..1). */
export function nearest(points: readonly Place[], fx: number): number {
  let best = 0;
  for (let k = 1; k < points.length; k++) if (Math.abs(points[k]!.x - fx) < Math.abs(points[best]!.x - fx)) best = k;
  return best;
}
