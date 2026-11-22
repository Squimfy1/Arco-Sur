<script lang="ts">
  // Portfolio: the balance first and large, the buttons, and the balance
  // over time; then each asset and the latest operations.
  import ActionBar from "#lib/ui/ActionBar.svelte";
  import AssetBadge from "#lib/ui/AssetBadge.svelte";
  import BalanceChart from "#lib/ui/BalanceChart.svelte";
  import Operation from "#lib/ui/Operation.svelte";
  import Pill from "#lib/ui/Pill.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const recent = $derived(data.activity.slice(0, 5));
</script>

<svelte:head>
  <title>Portfolio</title>
</svelte:head>

<section class="hero">
  <p class="eyebrow">Total Balance</p>
  <p class="total num money">
    <span class="whole">{data.total.whole}</span><span class="fraction">{data.total.fraction}</span>
    <span class="unit">{data.total.asset}</span>
  </p>
  <ActionBar faucet={data.links.faucet} explorer={data.links.explorer} />
  <div class="history">
    {#if data.history}
      <BalanceChart history={data.history} height="16rem" />
    {:else}
      <p class="muted">Not enough mined operations yet to draw a history.</p>
    {/if}
  </div>
</section>

<section class="card">
  <div class="head">
    <h2 class="card-title">Assets</h2>
    <Pill tone={data.holdingsCheck.tone} label={data.holdingsCheck.tone === "ok" ? "Views Agree" : "Check"} />
  </div>
  <ul class="assets">
    {#each data.holdings as h (h.asset)}
      <li>
        <AssetBadge asset={h.asset} badge={h.badge} size="2.5rem" />
        <span class="asset-name">
          <span class="name">{h.name}</span>
          <span class="muted">{h.asset}, {h.source}</span>
        </span>
        <span class="num money amount">{h.amount} <span class="sym">{h.asset}</span></span>
      </li>
    {/each}
  </ul>
  <p class="muted note">{data.holdingsCheck.text}</p>
</section>

<section class="card">
  <div class="head">
    <h2 class="card-title">Latest Operations</h2>
    <a href="/activity" class="see-all">See All</a>
  </div>
  <ul class="ops">
    {#each recent as op (op.line)}
      <Operation {op} />
    {/each}
  </ul>
</section>

<style>
  section + section {
    margin-top: var(--space-6);
  }

  /* The balance is the screen's focus: large, with room around it. */
  .hero {
    padding: var(--space-6) 0 var(--space-7);
  }

  /* The balance's label, larger than the small labels elsewhere. */
  .hero .eyebrow {
    font-size: calc(var(--step--1) * 1.56);
  }

  .total {
    margin: var(--space-3) 0 var(--space-6);
    font-family: var(--sans);
    line-height: 1;
  }

  .whole {
    font-size: var(--step-hero);
    font-weight: 500;
    letter-spacing: -0.045em;
  }

  /* A little room after the whole number, so the decimals read as a second part. */
  .fraction {
    margin-left: var(--space-2);
    font-size: var(--step-3);
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--ink-3);
  }

  .unit {
    margin-left: var(--space-3);
    font-size: var(--step-3);
    font-weight: 400;
    color: var(--ink-3);
  }

  .history {
    margin-top: var(--space-7);
    --chart-label-bg: var(--bg);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .assets,
  .ops {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .ops {
    margin: 0 calc(var(--space-4) * -1);
  }

  .assets li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-4);
    padding: var(--space-4) 0;
    border-top: 1px solid var(--rule);
  }

  .asset-name {
    display: grid;
    flex: 1;
    min-width: 10rem;
  }

  .name {
    font-size: var(--step-1);
    font-weight: 500;
  }

  .asset-name .muted {
    font-size: var(--step--1);
  }

  .amount {
    font-size: var(--step-2);
    font-weight: 500;
    white-space: nowrap;
  }

  .sym {
    font-size: var(--step-0);
    color: var(--ink-3);
  }

  .note {
    margin: var(--space-3) 0 0;
    font-size: var(--step--1);
  }

  .see-all {
    color: var(--accent);
    font-weight: 500;
  }
</style>
