<script lang="ts">
  // Rules: what this wallet may do (the mandate), how much of it is used,
  // and the accounting that proves every USDC of change is explained.
  import GlassFolder from "#lib/ui/GlassFolder.svelte";
  import Pill from "#lib/ui/Pill.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Cathedral · Rules</title>
</svelte:head>

<header class="page-head">
  <p class="label">Wallet / rules / checked before every signature</p>
  <h1 class="display">The <em>rules</em>, and the books</h1>
</header>

<section class="block">
  <h2 class="heading">Spending limits</h2>
  <div class="folders">
    {#each data.mandate.limits as l (l.asset)}
      <div class="limit">
        <GlassFolder label={l.asset} />
        <div class="limit-text">
          <span class="limit-name">{l.asset}</span>
          <span class="muted"><span class="num money">{l.used}</span> used of <span class="num money">{l.total}</span></span>
        </div>
        <div class="progress" role="img" aria-label="{l.usedPercent}% of the {l.asset} total used">
          <span style:width="{l.usedPercent}%"></span>
        </div>
        <span class="label"><span class="money">{l.left}</span> left / at most <span class="money">{l.perPayment}</span> per payment</span>
      </div>
    {/each}
  </div>
</section>

<section class="block">
  <h2 class="heading">Who</h2>
  <dl class="card">
    <dt class="label">May be paid</dt>
    <dd>
      {#each data.mandate.recipients as r (r.address)}
        <span class="addr"><span class="num">{r.address}</span>{#if r.label}<span class="faint tag">{r.label}</span>{/if}</span>
      {/each}
    </dd>
    <dt class="label">May be approved to spend</dt>
    <dd>{data.mandate.spenders}</dd>
  </dl>
</section>

{#each data.senders as s (s.address)}
  <section class="block">
    <div class="head">
      <h2 class="heading">The books</h2>
      {#if s.accounting}<Pill tone={s.accounting.tone} label={s.accounting.tone === "ok" ? "Balanced" : "Unexplained change"} />{/if}
    </div>
    <p class="label addr-line">{s.label}</p>
    {#if s.accounting}
      {@const a = s.accounting}
      <div class="books">
        <div class="plates">
          <div class="plate"><span>Start, block {a.startBlock}</span><span class="money">{a.start}</span></div>
          <div class="plate"><span>Fees paid</span><span class="money">− {a.fees}</span></div>
          <div class="plate"><span>Sent to others</span><span class="money">− {a.outflow}</span></div>
          <div class="plate"><span>Expected now</span><span class="money">{a.expected}</span></div>
          <div class="plate"><span>Actually now</span><span class="money">{a.now}</span></div>
          <div class="plate"><span>Unexplained →</span><span class="money">{a.unexplained}</span></div>
        </div>
        <div class="key-idea" data-tone={a.tone}>
          <span class="label">+ Verdict</span>
          <span class="verdict">{a.verdict}</span>
          <span class="muted small">
            Nonce on chain <span class="num">{s.chainNonce}</span> / gaps <span class="num">{s.gaps}</span>
            {#if s.duplicates}/ duplicates <span class="num">{s.duplicates}</span>{/if}
          </span>
        </div>
      </div>
    {/if}
  </section>
{/each}

<style>
  .page-head {
    padding-bottom: var(--space-6);
  }

  .page-head .label {
    margin: 0 0 var(--space-3);
  }

  .block + .block {
    margin-top: var(--space-7);
  }

  .block > .heading {
    margin-bottom: var(--space-5);
  }

  .folders {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: var(--space-4);
  }

  .limit {
    display: grid;
    gap: var(--space-3);
    justify-items: center;
    padding: var(--space-6) var(--space-5) var(--space-5);
    background: var(--void);
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
  }

  .limit .progress {
    width: 100%;
  }

  .limit-text {
    display: grid;
    justify-items: center;
    gap: 2px;
  }

  .limit-name {
    font-size: var(--step-1);
    font-weight: 400;
  }

  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-3) var(--space-6);
    margin: 0;
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
    gap: var(--space-3);
  }

  .addr-line {
    margin: var(--space-2) 0 var(--space-5);
    overflow-wrap: anywhere;
  }

  .books {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: var(--space-6);
    align-items: start;
  }

  .verdict {
    font-size: var(--step-1);
    color: var(--tone);
  }

  .small {
    font-size: var(--step--1);
  }

  @media (max-width: 52rem) {
    .books {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
