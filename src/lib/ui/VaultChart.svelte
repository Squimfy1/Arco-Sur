<script lang="ts">
  // A vault over time: its yield or its deposits, day by day, as the
  // protocol recorded them. Pick what to see and over how long; move over
  // the chart to read any day. The backend placed every point and wrote
  // every label; this only draws.
  import type { Series } from "../contract.ts";
  import { drawLine, nearest, percent } from "./chart.ts";

  let { series }: { series: Series[] } = $props();

  const W = 1000;
  const H = 260;
  const PAD = 34;

  let which = $state("");
  let span = $state("");
  const s = $derived(series.find((x) => x.id === which) ?? series[0]!);
  const range = $derived(s.ranges.find((r) => r.id === span) ?? s.ranges.find((r) => r.id === "1M") ?? s.ranges.at(-1)!);
  const drawn = $derived(drawLine(range.points, W, H, PAD));
  const high = $derived(percent(range.high, H, PAD, 4));
  const low = $derived(percent(range.low, H, PAD, 4));
  const fill = $props.id();

  let hover: { left: string; top: string; value: string; when: string } | null = $state(null);

  function onMove(e: PointerEvent) {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const p = range.points[nearest(range.points, fx)];
    if (p) hover = { ...percent(p, H, PAD), value: p.value, when: p.when };
  }
</script>

<figure>
  <div class="top">
    <div class="tabs" role="tablist" aria-label="What to show">
      {#each series as x (x.id)}
        <button type="button" role="tab" aria-selected={x.id === s.id} onclick={() => (which = x.id)}>{x.label}</button>
      {/each}
    </div>
    <div class="tabs" role="tablist" aria-label="Time range">
      {#each s.ranges as r (r.id)}
        <button type="button" role="tab" aria-selected={r.id === range.id} onclick={() => (span = r.id)}>{r.id}</button>
      {/each}
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="plot" onpointermove={onMove} onpointerleave={() => (hover = null)}>
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="{s.label} from {range.from} to {range.to}, between {range.low.value} and {range.high.value}">
      <defs>
        <linearGradient id="vault-fill-{fill}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--chart-fill-top)" />
          <stop offset="1" stop-color="var(--chart-fill-bottom)" />
        </linearGradient>
      </defs>
      <path d={drawn.area} fill="url(#vault-fill-{fill})" />
      <path d={drawn.line} fill="none" stroke="var(--chart-line)" stroke-width="2" vector-effect="non-scaling-stroke" />
    </svg>

    <span class="mark num" style:left={high.left} style:top={high.top}>{range.high.value}</span>
    <span class="mark num" style:left={low.left} style:top={low.top}>{range.low.value}</span>

    {#if hover}
      <span class="cursor" style:left={hover.left} aria-hidden="true"></span>
      <span class="dot" style:left={hover.left} style:top={hover.top} aria-hidden="true"></span>
      <span class="tip" style:left={hover.left}>
        <b class="num">{hover.value}</b>
        <small>{hover.when}</small>
      </span>
    {/if}
  </div>

  <div class="axis">
    <span>{range.from}</span>
    <span>{range.to}</span>
  </div>
</figure>

<style>
  figure {
    margin: 0;
  }

  .top {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .tabs {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: var(--pill);
    background: var(--panel-2);
  }

  .tabs button {
    padding: var(--space-1) var(--space-4);
    border: 0;
    border-radius: var(--pill);
    background: none;
    color: var(--ink-2);
    font-weight: 500;
    cursor: pointer;
  }

  .tabs button:hover {
    color: var(--ink);
  }

  .tabs button[aria-selected="true"] {
    background: var(--accent);
    color: var(--accent-ink);
  }

  .plot {
    position: relative;
    height: 14rem;
    cursor: crosshair;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .mark {
    position: absolute;
    transform: translate(-50%, -140%);
    font-size: var(--step--2);
    color: var(--ink-3);
    white-space: nowrap;
    pointer-events: none;
  }

  .cursor {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--rule-strong);
    pointer-events: none;
  }

  .dot {
    position: absolute;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .tip {
    position: absolute;
    top: 0;
    display: grid;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius);
    background: var(--panel-2);
    box-shadow: var(--pop-shadow);
    transform: translateX(-50%);
    white-space: nowrap;
    pointer-events: none;
  }

  .tip small {
    color: var(--ink-3);
  }

  .axis {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-2);
    font-size: var(--step--1);
    color: var(--ink-3);
  }
</style>
