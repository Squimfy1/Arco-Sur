<script lang="ts">
  // Operations: every line of the evidence log, newest first, by day.
  import Operation from "#lib/ui/Operation.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Cathedral · Operations</title>
</svelte:head>

<header class="page-head">
  <p class="label">Wallet / operations / {data.stats.operations} lines</p>
  <h1 class="display">Every <em>operation</em>, checked against the chain</h1>
  <p class="lede muted">{data.verdict.counts}.</p>
</header>

{#each data.days as day (day.label)}
  <section class="day">
    <h2 class="label day-head">{day.label}</h2>
    <ul>
      {#each day.rows as op (op.line)}
        <Operation {op} />
      {/each}
    </ul>
  </section>
{:else}
  <p class="card muted">No operations yet. The first send will appear here.</p>
{/each}

{#each data.orphans as o (o)}
  <p class="key-idea orphan" data-tone="bad">{o}</p>
{/each}

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

  .day + .day {
    margin-top: var(--space-6);
  }

  .day-head {
    margin: 0 0 var(--space-3);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    overflow: hidden;
    background: var(--pane);
  }

  .orphan {
    margin-top: var(--space-5);
    color: var(--tone);
  }
</style>
