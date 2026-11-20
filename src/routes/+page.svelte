<script lang="ts">
  // Stage 9: this template places finished strings. It does no arithmetic and
  // formats nothing; every value was decided by buildView on the server.
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Arco-Sur · {data.wallet.short}</title>
</svelte:head>

<div class="page">
  <header class="top">
    <div class="who">
      <p class="product">Arco-Sur</p>
      <h1>
        Wallet
        <a class="mono addr" href={data.wallet.url} rel="external noreferrer" target="_blank">{data.wallet.address}</a>
      </h1>
    </div>
    <dl class="meta">
      <div><dt>Network</dt><dd>{data.network}</dd></div>
      <div><dt>Block</dt><dd class="mono">{data.block}</dd></div>
      <div><dt>Read at</dt><dd class="mono">{data.readAt}</dd></div>
    </dl>
    <a class="reread" href="/" data-sveltekit-reload>Read again</a>
  </header>

  <p class="verdict tone-{data.verdict.tone}" role="status">
    <span class="dot" aria-hidden="true"></span>
    <strong>{data.verdict.label}</strong>
    <span class="counts">{data.verdict.counts}</span>
  </p>

  <div class="columns">
    <section aria-labelledby="h-holdings">
      <h2 id="h-holdings">Holdings</h2>
      <table>
        <thead>
          <tr><th scope="col">Asset</th><th scope="col" class="num">Amount</th><th scope="col">Read from</th></tr>
        </thead>
        <tbody>
          {#each data.holdings as h (h.asset)}
            <tr>
              <th scope="row">{h.asset}</th>
              <td class="num mono">{h.amount}</td>
              <td class="soft">{h.source}, {h.decimals} decimals</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="note tone-{data.holdingsCheck.tone}">{data.holdingsCheck.text}</p>
    </section>

    <section aria-labelledby="h-mandate">
      <h2 id="h-mandate">Mandate</h2>
      <dl class="rules">
        <div>
          <dt>May pay</dt>
          <dd>
            {#each data.mandate.recipients as r (r)}<span class="mono wrap">{r}</span>{/each}
          </dd>
        </div>
        <div><dt>May approve</dt><dd>{data.mandate.spenders}</dd></div>
      </dl>
      <table class="limits">
        <thead>
          <tr>
            <th scope="col">Asset</th>
            <th scope="col" class="num">Per payment</th>
            <th scope="col" class="num">Used of total</th>
            <th scope="col" class="num">Left</th>
          </tr>
        </thead>
        <tbody>
          {#each data.mandate.limits as l (l.asset)}
            <tr>
              <th scope="row">{l.asset}</th>
              <td class="num mono">{l.perPayment}</td>
              <td class="num">
                <span class="mono">{l.used} / {l.total}</span>
                <span class="bar" aria-hidden="true"><span style="width: {l.usedPercent}%"></span></span>
              </td>
              <td class="num mono">{l.left}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  </div>

  <section aria-labelledby="h-activity">
    <h2 id="h-activity">Activity <span class="soft">newest first, each line checked against the chain</span></h2>
    {#if data.activity.length === 0}
      <p class="soft">Nothing logged yet. Every send, and every refusal, will appear here.</p>
    {:else}
      <!-- A table wider than a phone scrolls sideways; tabindex lets a keyboard reach it to scroll. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="scroll" role="region" aria-labelledby="h-activity" tabindex="0">
        <table class="activity">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col" class="num">Nonce</th>
              <th scope="col">Check</th>
              <th scope="col">What</th>
              <th scope="col" class="num">Amount</th>
              <th scope="col">To</th>
              <th scope="col" class="num">Fee, USDC</th>
              <th scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {#each data.activity as a (a.line)}
              <tr class:has-problems={a.problems.length > 0}>
                <td class="mono nowrap">{a.when}</td>
                <td class="num mono">{a.nonce}</td>
                <td><span class="badge tone-{a.tone}">{a.status}</span></td>
                <td class="nowrap">{a.kind}</td>
                <td class="num mono nowrap">{a.amount} <span class="unit">{a.asset}</span></td>
                <td class="nowrap">
                  <span class="mono" title={a.to}>{a.toShort}</span>
                  {#if a.toLabel}<span class="soft">{a.toLabel}</span>{/if}
                </td>
                <td class="num mono">{a.fee}</td>
                <td class="detail">
                  {#if a.txUrl}
                    <a href={a.txUrl} rel="external noreferrer" target="_blank">{a.detail || "transaction"}</a>
                  {:else}
                    {a.detail}
                  {/if}
                </td>
              </tr>
              {#if a.problems.length > 0}
                <tr class="problems">
                  <td colspan="8">
                    <ul>
                      {#each a.problems as p (p)}<li>{p}</li>{/each}
                    </ul>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    {#each data.orphans as o (o)}
      <p class="note tone-bad">{o}</p>
    {/each}
  </section>

  {#each data.senders as s (s.address)}
    <section aria-labelledby="h-accounts-{s.address}">
      <h2 id="h-accounts-{s.address}">Accounting <span class="soft mono">{s.label}</span></h2>
      <div class="columns">
        {#if s.accounting}
          {@const b = s.accounting}
          <dl class="statement">
            <div><dt>Balance before the first logged transaction <span class="soft">block {b.startBlock}</span></dt><dd class="mono">{b.start}</dd></div>
            <div><dt>Minus fees paid</dt><dd class="mono">−{b.fees}</dd></div>
            <div><dt>Minus sent to others</dt><dd class="mono">−{b.outflow}</dd></div>
            <div class="sum"><dt>Expected now</dt><dd class="mono">{b.expected}</dd></div>
            <div><dt>Balance now</dt><dd class="mono">{b.now}</dd></div>
            <div class="sum tone-{b.tone}"><dt>Unexplained</dt><dd class="mono">{b.unexplained}</dd></div>
            <p class="note tone-{b.tone}">{b.verdict} All amounts in USDC.</p>
          </dl>
        {:else}
          <p class="soft">Balance not checked: nothing mined yet, or the node keeps no balance history.</p>
        {/if}
        <dl class="rules">
          <div><dt>Chain nonce</dt><dd class="mono">{s.chainNonce}</dd></div>
          <div>
            <dt>Nonce gaps</dt>
            <dd class="tone-text-{s.gapsTone}">
              {s.gaps}{#if s.gapsTone === "ok"}<span class="soft">: every transaction on chain is in the log</span>{:else}<span>: on chain, not in the log</span>{/if}
            </dd>
          </div>
          {#if s.duplicates}
            <div><dt>Logged twice</dt><dd class="tone-text-bad mono">{s.duplicates}</dd></div>
          {/if}
          <div><dt>Fees paid</dt><dd><span class="mono">{s.feesPaid}</span> USDC</dd></div>
        </dl>
      </div>
    </section>
  {/each}

  <footer>
    <p>
      Read-only. Sending from this page comes next; until then use <code>npm run send</code>, which runs
      the same guard against the same mandate. Evidence lives in <code>evidence/sends.jsonl</code>.
    </p>
  </footer>
</div>

<style>
  .page {
    max-width: 76rem;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  .mono {
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
    font-size: 0.92em;
  }

  .soft {
    color: var(--ink-3);
    font-weight: 400;
  }

  .nowrap {
    white-space: nowrap;
  }

  .wrap {
    display: block;
    overflow-wrap: anywhere;
  }

  /* ── header ─────────────────────────────── */
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-3) var(--space-6);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--rule-strong);
  }

  .who {
    flex: 1 1 24rem;
    min-width: 0;
  }

  .product {
    margin: 0;
    font-size: var(--step--1);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink-2);
  }

  h1 {
    margin: var(--space-1) 0 0;
    font-size: var(--step-2);
    font-weight: 500;
    line-height: 1.25;
  }

  .addr {
    font-size: var(--step-1);
    overflow-wrap: anywhere;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-5);
    margin: 0;
  }

  .meta dt {
    font-size: var(--step--1);
    color: var(--ink-3);
  }

  .meta dd {
    margin: 0;
  }

  .reread {
    font-size: var(--step--1);
    font-weight: 500;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rule-strong);
    border-radius: 4px;
    text-decoration: none;
    background: var(--panel);
  }

  .reread:hover {
    border-color: var(--ink-2);
  }

  /* ── verdict ────────────────────────────── */
  .verdict {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2) var(--space-3);
    margin: 0;
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--rule);
  }

  .verdict strong {
    font-weight: 600;
  }

  .verdict .counts {
    color: var(--ink-2);
  }

  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: currentColor;
    align-self: center;
  }

  .verdict.tone-ok strong,
  .verdict.tone-ok .dot {
    color: var(--ok);
  }

  .verdict.tone-bad strong,
  .verdict.tone-bad .dot {
    color: var(--bad);
  }

  /* ── sections ───────────────────────────── */
  section {
    margin-top: var(--space-6);
    min-width: 0;
  }

  .columns > section {
    margin-top: 0;
  }

  /* minmax(0, …): a column may be narrower than its widest content, so a
     long address wraps instead of pushing the page sideways on a phone. */
  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-6);
    margin-top: var(--space-6);
  }

  section .columns {
    margin-top: 0;
  }

  @media (min-width: 60rem) {
    .columns {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }

  h2 {
    margin: 0 0 var(--space-3);
    font-size: var(--step-1);
    font-weight: 600;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    align-items: baseline;
  }

  h2 .soft {
    font-size: var(--step--1);
    overflow-wrap: anywhere;
  }

  /* ── tables ─────────────────────────────── */
  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: var(--space-2) var(--space-3) var(--space-2) 0;
    border-bottom: 1px solid var(--rule);
    vertical-align: baseline;
  }

  thead th {
    font-size: var(--step--1);
    font-weight: 500;
    color: var(--ink-3);
    border-bottom-color: var(--rule-strong);
  }

  tbody th {
    font-weight: 500;
  }

  .num {
    text-align: right;
  }

  td.soft {
    font-size: var(--step--1);
  }

  .scroll {
    overflow-x: auto;
  }

  .activity {
    min-width: 62rem;
    font-size: var(--step--1);
  }

  .activity .detail {
    max-width: 22rem;
    color: var(--ink-2);
  }

  .unit {
    color: var(--ink-3);
  }

  .activity tr.has-problems td {
    border-bottom: none;
  }

  .problems td {
    padding-top: 0;
    color: var(--bad);
  }

  .problems ul {
    margin: 0;
    padding-left: 1.2em;
  }

  .badge {
    display: inline-block;
    padding: 0 var(--space-2);
    border-radius: 3px;
    font-size: var(--step--1);
    font-weight: 500;
    white-space: nowrap;
  }

  .badge.tone-ok { color: var(--ok); background: var(--ok-bg); }
  .badge.tone-warn { color: var(--warn); background: var(--warn-bg); }
  .badge.tone-bad { color: var(--bad); background: var(--bad-bg); }
  .badge.tone-quiet { color: var(--quiet); background: var(--quiet-bg); }

  .tone-text-ok { color: var(--ok); }
  .tone-text-bad { color: var(--bad); }

  .bar {
    display: block;
    height: 4px;
    margin-top: var(--space-1);
    background: var(--track);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }

  /* ── notes and definition lists ─────────── */
  .note {
    margin: var(--space-3) 0 0;
    font-size: var(--step--1);
    color: var(--ink-2);
  }

  .note.tone-bad {
    color: var(--bad);
  }

  .note.tone-warn {
    color: var(--warn);
  }

  .rules {
    margin: 0 0 var(--space-4);
  }

  .rules > div {
    display: grid;
    grid-template-columns: 8rem minmax(0, 1fr);
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rule);
  }

  .rules dt {
    color: var(--ink-3);
    font-size: var(--step--1);
    padding-top: 0.1em;
  }

  .rules dd {
    margin: 0;
    min-width: 0;
  }

  .statement {
    margin: 0;
  }

  .statement > div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--rule);
  }

  .statement dt .soft {
    font-size: var(--step--1);
  }

  .statement dt {
    min-width: 0;
  }

  .statement dd {
    margin: 0;
    text-align: right;
    white-space: nowrap;
  }

  .statement .sum {
    border-top: 1px solid var(--rule-strong);
    font-weight: 500;
  }

  .statement .sum.tone-ok dd { color: var(--ok); }
  .statement .sum.tone-bad dd { color: var(--bad); }

  /* ── footer ─────────────────────────────── */
  footer {
    margin-top: var(--space-6);
    padding-top: var(--space-4);
    border-top: 1px solid var(--rule);
    font-size: var(--step--1);
    color: var(--ink-3);
    max-width: 44rem;
  }

  code {
    font-family: var(--mono);
    font-size: 0.95em;
  }

  @media (max-width: 30rem) {
    .rules > div {
      grid-template-columns: 1fr;
      gap: 0;
    }
  }
</style>
