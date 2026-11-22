<script lang="ts" module>
  // A row of figures, each a tinted tile with the number, then what it is
  // and a short note. Every value is a finished string from the backend.
  // Shape borrowed from Inherence's "receipt size / time to verify" row.
  import type { Tone } from "../contract.ts";

  export type Stat = { value: string; title: string; note: string; tone?: Tone; money?: boolean };
</script>

<script lang="ts">
  let { items }: { items: Stat[] } = $props();
</script>

<div class="stats">
  {#each items as s (s.title)}
    <div class="stat" data-tone={s.tone}>
      <span class="tile"><span class="num" class:money={s.money}>{s.value}</span></span>
      <span class="title">{s.title}</span>
      <span class="note">{s.note}</span>
    </div>
  {/each}
</div>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--space-4);
  }

  .stat {
    display: grid;
    align-content: start;
    min-width: 0;
  }

  .tile {
    display: grid;
    place-items: center;
    min-height: 5rem;
    padding: var(--space-3);
    border-radius: var(--radius);
    background: var(--panel-2);
    color: var(--accent);
    font-size: var(--step-2);
    text-align: center;
    overflow-wrap: anywhere;
  }

  .stat[data-tone] .tile {
    color: var(--tone);
  }

  .title {
    margin-top: var(--space-2);
    font-weight: 500;
  }

  .note {
    font-size: var(--step--1);
    color: var(--ink-3);
  }
</style>
