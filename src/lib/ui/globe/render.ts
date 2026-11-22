// The Home header's globe, drawn as a grid of small cubes in five purples,
// turning slowly, with agents flying between money centres. Only its top
// shows: the rest is below the header's edge. Under the pointer the cubes
// change colour. Colours are read from theme.css (--globe-*), never written
// here.

import { isLand } from "./land.ts";
import { AGENTS, PLACES, flight, slerp } from "./places.ts";

const CELL = 8; // one cube and its gap, in CSS pixels
const GAP = 1.5;
const TILT = 22; // degrees the north pole leans toward the viewer
const SPIN = 5; // degrees per second
const HOVER_RADIUS = 120;
const TRAIL = 7;
const STAR_SHARE = 0.05; // how many empty cells hold a star
const STAR = 1.5; // a star's size, in CSS pixels
const STAR_BIG = 2.5;
const RAD = Math.PI / 180;
// Light from the upper left, toward the viewer.
const LIGHT = [-0.45, 0.55, 0.7] as const;

type Palette = { shades: string[]; hot: string[]; agent: string; agentHot: string; bg: string; stars: string[] };

function palette(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    shades: [1, 2, 3, 4, 5].map((i) => v(`--globe-${i}`)),
    hot: [1, 2, 3, 4, 5].map((i) => v(`--globe-hot-${i}`)),
    agent: v("--globe-agent"),
    agentHot: v("--globe-agent-hot"),
    bg: v("--globe-bg"),
    stars: [v("--globe-star-dim"), v("--globe-star")],
  };
}

