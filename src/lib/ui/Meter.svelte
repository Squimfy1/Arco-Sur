<script lang="ts">
  // How much of one spending limit is used: the coin, a thin bar, and what is
  // left. The bar's width is the backend's usedPercent; nothing is worked
  // out here. Shape borrowed from Inherence's "actions verified" card.
  import type { Limit } from "../contract.ts";
  import AssetBadge from "./AssetBadge.svelte";

  let { limit }: { limit: Limit } = $props();
</script>

<div class="meter">
  <div class="row">
    <AssetBadge asset={limit.asset} badge={limit.badge} size="2rem" />
    <span class="name"><b>{limit.asset}</b><span>{limit.name}</span></span>
    <span class="used"><span class="num money">{limit.used}</span> / <span class="num money">{limit.total}</span> this month</span>
  </div>
  <div class="bar" role="img" aria-label="{limit.usedPercent}% of the {limit.asset} monthly limit used">
    <span style:width="{limit.usedPercent}%"></span>
  </div>
  <p class="cap"><span class="num money">{limit.left}</span> left this month, at most <span class="num money">{limit.perPayment}</span> per payment</p>
</div>

<style>
  .meter {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--panel-2);
    box-shadow: var(--lift);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .name {
    display: grid;
    flex: 1;
    min-width: 0;
    line-height: 1.25;
  }

  .name b {
    font-weight: 600;
  }

  .name span {
    font-size: var(--step--1);
    color: var(--ink-3);
  }

  .used {
    font-size: var(--step--1);
    color: var(--ink-2);
    white-space: nowrap;
  }

  .bar {
    height: 0.375rem;
    border-radius: var(--pill);
    background: var(--bg);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--accent);
  }

  .cap {
    margin: var(--space-2) 0 0;
    font-size: var(--step--2);
    color: var(--ink-3);
  }
</style>
