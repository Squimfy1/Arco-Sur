<script lang="ts">
  // Vaults: the largest vaults on Arc mainnet, by deposits, with who runs
  // them and what they pay; each opens its own page. For looking only:
  // this wallet is on testnet.
  // Every figure comes from the backend (src/lib/server/vaults.ts).
  import AssetBadge from "#lib/ui/AssetBadge.svelte";
  import FilterMenu from "#lib/ui/FilterMenu.svelte";
  import Icon from "#lib/ui/Icon.svelte";
  import VaultLogo from "#lib/ui/VaultLogo.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const v = $derived(data.vaults);

  const ALL = "All";
  let chosen: Record<string, string> = $state({});
  const groups = $derived([{ id: "asset", label: "Asset", options: v.assets }]);
  const shown = $derived(v.vaults.filter((x) => !chosen.asset || chosen.asset === ALL || x.asset === chosen.asset));
</script>

<svelte:head>
  <title>Vaults</title>
</svelte:head>

<h1>Vaults</h1>
<p class="muted lede">
  The largest vaults on Arc mainnet by deposits, as of {v.asOf}: <span class="num money">{v.total}</span> in all. Shown for
  reference; this wallet runs on testnet and cannot deposit into them.
</p>

<div class="filter">
  <FilterMenu {groups} bind:chosen all={ALL} everything="All Vaults" />
</div>

<section class="card list" aria-label="Vaults">
  <div class="row head" aria-hidden="true">
    <span>Vault</span>
    <span>Curator</span>
    <span>Asset</span>
    <span class="right">Deposits</span>
    <span class="right">APY</span>
    <span></span>
  </div>
  <ol>
    {#each shown as x (x.name)}
      <li class="row">
        <span class="vault">
          <VaultLogo slug={x.protocolSlug} name={x.protocol} />
          <span class="names">
            <a class="title" href="/vaults/{x.slug}">{x.name}</a>
            <span class="muted small">{x.protocol}</span>
          </span>
        </span>
        <span class="curator">
          {#if x.curator}
            <VaultLogo slug={x.curatorSlug} name={x.curator} size="1.5rem" />
            <span>{x.curator}</span>
          {:else}
            <span class="muted">Run by {x.protocol}</span>
          {/if}
        </span>
        <span class="asset">
          <AssetBadge asset={x.asset} badge={x.asset.slice(0, 1)} size="1.5rem" />
          <span>{x.asset}</span>
        </span>
        <span class="right num money deposits">{x.deposits}</span>
        <span class="right apy">
          <span class="num">{x.apy}</span>
          {#if x.apyNote}<span class="muted small">{x.apyNote}</span>{/if}
        </span>
        <a class="open" href={x.url} target="_blank" rel="noreferrer" aria-label="Open {x.name}" title="Open {x.name}">
          <Icon name="external" size="1.05rem" />
        </a>
      </li>
    {:else}
      <li class="none muted">No vaults for this asset yet.</li>
    {/each}
  </ol>
</section>

<p class="muted sources">
  Figures from
  {#each v.sources as s, i (s.url)}{#if i > 0}, {/if}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>{/each}.
  Yields change constantly and are not a promise of returns.
</p>

<style>
  .lede {
    margin: var(--space-1) 0 var(--space-5);
    max-width: 48rem;
  }

  .filter {
    margin-bottom: var(--space-4);
  }

  .list {
    padding: var(--space-3) var(--space-2);
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(12rem, 2.2fr) minmax(8rem, 1.3fr) minmax(5rem, 0.8fr) minmax(6rem, 1fr) minmax(5rem, 0.9fr) 2rem;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-3);
    border-radius: var(--radius);
  }

  li.row {
    position: relative;
  }

  li.row:hover {
    background: var(--panel-2);
  }

  /* The vault's name opens its page, and so does the rest of the row. */
  .title::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: var(--radius);
  }

  .title:hover {
    text-decoration: underline;
  }

  .open {
    position: relative;
    z-index: 1;
  }

  li.row + li.row {
    box-shadow: inset 0 1px 0 var(--rule);
  }

  li.row:hover + li.row {
    box-shadow: none;
  }

  .head {
    padding-block: var(--space-1) var(--space-2);
    font-size: var(--step--1);
    color: var(--ink-3);
  }

  .right {
    text-align: right;
  }

  .vault,
  .curator,
  .asset {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .vault {
    gap: var(--space-3);
  }

  .names {
    display: grid;
    min-width: 0;
    line-height: 1.25;
  }

  .title {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .small {
    font-size: var(--step--1);
  }

  .deposits {
    font-weight: 500;
  }

  .apy {
    display: grid;
    line-height: 1.25;
  }

  .apy .num {
    color: var(--ok);
    font-weight: 600;
  }

  .open {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    color: var(--ink-3);
  }

  .open:hover {
    background: var(--hover);
    color: var(--ink);
  }

  .none {
    padding: var(--space-4) var(--space-3);
  }

  .sources {
    margin: var(--space-4) 0 0;
    font-size: var(--step--1);
  }

  .sources a {
    color: var(--accent);
  }

  @media (max-width: 56rem) {
    .head {
      display: none;
    }

    .row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .curator,
    .asset {
      grid-column: 1;
    }
  }
</style>
