<script lang="ts">
  // One operation: what it was, to whom, how much, and what the chain said.
  // Click it to open its receipt underneath.
  import type { ActivityRow } from "../contract.ts";
  import Icon from "./Icon.svelte";
  import Pill from "./Pill.svelte";
  import Receipt from "./Receipt.svelte";

  let { op }: { op: ActivityRow } = $props();
</script>

<li>
  <details>
    <summary class="op">
      <span class="dir" data-dir={op.icon}><Icon name={op.icon} size="1.1rem" /></span>
      <span class="what">
        <span class="kind">{op.kind}</span>
        <span class="sub">
          <span class="num">{op.time}</span>{#if op.toLabel}, to {op.toLabel}{:else}, to <span class="num" title={op.to}>{op.toShort}</span>{/if}{#if op.nonce !== "—"}, nonce <span class="num">{op.nonce}</span>{/if}
        </span>
        {#if op.detail}<span class="detail">{op.detail}</span>{/if}
        {#each op.problems as p (p)}<span class="problem">{p}</span>{/each}
      </span>
      <span class="status"><Pill tone={op.tone} label={op.status} /></span>
      <span class="amount">
        <span class="num money">{op.amount} {op.asset}</span>
        <span class="fee">fee <span class="num money">{op.fee}</span></span>
      </span>
      <span class="link">
        {#if op.txUrl}
          <a href={op.txUrl} target="_blank" rel="noreferrer" aria-label="Open line {op.line} in the explorer"><Icon name="external" size="1rem" /></a>
        {/if}
      </span>
    </summary>
    <Receipt {op} />
  </details>
</li>

<style>
  .op {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 6.5rem 11rem 1.5rem;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
  }

  .op {
    list-style: none;
    cursor: pointer;
  }

  .op::-webkit-details-marker {
    display: none;
  }

  .op:hover,
  details[open] > .op {
    background: var(--panel-2);
  }

  .dir {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: var(--panel-2);
    color: var(--ink-2);
  }

  .dir[data-dir="in"] {
    color: var(--ok);
  }

  .dir[data-dir="refused"] {
    color: var(--ink-3);
  }

  .what {
    display: grid;
    min-width: 0;
  }

  .kind {
    font-weight: 500;
  }

  .sub,
  .fee {
    font-size: var(--step--1);
    color: var(--ink-3);
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
    color: var(--accent);
  }

  @media (max-width: 40rem) {
    .op {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }

    .status,
    .link {
      display: none;
    }
  }
</style>
