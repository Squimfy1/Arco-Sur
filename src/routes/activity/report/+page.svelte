<script lang="ts">
  // The statement: Operations as a dated, printable record. On screen it is
  // a sheet of paper in the light look, with a bar above it to choose a file
  // type and download. Printed or saved as PDF, only the sheet appears, on
  // upright A4 pages with the copyright and the page number at the foot of each.
  import Brand from "#lib/ui/Brand.svelte";
  import FormatPicker, { type Format } from "#lib/ui/FormatPicker.svelte";
  import Icon from "#lib/ui/Icon.svelte";
  import { csv, save, word } from "#lib/ui/export.ts";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const s = $derived(data.statement);

  let format: Format = $state("pdf");
  let sheet: HTMLElement | undefined = $state();
  const name = $derived(`Cathedral Statement ${s.fileDate}`);

  // Printed pages: upright A4, with the copyright and "Page 1 of 3" at the
  // foot of each. Page rules cannot live in a component's own styles, so
  // they are added to the page's head while the statement is open.
  $effect(() => {
    const foot = 'font-family: "Inter Tight", Arial, sans-serif; font-size: 7.5pt; color: var(--doc-muted);';
    const rules = document.createElement("style");
    rules.textContent = [
      "@page { size: A4 portrait; margin: 16mm 14mm 18mm;",
      `@bottom-left { content: ${JSON.stringify(`${s.copyright}. ${s.notice}`)}; ${foot} }`,
      `@bottom-right { content: "Page " counter(page) " of " counter(pages); ${foot} } }`,
    ].join(" ");
    document.head.append(rules);
    // Tells the desktop app's PDF printer the page is ready (electron/main.js).
    document.documentElement.dataset.printReady = "1";
    return () => {
      rules.remove();
      delete document.documentElement.dataset.printReady;
    };
  });

  function download() {
    if (format === "csv") return save(`${name}.csv`, "text/csv;charset=utf-8", csv(s));
    if (format === "doc" && sheet) return save(`${name}.doc`, "application/msword", word(sheet));
    // PDF: the desktop app makes the file itself (electron/main.js). In a
    // browser, the print window offers Save as PDF.
    if (location.protocol === "arco:") {
      const query = new URLSearchParams({ page: location.pathname.concat(location.search), name });
      const a = Object.assign(document.createElement("a"), { href: `/export.pdf?${query}`, download: `${name}.pdf` });
      a.click();
    } else {
      print();
    }
  }
</script>

<svelte:head>
  <title>{s.title}</title>
</svelte:head>

<div class="bar">
  <a class="back" href="/activity"><Icon name="chevron" size="1.1rem" /> Operations</a>
  <div class="tools">
    <FormatPicker bind:value={format} />
    <button class="btn" type="button" onclick={download}><Icon name="receive" size="1.1rem" /> Download</button>
  </div>
</div>

