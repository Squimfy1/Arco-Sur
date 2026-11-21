<script lang="ts">
  // The balance over time. Its size and colours are decided here and in
  // theme.css; the backend only said where each point sits.
  import type { History } from "../contract.ts";
  import { draw } from "./chart.ts";

  let { history }: { history: History } = $props();
  const W = 600;
  const H = 160;
  const drawn = $derived(draw(history.points, W, H));
</script>

<figure>
  <div class="plot">
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="Balance from {history.from} to {history.to}, between {history.low} and {history.high} USDC">
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--chart-fill-top)" />
          <stop offset="1" stop-color="var(--chart-fill-bottom)" />
        </linearGradient>
      </defs>
      <path d={drawn.area} fill="url(#fill)" />
      <path d={drawn.line} fill="none" stroke="var(--chart-line)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
    </svg>
    <span class="high num money">{history.high}</span>
    <span class="low num money">{history.low}</span>
  </div>
  <figcaption>
    <span>{history.from}</span>
    <span>{history.to}</span>
  </figcaption>
</figure>

<style>
  figure {
    margin: 0;
  }

  .plot {
    position: relative;
  }

  svg {
    display: block;
    width: 100%;
    height: 10rem;
  }

  .high,
  .low {
    position: absolute;
    right: 0;
    font-family: var(--mono);
    font-size: var(--step--2);
    color: var(--ink-2);
    background: var(--void);
    padding: 0 var(--space-1);
  }

  .high {
    top: 0;
  }

  .low {
    bottom: 0;
  }

  figcaption {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-3);
    font-family: var(--mono);
    font-size: var(--step--2);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-3);
  }
</style>
