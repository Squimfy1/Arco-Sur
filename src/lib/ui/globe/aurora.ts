// The top bar: all of it the Home globe's cubes, in a gradient. The light
// purples along the top darken evenly, row by row, into the bar's own dark,
// two shades mixed by an even dither wherever they meet. The same all the
// way along. It holds still; only the pointer changes it, turning the cubes
// under it the globe's pink. Colours are read from theme.css (--globe-*),
// never written here.

const CELL = 8; // one cube and its gap, in CSS pixels, as on the globe
const GAP = 1.5;
const SIZE = CELL - GAP;
const HOVER_RADIUS = 110;
// The bar never moves on its own; this is the moment it is drawn at.
const STILL_AT = 0;
// The gradient: the top row sits between the fourth and fifth purples
// (TOP_LEVEL, counting from 0), and each row down is a step darker, falling
// LEVEL_DROP shades over the bar; past the darkest purple only LAST_SCATTER
// of the cubes remain.
const TOP_LEVEL = 3.6;
const LEVEL_DROP = 4.2;
const LAST_SCATTER = 0.25;
// Ordered dither: an even, calm way to thin cubes out.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

type Palette = { shades: string[]; hot: string[]; bg: string };

function palette(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    shades: [1, 2, 3, 4, 5].map((i) => v(`--globe-${i}`)),
    hot: [1, 2, 3, 4, 5].map((i) => v(`--globe-hot-${i}`)),
    bg: v("--globe-bg"),
  };
}

/** A steady pseudo-random number in [0, 1) for a cell. */
function hash(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Start drawing on `canvas`. Returns a function that stops it. */
export function startAurora(canvas: HTMLCanvasElement, { moving = false }: { moving?: boolean } = {}): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  // Still unless asked to move; never moving for anyone who asked for less motion.
  const still = !moving || matchMedia("(prefers-reduced-motion: reduce)").matches;
  let colours = palette(canvas);
  let W = 0;
  let H = 0;
  let dpr = 1;
  let pointer: { x: number; y: number } | null = null;
  let heat = 0;
  let last = performance.now();
  let raf = 0;

  const buckets = new Map<string, number[]>();
  const put = (colour: string | undefined, x: number, y: number, size: number) => {
    if (!colour) return;
    let list = buckets.get(colour);
    if (!list) buckets.set(colour, (list = []));
    list.push(x, y, size);
  };

  function draw(t: number) {
    const cols = Math.ceil(W / CELL);
    const rows = Math.ceil(H / CELL);
    const reach = HOVER_RADIUS * (0.35 + 0.65 * heat);
    const under = (x: number, y: number, i: number, j: number) =>
      pointer !== null && heat > 0.02 && Math.hypot(x + SIZE / 2 - pointer.x, y + SIZE / 2 - pointer.y) < reach * (0.75 + 0.35 * hash(j, i));
    buckets.clear();

    for (let j = 0; j < rows; j++) {
      // How bright this row is: the lighter purples at the top, darkening
      // evenly row by row to the bar's own dark at the bottom.
      const level = TOP_LEVEL - (j / Math.max(1, rows - 1)) * LEVEL_DROP;
      const shade = Math.floor(level);
      const between = level - shade;
      for (let i = 0; i < cols; i++) {
        const x = i * CELL + GAP / 2;
        const y = j * CELL + GAP / 2;
        const dither = BAYER[(j % 4) * 4 + (i % 4)]!;
        // Below the darkest purple, only a scatter of cubes is left.
        if (shade < 0 && dither >= LAST_SCATTER) continue;
        // Between two shades, the ordered dither mixes them evenly.
        const tone = shade < 0 ? 0 : Math.min(4, dither < between ? shade + 1 : shade);
        put((under(x, y, i, j) ? colours.hot : colours.shades)[tone], x, y, SIZE);
      }
    }
    void t; // held still: the same pattern at any moment

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

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    W = r.width;
    H = r.height;
    if (still) draw(STILL_AT);
  };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    heat += ((pointer ? 1 : 0) - heat) * Math.min(1, dt * 5);
    draw(now / 1000);
    raf = document.hidden ? 0 : requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (still) {
      heat = 1;
      draw(STILL_AT);
    }
  };
  const onLeave = () => {
    pointer = null;
    if (still) {
      heat = 0;
      draw(STILL_AT);
    }
  };
  // Rest while the window is hidden; pick up where it left off.
  const onVisible = () => {
    if (!document.hidden && !raf && !still) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  const looks = new MutationObserver(() => {
    colours = palette(canvas);
    if (still) draw(STILL_AT);
  });
  const sized = new ResizeObserver(resize);

  resize();
  sized.observe(canvas);
  looks.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  document.addEventListener("visibilitychange", onVisible);
  if (!still) raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    sized.disconnect();
    looks.disconnect();
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