/** A steady pseudo-random number in [0, 1) for a cell, so the texture holds still. */
function hash(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Start drawing on `canvas`. Returns a function that stops it. */
export function startGlobe(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let colours = palette(canvas);
  let W = 0;
  let H = 0;
  let dpr = 1;
  let lam = -20; // the longitude facing the viewer
  let pointer: { x: number; y: number } | null = null;
  let heat = 0; // 0 to 1: how far the hover colour has spread
  let last = performance.now();
  let raf = 0;
  let visible = true;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    W = r.width;
    H = r.height;
    if (still) draw(0);
  };

  // One list of rectangles per colour, so each colour is set once a frame.
  const buckets = new Map<string, number[]>();
  const put = (colour: string | undefined, x: number, y: number, size: number) => {
    if (!colour) return;
    let list = buckets.get(colour);
    if (!list) buckets.set(colour, (list = []));
    list.push(x, y, size);
  };

  function draw(t: number) {
    const R = Math.max(H * 0.9, W * 0.33);
    const cx = W * 0.76;
    const cy = H * 0.2 + R;
    const sinT = Math.sin(TILT * RAD);
    const cosT = Math.cos(TILT * RAD);
    const cols = Math.ceil(W / CELL);
    const rows = Math.ceil(H / CELL);
    const size = CELL - GAP;
    const reach = HOVER_RADIUS * (0.35 + 0.65 * heat);
    buckets.clear();

    const hovered = (x: number, y: number, i: number, j: number) => {
      if (!pointer || heat < 0.02) return false;
      const d = Math.hypot(x - pointer.x, y - pointer.y);
      // A ragged edge, cube by cube, like characters in ASCII art.
      return d < reach * (0.75 + 0.35 * hash(j, i));
    };

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * CELL + CELL / 2;
        const y = j * CELL + CELL / 2;
        const dx = (x - cx) / R;
        const dy = (cy - y) / R;
        const d2 = dx * dx + dy * dy;
        const hot = hovered(x, y, i, j);
        const set = hot ? colours.hot : colours.shades;
        const n = hash(i, j);

        if (d2 > 1) {
          // Outside the globe: stars, tiny white squares scattered off the
          // grid, each fading in and out on its own beat.
          if (n < STAR_SHARE) {
            const beat = Math.sin(t * (0.6 + n * 20) + n * 900);
            if (beat > -0.2) {
              const star = n < STAR_SHARE / 4 ? STAR_BIG : STAR;
              const jx = (hash(j, i) - 0.5) * (CELL - star);
              const jy = (hash(i + 7, j + 3) - 0.5) * (CELL - star);
              put(colours.stars[beat > 0.5 ? 1 : 0], x + jx - star / 2, y + jy - star / 2, star);
            }
          }
          continue;
        }

        const z = Math.sqrt(1 - d2);
        // Back from the screen to longitude and latitude.
        const sinLat = cosT * dy + sinT * z;
        const lat = Math.asin(Math.max(-1, Math.min(1, sinLat))) / RAD;
        const lon = Math.atan2(dx, cosT * z - sinT * dy) / RAD + lam;
        const lit = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + z * LIGHT[2]);

        let shade: number;
        if (isLand(lon, lat)) shade = lit > 0.86 ? 4 : lit > 0.55 ? 3 : 2;
        else {
          const grid = Math.abs(((lon % 30) + 30) % 30) < 1.2 || Math.abs(((lat % 30) + 30) % 30) < 1.2;
          shade = grid && lit > 0.25 ? 1 : 0;
          if (!grid && n > 0.55 + lit * 0.4) continue; // the sea is sparse
        }
        // The edge of the disc darkens, as a sphere does.
        if (z < 0.18) shade = Math.max(0, shade - 1);
        put(set[shade], x - size / 2, y - size / 2, size);
      }
    }

    const toScreen = (lon: number, lat: number, alt: number) => {
      const l = (lon - lam) * RAD;
      const p = lat * RAD;
      const cl = Math.cos(p);
      return {
        x: cx + R * alt * cl * Math.sin(l),
        y: cy - R * alt * (cosT * Math.sin(p) - sinT * cl * Math.cos(l)),
        z: sinT * Math.sin(p) + cosT * cl * Math.cos(l),
      };
    };
    const snap = (v: number) => Math.floor(v / CELL) * CELL + GAP / 2;

    // Money centres: a cube that pulses.
    for (const [k, p] of PLACES.entries()) {
      const q = toScreen(p.lon, p.lat, 1);
      if (q.z < 0.08) continue;
      const on = Math.sin(t * 2 + k) > 0;
      const hot = hovered(q.x, q.y, k, k);
      put(on ? (hot ? colours.agentHot : colours.agent) : (hot ? colours.hot : colours.shades)[4], snap(q.x), snap(q.y), size);
    }

    // Agents: the leg's path in faint cubes, a fading trail, the agent itself.
    for (let a = 0; a < AGENTS.length; a++) {
      const { from, to, f } = flight(a, t);
      const alt = (u: number) => 1 + 0.16 * Math.sin(Math.PI * u);
      for (let k = 0; k <= 24; k++) {
        const u = k / 24;
        const [lo, la] = slerp(from, to, u);
        const q = toScreen(lo, la, alt(u));
        if (q.z < 0 || u > f) continue;
        put((hovered(q.x, q.y, a, k) ? colours.hot : colours.shades)[2], snap(q.x), snap(q.y), size);
      }
      for (let k = TRAIL; k >= 1; k--) {
        const u = Math.max(0, f - k * 0.018);
        const [lo, la] = slerp(from, to, u);
        const q = toScreen(lo, la, alt(u));
        if (q.z < 0) continue;
        const set = hovered(q.x, q.y, a, k) ? colours.hot : colours.shades;
        put(set[Math.max(2, 4 - Math.floor(k / 3))], snap(q.x), snap(q.y), size);
      }
      const [lo, la] = slerp(from, to, f);
      const q = toScreen(lo, la, alt(f));
      if (q.z < 0) continue;
      const big = CELL + size; // the agent is a cube twice the size
      put(hovered(q.x, q.y, a, a) || heat > 0.5 ? colours.agentHot : colours.agent, snap(q.x) - CELL / 2, snap(q.y) - CELL / 2, big);
    }

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.fillStyle = colours.bg;
    ctx!.fillRect(0, 0, W, H);
    for (const [colour, list] of buckets) {
      ctx!.fillStyle = colour;
      ctx!.beginPath();
      for (let k = 0; k < list.length; k += 3) ctx!.rect(list[k]!, list[k + 1]!, list[k + 2]!, list[k + 2]!);
      ctx!.fill();
    }
  }

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lam += dt * SPIN;
    heat += ((pointer ? 1 : 0) - heat) * Math.min(1, dt * 5);
    draw(now / 1000);
    raf = visible ? requestAnimationFrame(frame) : 0;
  };

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (still) {
      heat = 1;
      draw(0);
    }
  };
  const onLeave = () => {
    pointer = null;
    if (still) {
      heat = 0;
      draw(0);
    }
  };

  // Stop drawing while the header is scrolled out of view.
  const seen = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible && !raf && !still) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });
  // Pick up new colours when the look changes on the Settings screen.
  const looks = new MutationObserver(() => {
    colours = palette(canvas);
    if (still) draw(0);
  });
  const sized = new ResizeObserver(resize);

  resize();
  sized.observe(canvas);
  seen.observe(canvas);
  looks.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  if (!still) raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    sized.disconnect();
    seen.disconnect();
    looks.disconnect();
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
  };
}
