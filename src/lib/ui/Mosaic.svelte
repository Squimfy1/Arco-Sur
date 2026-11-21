<script lang="ts">
  // The mosaic wall: the Cathedral cross set in small square tiles on a
  // dark field. Where the pointer passes, tiles light up in stained-glass
  // colours and fade back. Now and then a tile of the cross catches the
  // light. The cross rises row by row on arrival. With reduced motion asked
  // for, it simply appears and only the pointer lights it. All colours come
  // from theme.css (--glass-*, --stone-*).
  import { onMount, type Snippet } from "svelte";

  import { CROSS_BOX, CROSS_PATH } from "./cross.ts";
  import { channels, mix, place, type Tile, wall } from "./mosaic.ts";

  let { children, height = "22rem" }: { children?: Snippet; height?: string } = $props();

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  const PITCH = 7;          // px from one tile to the next
  const TILE = 6;           // px of tile; the rest is grout
  const REACH = 4.5;        // tiles lit around the pointer
  const COOL = 0.92;        // heat kept per frame
  const FADE = 0.975;       // glint kept per frame

  onMount(() => {
    const ctx = canvas.getContext("2d");
    const probe = document.createElement("canvas").getContext("2d");
    if (!ctx || !probe) return;
    const css = getComputedStyle(host);
    const token = (name: string) => channels(css.getPropertyValue(name));
    const palette = [1, 2, 3, 4, 5, 6].map((i) => token(`--glass-${i}`));
    const field = token("--stone-void");
    const fieldGrain = token("--stone-glass");
    const mark = token("--stone-light");
    const markLight = token("--glass-6");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The cross, tested with the canvas's own path maths, in its 0..1 box.
    const cross = new Path2D(CROSS_PATH);
    const inMark = (u: number, v: number) =>
      probe.isPointInPath(cross, CROSS_BOX.x + u * CROSS_BOX.w, CROSS_BOX.y + v * CROSS_BOX.h);

    let cols = 0;
    let rows = 0;
    let tiles: Tile[] = [];
    let baseRgb: number[][] = [];
    let base: string[] = [];
    let heat = new Float32Array(0);
    let glint = new Float32Array(0);
    const active = new Set<number>();
    let rise = still ? 1 : 0;
    let frame = 0;
    let visible = true;
    let last: [number, number] | null = null;

    const blend = (a: number[], b: number[], t: number) => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t);

    function build() {
      const w = host.clientWidth;
      const h = host.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / PITCH);
      rows = Math.ceil(h / PITCH);
      // On a wide wall the cross stands right of centre, leaving the left for the words.
      const at = place(cols, rows, CROSS_BOX.w / CROSS_BOX.h, 0.84, cols > 110 ? 0.72 : 0.5);
      tiles = wall(cols, rows, at, inMark);
      baseRgb = tiles.map((t) =>
        t.kind === "mark" ? blend(mark, markLight, 0.25 + t.grain * 0.3) : blend(field, fieldGrain, t.grain * 0.5),
      );
      base = baseRgb.map((c) => mix(c, c, 0));
      heat = new Float32Array(tiles.length);
      glint = new Float32Array(tiles.length);
      active.clear();
      drawAll();
    }

    function colour(i: number): string {
      const lit = Math.max(heat[i]!, glint[i]!);
      if (lit < 0.01) return base[i]!;
      return mix(baseRgb[i]!, palette[tiles[i]!.glass]!, lit * (tiles[i]!.kind === "mark" ? 1 : 0.8));
    }

    function drawAll() {
      ctx!.clearRect(0, 0, cols * PITCH, rows * PITCH);
      // While rising, the cross shows only below the line.
      const line = rows - rows * rise;
      const empty = mix(field, field, 0);
      for (let i = 0; i < tiles.length; i++) {
        const y = Math.floor(i / cols);
        ctx!.fillStyle = tiles[i]!.kind === "mark" && y < line ? empty : colour(i);
        ctx!.fillRect((i % cols) * PITCH, y * PITCH, TILE, TILE);
      }
    }

    function tile(i: number) {
      const x = (i % cols) * PITCH;
      const y = Math.floor(i / cols) * PITCH;
      ctx!.clearRect(x, y, PITCH, PITCH);
      ctx!.fillStyle = colour(i);
      ctx!.fillRect(x, y, TILE, TILE);
    }

    function light(cx: number, cy: number) {
      for (let y = Math.floor(cy - REACH); y <= cy + REACH; y++) {
        for (let x = Math.floor(cx - REACH); x <= cx + REACH; x++) {
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (d > REACH) continue;
          const i = y * cols + x;
          heat[i] = Math.max(heat[i]!, 1 - d / (REACH + 1));
          active.add(i);
        }
      }
    }

    function onMove(e: PointerEvent) {
      const box = canvas.getBoundingClientRect();
      const tx = (e.clientX - box.left) / PITCH;
      const ty = (e.clientY - box.top) / PITCH;
      // Fill in between pointer events, so a fast sweep leaves no gaps.
      const [fx, fy] = last ?? [tx, ty];
      const steps = Math.max(1, Math.ceil(Math.hypot(tx - fx, ty - fy) / 2));
      for (let s = 1; s <= steps; s++) light(fx + ((tx - fx) * s) / steps, fy + ((ty - fy) * s) / steps);
      last = [tx, ty];
      wake();
    }

    function glints() {
      // Now and then a tile of the cross catches the light.
      if (still || Math.random() > 0.2) return;
      const i = Math.floor(Math.random() * tiles.length);
      if (tiles[i]?.kind !== "mark") return;
      glint[i] = 0.5 + Math.random() * 0.5;
      active.add(i);
    }

    function step() {
      frame = 0;
      if (!visible) return;
      if (rise < 1) {
        rise = Math.min(1, rise + 0.03);
        drawAll();
      }
      glints();
      for (const i of active) {
        heat[i] = heat[i]! * COOL;
        glint[i] = glint[i]! * FADE;
        if (heat[i]! < 0.01 && glint[i]! < 0.01) {
          heat[i] = 0;
          glint[i] = 0;
          active.delete(i);
        }
        tile(i);
      }
      if (rise < 1 || active.size > 0 || !still) frame = requestAnimationFrame(step);
    }

    function wake() {
      if (!frame && visible) frame = requestAnimationFrame(step);
    }

    const resized = new ResizeObserver(() => {
      build();
      wake();
    });
    resized.observe(host);

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) wake();
    });
    seen.observe(host);

    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) wake();
    };
    const onLeave = () => (last = null);
    document.addEventListener("visibilitychange", onVisibility);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  });
</script>

<div class="wall" bind:this={host} style:--wall-height={height}>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  <div class="over">
    {@render children?.()}
  </div>
</div>

<style>
  .wall {
    position: relative;
    height: var(--wall-height);
    overflow: hidden;
    background: var(--void);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    cursor: crosshair;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  /* The words sit over the wall; the wall still answers the pointer through them. */
  .over {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .over :global(a),
  .over :global(button) {
    pointer-events: auto;
  }
</style>
