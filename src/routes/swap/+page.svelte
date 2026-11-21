<script lang="ts">
  // Swap: laid out, but switched off. A swap means approving a contract to
  // take your tokens, and this wallet's rules approve no one yet.
  import AssetBadge from "#lib/ui/AssetBadge.svelte";
  import Icon from "#lib/ui/Icon.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const usdc = $derived(data.holdings.find((h) => h.asset === "USDC"));
  const eurc = $derived(data.holdings.find((h) => h.asset === "EURC"));
</script>

<svelte:head>
  <title>Cathedral · Swap</title>
</svelte:head>

<header class="page-head">
  <p class="label">Move / swap / switched off</p>
  <h1 class="display">Swap <em>assets</em></h1>
  <p class="lede muted">Trade one asset for another, once the rules allow it.</p>
</header>

<div class="layout">
  <section class="card swap">
    <div class="side">
      <span class="label">From</span>
      <div class="row">
        <AssetBadge badge={usdc?.badge ?? "$"} size="2rem" />
        <span class="sym">USDC</span>
        <input class="num" placeholder="0.0" disabled aria-label="Amount to swap" />
      </div>
      <span class="label">Holding <span class="num money">{usdc?.short}</span></span>
    </div>
    <span class="arrow" aria-hidden="true"><Icon name="swap" /></span>
    <div class="side">
      <span class="label">To</span>
      <div class="row">
        <AssetBadge badge={eurc?.badge ?? "€"} size="2rem" />
        <span class="sym">EURC</span>
        <input class="num" placeholder="0.0" disabled aria-label="Amount received" />
      </div>
      <span class="label">Holding <span class="num money">{eurc?.short}</span></span>
    </div>
    <button class="btn" disabled>Swap is switched off</button>
  </section>

  <aside class="why">
    <div class="key-idea">
      <span class="label">+ Why it is off</span>
      <span>
        A swap approves a contract to take your tokens. This wallet's rules say who may be approved:
        <strong>{data.mandate.spenders}</strong>
      </span>
    </div>
    <p class="muted">
      Swaps arrive in a later stage, with one named swap contract added to the rules, a cap on what it may take, and the
      same rehearsal every send gets.
    </p>
    <div class="stack opener" aria-hidden="true"></div>
  </aside>
</div>

<style>
  .page-head {
    padding-bottom: var(--space-6);
  }

  .page-head .label {
    margin: 0 0 var(--space-3);
  }

  .lede {
    margin: var(--space-4) 0 0;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: var(--space-6);
    align-items: start;
  }

  .swap {
    display: grid;
    gap: var(--space-3);
  }

  .side {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border: 1px solid var(--line);
    background: var(--void);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .sym {
    font-weight: 400;
    font-size: var(--step-1);
  }

  .row input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    text-align: right;
    font-size: var(--step-3);
    font-weight: 300;
  }

  .arrow {
    justify-self: center;
    color: var(--ink-3);
  }

  .why {
    display: grid;
    gap: var(--space-5);
  }

  .why p {
    margin: 0;
  }

  .opener {
    height: 14rem;
  }

  @media (max-width: 52rem) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
