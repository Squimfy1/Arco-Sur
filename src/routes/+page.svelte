<script lang="ts">
  // Portfolio: the balance, the buttons, the balance over time, the assets,
  // and the latest operations.
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
  <title>Arco-Sur · Portfolio</title>
</svelte:head>

<section class="hero">
  <p class="label">Total balance</p>
  <p class="total num money">
    <span class="whole">{data.total.whole}</span><span class="fraction">{data.total.fraction}</span>
    <span class="unit">{data.total.asset}</span>
  </p>
  <p class="muted summary">
    {data.stats.operations} operations · {data.stats.matched} matched · {data.stats.refused} refused ·
    <span class="num money">{data.stats.feesPaid}</span> USDC paid in fees
  </p>
  <ActionBar faucet={data.links.faucet} explorer={data.links.explorer} />
</section>

<section class="card">
  <h2 class="card-title">Balance history</h2>
  {#if data.history}
    <BalanceChart history={data.history} />
  {:else}
    <p class="muted">Not enough mined operations yet to draw a history.</p>
  {/if}
</section>

<section class="card">
  <div class="head">
    <h2 class="card-title">Assets</h2>
    <Pill tone={data.holdingsCheck.tone} label={data.holdingsCheck.tone === "ok" ? "Views agree" : "Check"} />
  </div>
  <ul class="assets">
    {#each data.holdings as h (h.asset)}
      <li>
        <AssetBadge asset={h.asset} badge={h.badge} />
        <span class="asset-name">
          <span>{h.name}</span>
          <span class="muted">{h.asset} · {h.source}</span>
        </span>
        <span class="num money amount">{h.amount} {h.asset}</span>
      </li>
    {/each}
  </ul>
  <p class="muted note">{data.holdingsCheck.text}</p>
</section>

<section class="card">
  <div class="head">
    <h2 class="card-title">Latest operations</h2>
    <a href="/activity" class="see-all">See all</a>
  </div>
  <ul class="ops">
    {#each recent as op (op.line)}
      <Operation {op} />
    {/each}
  </ul>
</section>

<style>
  section + section {
    margin-top: var(--space-5);
  }

  .hero {
    padding-bottom: var(--space-4);
  }

  .label {
    margin: 0;
    color: var(--ink-3);
    font-weight: 500;
  }

  .total {
    margin: var(--space-1) 0 var(--space-2);
    font-family: var(--sans);
    line-height: 1.1;
  }

  .whole {
    font-size: var(--step-4);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .fraction {
    font-size: var(--step-2);
    font-weight: 500;
    color: var(--ink-2);
  }

  .unit {
    margin-left: var(--space-2);
    font-size: var(--step-2);
    color: var(--ink-3);
  }

  .summary {
    margin: 0 0 var(--space-5);
    font-size: var(--step--1);
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
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--rule);
  }

  .asset-name {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .asset-name .muted {
    font-size: var(--step--1);
  }

  .amount {
    font-weight: 500;
    white-space: nowrap;
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
