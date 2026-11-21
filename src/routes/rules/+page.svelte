<script lang="ts">
  // Rules: what this wallet may do (the mandate), how much of it is used,
  // and the accounting that proves every USDC of change is explained.
  import Pill from "#lib/ui/Pill.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Arco-Sur · Rules</title>
</svelte:head>

<h1>Rules</h1>
<p class="muted lede">The limits every send is checked against before signing, and the books that check the result.</p>

<section class="card">
  <h2 class="card-title">Spending limits</h2>
  {#each data.mandate.limits as l (l.asset)}
    <div class="limit">
      <div class="limit-head">
        <span class="asset">{l.asset}</span>
        <span><span class="num money">{l.used}</span> used of <span class="num money">{l.total}</span></span>
      </div>
      <div class="bar" role="img" aria-label="{l.usedPercent}% of the {l.asset} total used">
        <span style:width="{l.usedPercent}%"></span>
      </div>
      <p class="muted small">
        <span class="num money">{l.left}</span> left · at most <span class="num money">{l.perPayment}</span> per payment
      </p>
    </div>
  {/each}
</section>

<section class="card">
  <h2 class="card-title">Who</h2>
  <dl>
    <dt>May be paid</dt>
    <dd>
      {#each data.mandate.recipients as r (r.address)}
        <span class="addr"><span class="num">{r.address}</span>{#if r.label}<span class="muted tag">· {r.label}</span>{/if}</span>
      {/each}
    </dd>
    <dt>May be approved to spend</dt>
    <dd>{data.mandate.spenders}</dd>
  </dl>
</section>

{#each data.senders as s (s.address)}
  <section class="card">
    <div class="head">
      <h2 class="card-title">Accounting</h2>
      {#if s.accounting}<Pill tone={s.accounting.tone} label={s.accounting.tone === "ok" ? "Balanced" : "Unexplained change"} />{/if}
    </div>
    <p class="muted small num">{s.label}</p>
    {#if s.accounting}
      {@const a = s.accounting}
      <table>
        <tbody>
          <tr><th scope="row">Balance at block <span class="num">{a.startBlock}</span></th><td class="num money">{a.start}</td></tr>
          <tr><th scope="row">Fees paid</th><td class="num money">− {a.fees}</td></tr>
          <tr><th scope="row">Sent to others</th><td class="num money">− {a.outflow}</td></tr>
          <tr class="sum"><th scope="row">Expected now</th><td class="num money">{a.expected}</td></tr>
          <tr><th scope="row">Actually now</th><td class="num money">{a.now}</td></tr>
          <tr class="sum" data-tone={a.tone}><th scope="row">Unexplained</th><td class="num money">{a.unexplained}</td></tr>
        </tbody>
      </table>
      <p class="verdict" data-tone={a.tone}>{a.verdict}</p>
    {/if}
    <p class="muted small">
      Nonce on chain <span class="num">{s.chainNonce}</span> · gaps <span data-tone={s.gapsTone} class="gaps">{s.gaps}</span>
      {#if s.duplicates}· duplicates <span class="num">{s.duplicates}</span>{/if}
    </p>
  </section>
{/each}

<style>
  h1 {
    margin: 0;
    font-size: var(--step-3);
    font-weight: 600;
  }

  .lede {
    margin: var(--space-1) 0 var(--space-5);
  }

  section + section {
    margin-top: var(--space-5);
  }

  .limit + .limit {
    margin-top: var(--space-5);
  }

  .limit-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  .asset {
    font-weight: 600;
  }

  .bar {
    height: 0.5rem;
    border-radius: var(--pill);
    background: var(--panel-2);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--accent);
  }

  .small {
    margin: var(--space-2) 0 0;
    font-size: var(--step--1);
    overflow-wrap: anywhere;
  }

  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-2) var(--space-5);
    margin: 0;
  }

  dt {
    color: var(--ink-3);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .addr {
    display: block;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  table {
    width: 100%;
    max-width: 30rem;
    margin-top: var(--space-4);
    border-collapse: collapse;
  }

  th {
    text-align: left;
    font-weight: 400;
    color: var(--ink-2);
    padding: var(--space-2) 0;
  }

  td {
    text-align: right;
    padding: var(--space-2) 0;
  }

  .sum th,
  .sum td {
    border-top: 1px solid var(--rule-strong);
    font-weight: 600;
    color: var(--ink);
  }

  .sum[data-tone] td {
    color: var(--tone);
  }

  .verdict {
    color: var(--tone);
    font-weight: 500;
  }

  .gaps {
    color: var(--tone);
  }
</style>
