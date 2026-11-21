<script lang="ts">
  // One operation, as a row of the library's tables: a file-like glyph for
  // what it did, the kind and time, where it went, the chain's verdict, the
  // amount and fee, and a link to the explorer.
  import type { ActivityRow } from "../contract.ts";
  import Icon from "./Icon.svelte";
  import Pill from "./Pill.svelte";

  let { op }: { op: ActivityRow } = $props();
</script>

<li class="op">
  <span class="dir" data-dir={op.icon}><Icon name={op.icon} size="1.05rem" /></span>
  <span class="what">
    <span class="kind">{op.kind}</span>
    <span class="sub label">
      <span class="num">{op.time}</span>
      {#if op.toLabel}
        / to {op.toLabel}
      {:else}
        / to <span class="num" title={op.to}>{op.toShort}</span>
      {/if}
      {#if op.nonce !== "—"}/ nonce <span class="num">{op.nonce}</span>{/if}
    </span>
    {#if op.detail}<span class="detail">{op.detail}</span>{/if}
    {#each op.problems as p (p)}<span class="problem">{p}</span>{/each}
  </span>
  <span class="status"><Pill tone={op.tone} label={op.status} /></span>
  <span class="amount">
    <span class="num money">{op.amount} {op.asset}</span>
    <span class="fee label">fee <span class="num money">{op.fee}</span></span>
  </span>
  <span class="link">
    {#if op.txUrl}
      <a href={op.txUrl} target="_blank" rel="noreferrer" aria-label="Open line {op.line} in the explorer"><Icon name="external" size="1rem" /></a>
    {/if}
  </span>
</li>

<style>
  .op {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 7.5rem 11rem 1.5rem;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--line-soft);
  }

  .op:last-child {
    border-bottom: 0;
  }

  .op:hover {
    background: var(--row-hover);
  }

  .dir {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--raised);
    color: var(--ink-2);
  }

  .dir[data-dir="in"] {
    color: var(--ok);
  }

  .dir[data-dir="refused"] {
    color: var(--ink-3);
    background: transparent;
  }

  .what {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .kind {
    font-weight: 400;
    font-size: var(--step-1);
  }

  .sub {
    letter-spacing: 0.06em;
  }

  .detail,
  .problem {
    font-size: var(--step--1);
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }

  .problem {
    color: var(--bad);
  }

  .status {
    justify-self: end;
  }

  .amount {
    display: grid;
    justify-items: end;
    text-align: right;
  }

  .link a {
    color: var(--ink-3);
  }

  .link a:hover {
    color: var(--ink-bright);
  }

  @media (max-width: 44rem) {
    .op {
      grid-template-columns: auto minmax(0, 1fr) auto;
      padding: var(--space-3);
    }

    .status,
    .link {
      display: none;
    }
  }
</style>
