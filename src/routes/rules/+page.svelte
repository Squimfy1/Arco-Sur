<script lang="ts">
  // Rules: what this wallet may do (the mandate), how much of it is used,
  // and the accounting that proves every USDC of change is explained. The
  // three parts sit behind tab cards; all three are in the page, only one
  // is shown.
  import GuardTree from "#lib/ui/GuardTree.svelte";
  import Meter from "#lib/ui/Meter.svelte";
  import Pill from "#lib/ui/Pill.svelte";
  import Stats from "#lib/ui/Stats.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const TABS = [
    { id: "limits", title: "Limits", text: "How much may go out: per payment and per month, per coin." },
    { id: "who", title: "Recipients", text: "Who may be paid. Anyone else is refused and logged." },
    { id: "accounting", title: "Accounting", text: "Every fee and transfer, checked against the balance." },
  ] as const;

  type TabId = (typeof TABS)[number]["id"];
  let tab = $state<TabId>("limits");
  // Only the chosen tab is a Tab stop; the arrows reach the others.
  const tabStop = (id: TabId) => (tab === id ? 0 : -1);

  // Left and right arrows move between the tabs, as in any tab list.
  function onKey(e: KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(i + step + TABS.length) % TABS.length];
    if (!next) return;
    tab = next.id;
    document.getElementById(`tab-${next.id}`)?.focus();
  }
</script>

<svelte:head>
  <title>Rules</title>
</svelte:head>

<h1>Rules</h1>
<p class="muted lede">The limits every send is checked against before signing, and the books that check the result.</p>

<section class="card">
  <h2 class="card-title">How the Guard Decides</h2>
  <GuardTree payment="Every payment" />
</section>

<div class="tabs" role="tablist" aria-label="Parts of the rules">
  {#each TABS as t, i (t.id)}
    <button
      id="tab-{t.id}"
      class="tab"
      type="button"
      role="tab"
      aria-selected={tab === t.id}
      aria-controls="panel-{t.id}"
      tabindex={tabStop(t.id)}
      onclick={() => (tab = t.id)}
      onkeydown={(e) => onKey(e, i)}
    >
      <span class="tab-title">{t.title}</span>
      <span class="tab-text">{t.text}</span>
    </button>
  {/each}
</div>

<div id="panel-limits" class="card panel" role="tabpanel" aria-labelledby="tab-limits" hidden={tab !== "limits"}>
  <h2 class="card-title">Spending Limits</h2>
  <div class="meters">
    {#each data.mandate.limits as l (l.asset)}
      <Meter limit={l} />
    {/each}
  </div>
</div>

<div id="panel-who" class="card panel" role="tabpanel" aria-labelledby="tab-who" hidden={tab !== "who"}>
  <h2 class="card-title">Who</h2>
  <dl>
    <dt>May Be Paid</dt>
    <dd>
      {#each data.mandate.recipients as r (r.address)}
        <span class="addr"><span class="num">{r.address}</span>{#if r.label}<span class="muted tag">({r.label})</span>{/if}</span>
      {/each}
    </dd>
    <dt>May Be Approved to Spend</dt>
    <dd>{data.mandate.spenders}</dd>
  </dl>
</div>

<div id="panel-accounting" class="panel" role="tabpanel" aria-labelledby="tab-accounting" hidden={tab !== "accounting"}>
  {#each data.senders as s (s.address)}
    <div class="card sender">
      <div class="head">
        <h2 class="card-title">Accounting</h2>
        {#if s.accounting}<Pill tone={s.accounting.tone} label={s.accounting.tone === "ok" ? "Balanced" : "Unexplained Change"} />{/if}
      </div>
      <p class="muted small num">{s.label}</p>
      {#if s.accounting}
        {@const a = s.accounting}
        <div class="figures">
          <Stats
            items={[
              { value: a.fees, title: "Fees Paid", note: "USDC, every transaction", money: true },
              { value: a.outflow, title: "Sent to Others", note: "USDC that left the wallet", money: true },
              { value: a.unexplained, title: "Unexplained", note: a.verdict, tone: a.tone, money: true },
            ]}
          />
        </div>
        <table>
          <tbody>
            <tr><th scope="row">Balance at Block <span class="num">{a.startBlock}</span></th><td class="num money">{a.start}</td></tr>
            <tr><th scope="row">Fees Paid</th><td class="num money">− {a.fees}</td></tr>
            <tr><th scope="row">Sent to Others</th><td class="num money">− {a.outflow}</td></tr>
            <tr class="sum"><th scope="row">Expected Now</th><td class="num money">{a.expected}</td></tr>
            <tr><th scope="row">Actually Now</th><td class="num money">{a.now}</td></tr>
            <tr class="sum" data-tone={a.tone}><th scope="row">Unexplained</th><td class="num money">{a.unexplained}</td></tr>
          </tbody>
        </table>
        <p class="verdict" data-tone={a.tone}>{a.verdict}</p>
      {/if}
      <p class="muted small">
        Nonce on chain <span class="num">{s.chainNonce}</span>, gaps <span data-tone={s.gapsTone} class="gaps">{s.gaps}</span>
        {#if s.duplicates}, duplicates <span class="num">{s.duplicates}</span>{/if}
      </p>
    </div>
  {/each}
</div>

<style>
  .lede {
    margin: var(--space-1) 0 var(--space-5);
  }

  /* Tab cards: the chosen one becomes a panel with the accent bar on top. */
  .tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    margin: var(--space-5) 0 var(--space-3);
  }

  .tab {
    display: grid;
    align-content: start;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-5);
    border: 0;
    border-top: 3px solid transparent;
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.2s var(--ease-out);
  }

  .tab:hover {
    background: var(--panel);
  }

  .tab[aria-selected="true"] {
    background: var(--panel);
    border-top-color: var(--accent);
  }

  .tab-title {
    color: var(--accent);
    font-size: var(--step-1);
  }

  .tab-text {
    font-size: var(--step--1);
    color: var(--ink-3);
  }

  .meters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--space-4);
  }

  .sender + .sender {
    margin-top: var(--space-5);
  }

  .figures {
    margin-top: var(--space-4);
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

  @media (max-width: 40rem) {
    .tabs {
      grid-template-columns: minmax(0, 1fr);
    }
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
