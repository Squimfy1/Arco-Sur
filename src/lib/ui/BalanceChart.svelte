<script lang="ts">
  // The balance over time, as the chain recorded it. Pick a range below the
  // chart; move over it to see what the wallet held at any moment. Its size
  // and colours are decided here and in theme.css; the backend only said
  // where each point sits and what each label reads.
  import type { History } from "../contract.ts";
  import { at, draw, percent } from "./chart.ts";

  let { history, height = "10rem" }: { history: History; height?: string } = $props();

  const W = 1000;
  const H = 260;
  // Room above and below the line for the highest and lowest labels.
  const PAD = 34;

  let chosen = $state("All");
  const range = $derived(history.ranges.find((r) => r.id === chosen) ?? history.ranges.at(-1)!);
  const drawn = $derived(draw(range.points, W, H, PAD));
  const high = $derived(percent(range.high, H, PAD, 4));
  const low = $derived(percent(range.low, H, PAD, 4));

  let hover: { left: string; top: string; balance: string; span: string } | null = $state(null);

  function onMove(e: PointerEvent) {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const i = at(range.points, fx);
    const p = range.points[i];
    if (!p) return;
    const next = range.points[i + 1];
    hover = {
      ...percent({ x: fx, y: p.y }, H, PAD),
      balance: p.balance,
      span: next && next.when !== p.when ? `${p.when} to ${next.when}` : `on ${p.when}`,
    };
  }
</script>

<figure style:--chart-height={height}>
  <p class="change" data-tone={range.tone}>
    <span class="num money">{range.change}</span> <span class="since">since {range.from}</span>
  </p>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="plot" onpointermove={onMove} onpointerleave={() => (hover = null)}>
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="Balance from {range.from} to {range.to}, between {range.low.balance} and {range.high.balance} USDC">
      <defs>
        <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--chart-fill-top)" />
          <stop offset="1" stop-color="var(--chart-fill-bottom)" />
        </linearGradient>
      </defs>
      <path d={drawn.area} fill="url(#balance-fill)" />
      <path d={drawn.line} fill="none" stroke="var(--chart-line)" stroke-width="2" vector-effect="non-scaling-stroke" />
    </svg>

    <span class="mark high num money" style:left={high.left} style:top={high.top}>{range.high.balance}</span>
    <span class="mark low num money" style:left={low.left} style:top={low.top}>{range.low.balance}</span>

    {#if hover}
      <span class="cursor" style:left={hover.left} aria-hidden="true"></span>
      <span class="dot" style:left={hover.left} style:top={hover.top} aria-hidden="true"></span>
      <span class="tip" style:left={hover.left}>
        <b class="num money">{hover.balance} USDC</b>
        <small>{hover.span}</small>
      </span>
    {/if}
  </div>

  <div class="axis">
    <span>{range.from}</span>
    <span>{range.to}</span>
  </div>

  <div class="ranges" role="tablist" aria-label="Time range">
    {#each history.ranges as r (r.id)}
      <button type="button" role="tab" aria-selected={r.id === range.id} onclick={() => (chosen = r.id)}>{r.id}</button>
    {/each}
  </div>
</figure>

<style>
  figure {
    margin: 0;
  }

  .change {
    margin: 0 0 var(--space-3);
    font-size: calc(var(--step-0) * 1.2);
    color: var(--tone);
  }

  .since {
    color: var(--ink-3);
  }

  .plot {
    position: relative;
    cursor: crosshair;
    touch-action: none;
  }

  svg {
    display: block;
    width: 100%;
    height: var(--chart-height);
  }

  /* Highest and lowest balance in the range, above and below their points. */
  .mark {
    position: absolute;
    font-size: var(--step--1);
    color: var(--ink-2);
    white-space: nowrap;
    pointer-events: none;
  }

  .high {
    transform: translate(-50%, -150%);
  }

  .low {
    transform: translate(-50%, 50%);
  }

  .cursor {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--ink-3);
    pointer-events: none;
  }

  .dot {
    position: absolute;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    background: var(--chart-line);
    box-shadow: 0 0 0 4px var(--accent-glow);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .tip {
    position: absolute;
    top: 0;
    display: grid;
    gap: 2px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    background: var(--panel-2);
    box-shadow: var(--pop-shadow);
    transform: translate(-50%, -110%);
    white-space: nowrap;
    pointer-events: none;
  }

  .tip b {
    font-weight: 600;
  }

  .tip small {
    font-size: var(--step--2);
    color: var(--ink-3);
  }

  .axis {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-2);
    font-size: var(--step--2);
    color: var(--ink-3);
  }

  .ranges {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-1);
    margin-top: var(--space-5);
    padding: var(--space-1);
    border-radius: var(--radius-lg);
    background: var(--panel);
  }

  .ranges button {
    min-height: 2.5rem;
    border: 0;
    border-radius: var(--radius);
    background: transparent;
    color: var(--ink-3);
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s var(--ease-out), color 0.2s var(--ease-out);
  }

  .ranges button:hover {
    color: var(--ink);
  }

  .ranges button[aria-selected="true"] {
    background: var(--panel-2);
    color: var(--ink);
  }
</style>
