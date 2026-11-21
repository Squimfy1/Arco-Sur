<script lang="ts">
  // Swap: laid out, but switched off. A swap means approving a contract to
  // take your tokens, and this wallet's rules allow no approvals yet.
  import AssetBadge from "#lib/ui/AssetBadge.svelte";
  import Icon from "#lib/ui/Icon.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Arco-Sur · Swap</title>
</svelte:head>

<h1>Swap</h1>
<p class="muted lede">Trade one asset for another.</p>

<section class="card swap">
  <div class="side">
    <span class="muted">From</span>
    <div class="row">
      <AssetBadge asset="USDC" badge="$" size="2rem" />
      <span class="sym">USDC</span>
      <input class="num" placeholder="0.0" disabled aria-label="Amount to swap" />
    </div>
  </div>
  <span class="arrow" aria-hidden="true"><Icon name="swap" /></span>
  <div class="side">
    <span class="muted">To</span>
    <div class="row">
      <AssetBadge asset="EURC" badge="€" size="2rem" />
      <span class="sym">EURC</span>
      <input class="num" placeholder="0.0" disabled aria-label="Amount received" />
    </div>
  </div>
  <button class="btn" disabled>Swap is not switched on</button>
  <p class="why" data-tone="quiet">
    A swap approves a contract to take your tokens. This wallet's rules say who may be approved:
    <strong>{data.mandate.spenders}</strong> Swaps arrive in a later stage, with one named swap contract added
    to the rules, a cap on what it may take, and the same rehearsal every send gets.
  </p>
</section>

<style>
  h1 {
    margin: 0;
    font-size: var(--step-3);
    font-weight: 600;
  }

  .lede {
    margin: var(--space-1) 0 var(--space-5);
  }

  .swap {
    display: grid;
    gap: var(--space-3);
    max-width: 30rem;
  }

  .side {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: var(--radius);
    background: var(--panel-2);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .sym {
    font-weight: 600;
  }

  .row input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    text-align: right;
    font-size: var(--step-2);
  }

  .arrow {
    justify-self: center;
    color: var(--ink-3);
  }

  .why {
    margin: 0;
    font-size: var(--step--1);
    color: var(--ink-2);
  }
</style>
