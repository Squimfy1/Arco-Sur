// What moves on the Home header's globe: money centres, and agents flying
// loops between them. A picture of payments crossing the world, not data:
// none of it comes from the chain. The idea and the great-circle flight are
// from the Trading globe in the Cathedral app (azoth-library AgentGlobe).

export type Place = { id: string; lon: number; lat: number };

export const PLACES: Place[] = [
  { id: "new-york", lon: -74, lat: 40.7 },
  { id: "mexico-city", lon: -99.1, lat: 19.4 },
  { id: "sao-paulo", lon: -46.6, lat: -23.5 },
  { id: "buenos-aires", lon: -58.4, lat: -34.6 },
  { id: "london", lon: -0.1, lat: 51.5 },
  { id: "zurich", lon: 8.5, lat: 47.4 },
  { id: "lagos", lon: 3.4, lat: 6.5 },
  { id: "nairobi", lon: 36.8, lat: -1.3 },
  { id: "dubai", lon: 55.3, lat: 25.2 },
  { id: "mumbai", lon: 72.9, lat: 19.1 },
  { id: "singapore", lon: 103.8, lat: 1.3 },
  { id: "hong-kong", lon: 114.2, lat: 22.3 },
  { id: "tokyo", lon: 139.8, lat: 35.7 },
  { id: "sydney", lon: 151.2, lat: -33.9 },
  { id: "san-francisco", lon: -122.4, lat: 37.8 },
];

/** Each agent flies its loop of places, one leg every LEG_SECONDS. */
export const AGENTS: string[][] = [
  ["new-york", "london", "zurich", "dubai", "mumbai", "singapore"],
  ["tokyo", "hong-kong", "singapore", "sydney"],
  ["london", "lagos", "nairobi", "dubai", "zurich"],
  ["mexico-city", "sao-paulo", "buenos-aires", "new-york", "san-francisco"],
  ["san-francisco", "tokyo", "hong-kong", "mumbai", "london", "new-york"],
  ["buenos-aires", "lagos", "london", "new-york", "mexico-city"],
  ["singapore", "sydney", "san-francisco", "new-york"],
];

export const LEG_SECONDS = 9;

const place = (id: string): Place => PLACES.find((p) => p.id === id) ?? PLACES[0]!;

/** Where agent `n` is at time `t` (seconds): the leg it is on and how far along, 0 to 1. */
export function flight(n: number, t: number): { from: Place; to: Place; f: number } {
  const route = AGENTS[n] ?? AGENTS[0]!;
  const legs = t / LEG_SECONDS + n * 0.37;
  const i = Math.floor(legs) % route.length;
  const raw = legs - Math.floor(legs);
  const f = raw * raw * (3 - 2 * raw); // eases off and in at each end
  return { from: place(route[i]!), to: place(route[(i + 1) % route.length]!), f };
}

const RAD = Math.PI / 180;

/** The point a fraction `f` of the way along the great circle from a to b. */
export function slerp(a: Place, b: Place, f: number): [number, number] {
  const v = (p: Place) => [Math.cos(p.lat * RAD) * Math.cos(p.lon * RAD), Math.cos(p.lat * RAD) * Math.sin(p.lon * RAD), Math.sin(p.lat * RAD)];
  const [p, q] = [v(a), v(b)];
  const dot = Math.min(1, Math.max(-1, p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!));
  const w = Math.acos(dot);
  if (w < 1e-6) return [a.lon, a.lat];
  const s1 = Math.sin((1 - f) * w) / Math.sin(w);
  const s2 = Math.sin(f * w) / Math.sin(w);
  const [x, y, z] = [s1 * p[0]! + s2 * q[0]!, s1 * p[1]! + s2 * q[1]!, s1 * p[2]! + s2 * q[2]!];
  return [Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD];
}
