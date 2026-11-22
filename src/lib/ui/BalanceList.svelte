<script lang="ts">
  // What the wallet holds of each asset, the one being used picked out.
  // The right-hand panel of the Send and Swap screens.
  import type { Holding } from "../contract.ts";
  import AssetBadge from "./AssetBadge.svelte";

  let { holdings, current }: { holdings: Holding[]; current: string } = $props();
</script>

<aside class="card balance">
  <h2 class="card-title">Balance</h2>
  <ul>
    {#each holdings as h (h.asset)}
      <li data-on={h.asset === current ? "" : undefined}>
        <AssetBadge asset={h.asset} badge={h.badge} size="2rem" />
        <span class="coin"><span class="sym">{h.asset}</span><span class="muted">{h.name}</span></span>
        <span class="num money held">{h.amount}</span>
      </li>
    {/each}
  </ul>
</aside>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius);
    box-shadow: inset 0 0 0 1px transparent;
    transition: background-color 0.2s var(--ease-out);
  }

  /* The asset being used stands out. */
  li[data-on] {
    background: var(--panel-2);
    box-shadow: inset 0 0 0 1px var(--rule-strong);
  }

  .coin {
    display: grid;
    flex: 1;
    min-width: 0;
    line-height: 1.25;
  }

  .sym {
    font-weight: 600;
  }

  .coin .muted {
    font-size: var(--step--1);
  }

  .held {
    font-size: var(--step-1);
    font-weight: 500;
    white-space: nowrap;
  }
</style>
