<script lang="ts">
  // One vault: who runs it, what it pays and has paid, where the money goes,
  // and who can change it, read live from the protocol. "How It Works" opens
  // in place, on the page, into a step-by-step diagram. For looking only:
  // this wallet is on testnet. Every figure comes from the backend
  // (vault-detail.ts).
  import AssetBadge from "#lib/ui/AssetBadge.svelte";
  import Icon from "#lib/ui/Icon.svelte";
  import VaultChart from "#lib/ui/VaultChart.svelte";
  import VaultFlow from "#lib/ui/VaultFlow.svelte";
  import VaultLogo from "#lib/ui/VaultLogo.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const d = $derived(data.detail);
  const v = $derived(d.vault);

  let how: HTMLDetailsElement | undefined = $state();

  // The header's button opens the section and brings it into view.
  function showHow() {
    if (!how) return;
    how.open = true;
    how.scrollIntoView({ behavior: "smooth", block: "start" });
  }
</script>

<svelte:head>
  <title>{v.name}</title>
</svelte:head>

<a class="back" href="/vaults"><Icon name="chevron" size="1.1rem" /> Vaults</a>

<header class="head">
  <VaultLogo slug={v.protocolSlug} name={v.protocol} size="3.5rem" />
  <div class="title">
    <h1>{v.name}</h1>
    <p class="by">
      <span class="who">
        {#if v.curator}
          <VaultLogo slug={v.curatorSlug} name={v.curator} size="1.4rem" />
          Curated by {v.curator} on {v.protocol}
        {:else}
          Run by {v.protocol}
        {/if}
      </span>
      <span class="who"><AssetBadge asset={v.asset} badge={v.asset.slice(0, 1)} size="1.4rem" /> {v.asset}</span>
    </p>
  </div>
  <div class="actions">
    <button class="btn" type="button" onclick={showHow}><Icon name="rules" size="1.1rem" /> How It Works</button>
    <a class="btn outline" href={v.url} target="_blank" rel="noreferrer"><Icon name="external" size="1.1rem" /> Open on {v.protocol}</a>
  </div>
</header>

{#if d.problem}
  <p class="problem" data-tone="warn" role="status">{d.problem}</p>
{/if}

{#if d.description}
  <p class="muted lede">{d.description}</p>
{/if}

<section class="stats" aria-label="Key figures">
  {#each d.stats as s (s.label)}
    <div class="stat">
      <span class="muted label">{s.label}</span>
      <span class="value num money">{s.value}</span>
      {#if s.note}<span class="muted note">{s.note}</span>{/if}
    </div>
  {/each}
</section>

<details class="card how" bind:this={how}>
  <summary>
    <span>
      <span class="card-title">How It Works</span>
      <span class="muted">Where your money goes in this vault, step by step.</span>
    </span>
    <span class="chev" aria-hidden="true"><Icon name="chevron" size="1.2rem" /></span>
  </summary>
  <div class="how-body">
    <VaultFlow flow={d.flow} />
  </div>
</details>

{#if d.series.length > 0}
  <section class="card">
    <VaultChart series={d.series} />
  </section>
{/if}

{#if d.markets.length > 0}
  <section class="card">
    <h2 class="card-title">{d.marketsTitle}</h2>
    <table>
      <thead>
        <tr>
          <th></th>
          <th class="right">Share</th>
          <th class="right">Amount</th>
          <th class="right">Borrowed</th>
          <th class="right">Earns</th>
          <th>Safety</th>
        </tr>
      </thead>
      <tbody>
        {#each d.markets as m (m.name)}
          <tr>
            <td class="name">{m.name}</td>
            <td class="right num">{m.share}</td>
            <td class="right num money">{m.amount}</td>
            <td class="right num">{m.utilization}</td>
            <td class="right num earns">{m.apy}</td>
            <td class="muted">{m.safety}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

{#if d.roles.length > 0}
  <section class="card">
    <h2 class="card-title">Who Controls It</h2>
    <dl class="roles">
      {#each d.roles as r (r.label)}
        <div>
          <dt>{r.label}</dt>
          <dd><span class="num">{r.value}</span><span class="muted">{r.note}</span></dd>
        </div>
      {/each}
    </dl>
  </section>
{/if}

<p class="muted foot">
  {d.read ? `${d.read}. ` : ""}Arc mainnet, shown for reference: this wallet runs on testnet and cannot deposit here.
  {#if d.address}Contract <span class="num">{d.address}</span>.{/if}
</p>


<style>
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--ink-2);
    font-weight: 500;
  }

  .back :global(svg) {
    transform: rotate(90deg);
  }

  .back:hover {
    color: var(--ink);
  }

  .head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: var(--space-4) 0 var(--space-4);
  }

  .title {
    flex: 1;
    min-width: 16rem;
  }

  h1 {
    margin: 0 0 var(--space-2);
    font-size: var(--step-4);
  }

  .by {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: 0;
    color: var(--ink-2);
  }

  .who {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .problem {
    margin: 0 0 var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    background: var(--tone-bg);
    color: var(--tone);
  }

  .lede {
    max-width: 52rem;
    margin: 0 0 var(--space-5);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    margin-bottom: var(--space-5);
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
  }

  .stat {
    display: grid;
    align-content: start;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-4) var(--space-4) 0;
  }

  .label,
  .note {
    font-size: var(--step--1);
  }

  .value {
    font-size: var(--step-3);
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .card + .card {
    margin-top: var(--space-4);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    padding: 0 var(--space-3) var(--space-2) 0;
    border-bottom: 1px solid var(--rule-strong);
    color: var(--ink-3);
    font-size: var(--step--1);
    font-weight: 500;
    text-align: left;
    white-space: nowrap;
  }

  td {
    padding: var(--space-3) var(--space-3) var(--space-3) 0;
    border-bottom: 1px solid var(--rule);
  }

  tr:last-child td {
    border-bottom: 0;
  }

  .right {
    text-align: right;
  }

  .name {
    font-weight: 500;
  }

  .earns {
    color: var(--ok);
    font-weight: 600;
  }

  .roles {
    display: grid;
    margin: 0;
  }

  .roles div {
    display: grid;
    grid-template-columns: 9rem minmax(0, 1fr);
    gap: var(--space-3);
    padding: var(--space-3) 0;
  }

  .roles div + div {
    border-top: 1px solid var(--rule);
  }

  .roles dt {
    color: var(--ink-3);
  }

  .roles dd {
    display: grid;
    margin: 0;
  }

  .roles dd .num {
    font-weight: 500;
  }

  .roles dd .muted {
    font-size: var(--step--1);
  }

  .foot {
    margin: var(--space-5) 0 0;
    font-size: var(--step--1);
    overflow-wrap: anywhere;
  }

  /* How It Works: on the page, closed until its title is clicked. */
  .how {
    margin-bottom: var(--space-4);
  }

  .how summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    list-style: none;
    cursor: pointer;
  }

  .how summary::-webkit-details-marker {
    display: none;
  }

  .how summary > span:first-child {
    display: grid;
    gap: var(--space-1);
  }

  .how summary .card-title {
    margin: 0;
  }

  .how summary .muted {
    font-size: var(--step--1);
  }

  .chev {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: var(--panel-2);
    color: var(--ink-2);
    transition: transform 0.2s var(--ease-out);
  }

  .how[open] .chev {
    transform: rotate(180deg);
  }

  .how summary:hover .chev {
    color: var(--ink);
  }

  .how-body {
    margin-top: var(--space-5);
    padding-top: var(--space-5);
    border-top: 1px solid var(--rule);
  }

  @media (prefers-reduced-motion: no-preference) {
    .how[open] .how-body {
      animation: open 200ms var(--ease-out);
    }

    @keyframes open {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
  }
</style>
