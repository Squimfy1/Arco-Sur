<script lang="ts">
  // Operations: every line of the evidence log, newest first, by day.
  import Operation from "#lib/ui/Operation.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Arco-Sur · Operations</title>
</svelte:head>

<h1>Operations</h1>
<p class="muted lede">{data.verdict.counts}. Every send the wallet tried, checked against the chain.</p>

{#each data.days as day (day.label)}
  <section class="card day">
    <h2 class="day-head">{day.label}</h2>
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
  <p class="card orphan" data-tone="bad">{o}</p>
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

  .day {
    padding: var(--space-4) var(--space-2);
  }

  .day + .day {
    margin-top: var(--space-4);
  }

  .day-head {
    margin: 0 0 var(--space-2);
    padding: 0 var(--space-4);
    font-size: var(--step--1);
    font-weight: 600;
    color: var(--ink-3);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .orphan {
    margin-top: var(--space-4);
    color: var(--tone);
  }
</style>