<article class="sheet" data-theme="light" bind:this={sheet}>
  <header class="head">
    <span class="brand"><Brand /></span>
    <span class="muted">Generated {s.generated}</span>
  </header>

  <h1>{s.title}</h1>

  <dl class="meta">
    <div><dt>Wallet</dt><dd class="num">{s.wallet}</dd></div>
    <div><dt>Network</dt><dd>{s.network}</dd></div>
    <div><dt>Covers</dt><dd>{s.covers}</dd></div>
  </dl>

  <table class="summary">
    <tbody>
      <tr>
        {#each s.summary as x (x.label)}
          <td><span class="muted">{x.label}</span><span class="figure num">{x.value}</span></td>
        {/each}
      </tr>
    </tbody>
  </table>

  {#if s.rows.length > 0}
    <table class="ops">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th class="num">Amount</th>
          <th>Counterparty</th>
          <th class="num">Nonce</th>
          <th class="num">Fee (USDC)</th>
          <th>Status</th>
          <th>Transaction</th>
        </tr>
      </thead>
      <tbody>
        {#each s.rows as r, i (i)}
          <tr data-tone={r.tone}>
            <td class="nowrap">{r.date}<span class="detail time">{r.time}</span></td>
            <td>
              {r.kind}
              {#if r.detail}<span class="detail">{r.detail}</span>{/if}
            </td>
            <td class="num nowrap">{r.amount} {r.asset}</td>
            <td>{r.counterparty}</td>
            <td class="num">{r.nonce}</td>
            <td class="num">{r.fee}</td>
            <td><span class="status">{r.status}</span></td>
            <td class="num nowrap">
              {#if r.txUrl}<a href={r.txUrl} target="_blank" rel="noreferrer">{r.tx}</a>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="muted none">No operations match these filters.</p>
  {/if}

  <footer class="foot">
    <span>{s.copyright}</span>
    <span>{s.notice}</span>
  </footer>
</article>

<style>
  /* The bar above the sheet: back, file type, download. Not printed. */
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-3);
    max-width: 52rem;
    margin: 0 auto var(--space-5);
  }

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

  .tools {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* The sheet: paper in the light look, upright A4 in proportion. */
  .sheet {
    max-width: 52rem;
    margin: 0 auto;
    padding: var(--space-7) var(--space-7) var(--space-6);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--ink);
    box-shadow: var(--pop-shadow);
    font-size: var(--step--1);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--space-4);
    border-bottom: 2px solid var(--accent);
  }

  .brand {
    font-size: var(--step-2);
  }

  h1 {
    margin: var(--space-6) 0 var(--space-4);
    font-size: var(--step-4);
  }

  .meta {
    display: grid;
    gap: var(--space-1);
    margin: 0 0 var(--space-5);
  }

  .meta div {
    display: grid;
    grid-template-columns: 6rem minmax(0, 1fr);
  }

  .meta dt {
    color: var(--ink-3);
  }

  .meta dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  .summary {
    margin-bottom: var(--space-6);
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
  }

  .summary td {
    padding: var(--space-3) var(--space-4) var(--space-3) 0;
  }

  .summary td span {
    display: block;
  }

  .figure {
    margin-top: var(--space-1);
    font-size: var(--step-2);
    font-weight: 500;
  }

  .ops th {
    padding: var(--space-2) var(--space-2) var(--space-2) 0;
    border-bottom: 1px solid var(--rule-strong);
    color: var(--ink-3);
    font-weight: 500;
    text-align: left;
    white-space: nowrap;
  }

  .ops td {
    padding: var(--space-2) var(--space-2) var(--space-2) 0;
    border-bottom: 1px solid var(--rule);
    vertical-align: top;
  }

  .ops .num,
  .ops th.num {
    text-align: right;
  }

  .nowrap {
    white-space: nowrap;
  }

  .time {
    font-variant-numeric: tabular-nums;
  }

  .detail {
    display: block;
    max-width: 22rem;
    color: var(--ink-3);
    overflow-wrap: anywhere;
  }

  .status {
    color: var(--tone);
    font-weight: 500;
  }

  .ops a {
    color: var(--accent);
  }

  .none {
    margin: 0 0 var(--space-6);
  }

  .foot {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    margin-top: var(--space-6);
    padding-top: var(--space-3);
    border-top: 1px solid var(--rule);
    color: var(--ink-3);
    font-size: var(--step--2);
  }

  /* Printing or saving as PDF: only the sheet, edge to edge; the copyright
     and page number go in each page's foot instead. */
  @media print {
    :global(.sidebar),
    :global(.topbar),
    :global(.legal),
    .bar,
    .foot {
      display: none !important;
    }

    :global(.app),
    :global(.main) {
      display: block !important;
      min-height: 0 !important;
    }

    :global(.screen) {
      max-width: none !important;
      padding: 0 !important;
    }

    :global(html),
    :global(body) {
      background: none !important;
    }

    .sheet {
      max-width: none;
      padding: 0;
      border-radius: 0;
      box-shadow: none;
      background: none;
      font-size: 8pt;
    }

    h1 {
      font-size: 22pt;
    }

    .figure {
      font-size: 12pt;
    }

    .detail {
      max-width: 14rem;
    }

    .ops tr {
      break-inside: avoid;
    }

    .ops thead {
      display: table-header-group;
    }
  }
</style>
