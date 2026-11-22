<script lang="ts">
  // One operation's receipt: what the log says it was, and what the chain
  // said about it, in capitals on the darkest panel. Opens under an
  // operation in the list. Shape borrowed from Inherence's proof panel.
  import type { ActivityRow } from "../contract.ts";

  let { op }: { op: ActivityRow } = $props();
</script>

<div class="receipt" data-tone={op.tone}>
  <p>
    “{op.amount} {op.asset} to {op.toLabel || op.toShort}{#if op.nonce !== "—"}, nonce {op.nonce}{/if}.”
  </p>
  <p>The log against the chain: <span class="verdict">{op.status}</span></p>
  <p>{op.kind}, {op.when}</p>
  {#if op.detail}<p>{op.detail}</p>{/if}
  <p>Fee <span class="num money">{op.fee}</span></p>
  <p>Recipient <span class="num addr">{op.to}</span></p>
  <p class="faint">Evidence log line {op.line}</p>
  {#if op.txUrl}
    <a href={op.txUrl} target="_blank" rel="noreferrer">Open in explorer →</a>
  {/if}
</div>

<style>
  .receipt {
    margin: var(--space-2) var(--space-4) var(--space-3);
    padding: var(--space-5) var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--sidebar);
    box-shadow: inset 0 0 0 1px var(--rule);
    color: var(--ink-2);
    font-size: var(--step--1);
    line-height: 1.35;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  p {
    margin: 0 0 var(--space-2);
    overflow-wrap: anywhere;
  }

  p:first-child {
    color: var(--ink);
  }

  .verdict {
    color: var(--tone);
  }

  .addr {
    text-transform: none;
  }

  .faint {
    color: var(--ink-3);
  }

  a {
    color: var(--accent);
  }

  a:hover {
    text-decoration: underline;
  }
</style>
