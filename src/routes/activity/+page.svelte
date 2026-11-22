<script lang="ts">
  // Operations: every line of the evidence log, newest first, by day. The
  // Filter narrows it to one calendar day, one kind and one status.
  import FilterMenu from "#lib/ui/FilterMenu.svelte";
  import Icon from "#lib/ui/Icon.svelte";
  import Operation from "#lib/ui/Operation.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const ALL = "All";
  let chosen: Record<string, string> = $state({});
  let day = $state("");

  const rows = $derived(data.days.flatMap((d) => d.rows));
  // Each kind and status that appears, in the order they first appear.
  const distinct = (values: string[]) => [...new Set(values)];
  const groups = $derived([
    { id: "kind", label: "Kind", options: distinct(rows.map((r) => r.kind)) },
    { id: "status", label: "Status", options: distinct(rows.map((r) => r.status)) },
  ]);
  const matches = (r: (typeof rows)[number]) =>
    (day === "" || r.day === day) &&
    (!chosen.kind || chosen.kind === ALL || r.kind === chosen.kind) &&
    (!chosen.status || chosen.status === ALL || r.status === chosen.status);
  const shown = $derived(data.days.map((d) => ({ ...d, rows: d.rows.filter(matches) })).filter((d) => d.rows.length > 0));
  // The day as its heading names it ("Saturday 21 November 2026"), once chosen.
  const dayShown = $derived(data.days.find((d) => d.rows[0]?.day === day)?.label ?? day);
  // Export: the statement of exactly what the filter shows.
  const chosenOf = (id: string) => (chosen[id] && chosen[id] !== ALL ? chosen[id] : "");
  const exportHref = $derived(
    `/activity/report?${new URLSearchParams({ day, kind: chosenOf("kind"), status: chosenOf("status") })}`,
  );

  // The calendar runs from the first day with an operation to the last.
  const dayRange = $derived(
    rows.length === 0 ? undefined : { min: rows[rows.length - 1]?.day ?? "", max: rows[0]?.day ?? "" },
  );
</script>

<svelte:head>
  <title>Operations</title>
</svelte:head>

<h1>Operations</h1>
<p class="muted lede">{data.verdict.counts}. Every send the wallet tried, checked against the chain.</p>

{#if rows.length > 0}
  <div class="filter">
    <FilterMenu {groups} bind:chosen all={ALL} everything="All Operations" bind:day {dayShown} {dayRange} />
    <a class="btn outline export" href={exportHref}><Icon name="external" size="1.1rem" /> Export</a>
  </div>
{/if}

{#each shown as d (d.label)}
  <section class="card day">
    <h2 class="day-head">{d.label}</h2>
    <ul>
      {#each d.rows as op (op.line)}
        <Operation {op} />
      {/each}
    </ul>
  </section>
{:else}
  <p class="card muted">{rows.length === 0 ? "No operations yet. The first send will appear here." : "No operations match this filter. Try another day, or Show All."}</p>
{/each}

{#each data.orphans as o (o)}
  <p class="card orphan" data-tone="bad">{o}</p>
{/each}

<style>
  .lede {
    margin: var(--space-1) 0 var(--space-5);
  }

  .filter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .export {
    min-height: 3.25rem;
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
