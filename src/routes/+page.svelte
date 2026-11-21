<script lang="ts">
  // Portfolio: the mosaic wall with the Cathedral mark and what this is,
  // then the balance, big and short, the buttons, the balance over time,
  // the assets and the latest operations.
  import ActionBar from "#lib/ui/ActionBar.svelte";
  import AssetBadge from "#lib/ui/AssetBadge.svelte";
  import BalanceChart from "#lib/ui/BalanceChart.svelte";
  import Mosaic from "#lib/ui/Mosaic.svelte";
  import Operation from "#lib/ui/Operation.svelte";
  import Pill from "#lib/ui/Pill.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const recent = $derived(data.activity.slice(0, 4));
  // Each asset gets one of the library's halftone covers.
  const COVER: Record<string, string> = { USDC: "5", EURC: "6" };
</script>

<svelte:head>
  <title>Cathedral · Portfolio</title>
</svelte:head>

<Mosaic>
  <div class="wall-words reg">
    <p class="label colophon">cathedral | wallet | arc testnet</p>
    <div class="title">
      <h1 class="display">Cathedral <em>Wallet</em></h1>
      <p class="what">Every payment checked against its rules, and rehearsed on the chain, before anything is signed.</p>
    </div>
  </div>
</Mosaic>

<section class="hero">
  <p class="label">Total balance</p>
  <p class="total num money" title="Exactly {data.total.whole}{data.total.fraction} {data.total.asset}">
    {data.total.short}<span class="unit">{data.total.asset}</span>
  </p>
  <ActionBar faucet={data.links.faucet} explorer={data.links.explorer} />
</section>

<section class="card void reg chart-card">
  <h2 class="label">Balance history</h2>
  {#if data.history}
    <BalanceChart history={data.history} />
  {:else}
    <p class="muted">Not enough mined operations yet to draw a history.</p>
  {/if}
</section>

<section class="card">
  <div class="head">
    <h2 class="heading">Assets</h2>
    <Pill tone={data.holdingsCheck.tone} label={data.holdingsCheck.tone === "ok" ? "Views agree" : "Check"} />
  </div>
  <ul class="assets">
    {#each data.holdings as h (h.asset)}
      <li>
        <span class="halftone cover" data-n={COVER[h.asset] ?? "1"} aria-hidden="true"></span>
        <AssetBadge badge={h.badge} />
        <span class="asset-name">
          <span>{h.name}</span>
          <span class="label">{h.asset} / {h.source}</span>
        </span>
        <span class="num money amount">{h.short} <span class="faint">{h.asset}</span></span>
      </li>
    {/each}
  </ul>
</section>

<section class="card ops-card">
  <div class="head padded">
    <h2 class="heading">Latest operations</h2>
    <a href="/activity" class="label more">See all →</a>
  </div>
  <ul class="ops">
    {#each recent as op (op.line)}
      <Operation {op} />
    {/each}
  </ul>
</section>

<style>
  .wall-words {
    position: absolute;
    inset: 0;
  }

  .colophon {
    position: absolute;
    left: var(--space-6);
    top: var(--space-5);
    margin: 0;
  }

  .title {
    position: absolute;
    left: var(--space-6);
    bottom: var(--space-6);
    max-width: 24rem;
  }

  .title .display {
    font-size: clamp(2rem, 4vw, 3rem);
  }

  .what {
    margin: var(--space-3) 0 0;
    font-size: var(--step--1);
    line-height: 1.6;
    color: var(--ink-2);
  }

  .hero {
    padding: var(--space-7) 0 var(--space-6);
  }

  .hero .label {
    margin: 0;
  }

  .total {
    margin: var(--space-2) 0 var(--space-6);
    font-weight: 300;
    font-size: var(--step-5);
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .unit {
    margin-left: 0.3em;
    font-size: 0.3em;
    letter-spacing: 0.1em;
    color: var(--ink-3);
  }

  section + section {
    margin-top: var(--space-5);
  }

  .chart-card {
    padding-top: var(--space-6);
  }

  .chart-card .label {
    margin: 0 0 var(--space-4);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .assets,
  .ops {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .assets li {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--line);
  }

  .cover {
    width: 4.5rem;
    height: 2.75rem;
    flex: none;
    background-size: 160%;
  }

  .asset-name {
    display: grid;
    flex: 1;
    min-width: 0;
    font-size: var(--step-1);
    font-weight: 400;
  }

  .amount {
    font-size: var(--step-1);
    white-space: nowrap;
  }

  .ops-card {
    padding: 0;
    overflow: hidden;
  }

  .padded {
    margin: 0;
    padding: var(--space-5) var(--space-5) var(--space-4);
    border-bottom: 1px solid var(--line);
  }

  .more:hover {
    color: var(--ink);
  }

  @media (max-width: 40rem) {
    .colophon {
      display: none;
    }

    .title {
      left: var(--space-4);
      right: var(--space-4);
    }

    .cover {
      display: none;
    }
  }
</style>
