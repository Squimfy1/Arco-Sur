<script lang="ts">
  // The foot of every screen, as the library's landing page ends: link
  // columns under mono caps, then the rule, the copyright, the rotated
  // logotype and a colophon.
  import type { View } from "../contract.ts";

  let { data }: { data: View } = $props();
</script>

<footer class="foot">
  <div class="inner">
    <div class="cols">
      <div class="col">
        <span class="label">Wallet</span>
        <a href="/">Portfolio</a>
        <a href="/activity">Operations</a>
        <a href="/rules">Rules</a>
      </div>
      <div class="col">
        <span class="label">Move</span>
        <a href="/send">Send</a>
        <a href="/receive">Receive</a>
        <a href="/swap">Swap</a>
      </div>
      <div class="col">
        <span class="label">Chain</span>
        <a href={data.wallet.url} target="_blank" rel="noreferrer">Explorer ↗</a>
        <a href={data.links.faucet} target="_blank" rel="noreferrer">Faucet ↗</a>
      </div>
      <div class="col">
        <span class="label">Network</span>
        <span class="muted">{data.network}</span>
        <span class="muted">block <span class="num">{data.block}</span></span>
      </div>
    </div>

    <div class="base">
      <span class="label">© 2026 Cathedral. Testnet only. Never real funds.</span>
      <span class="colophon">
        <svg class="placeholder" viewBox="0 0 34 44" aria-hidden="true"><rect x="1" y="1" width="32" height="42" /><path d="M1 1l32 42M33 1L1 43" /></svg>
        <span class="rotated">CTHDRL</span>
        <span class="label stamp">{data.readAt}<br />cathedral_wallet | testnet</span>
      </span>
    </div>
  </div>
</footer>

<style>
  .foot {
    border-top: 1px solid var(--line);
    background: var(--bg);
  }

  .inner {
    max-width: var(--content-width);
    margin: 0 auto;
    padding: var(--space-7) var(--space-6) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-7);
  }

  .cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--space-6);
    font-size: var(--step--1);
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .col a {
    color: var(--ink-read);
  }

  .col a:hover {
    color: var(--ink-bright);
  }

  .base {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-5);
    padding-top: var(--space-5);
    border-top: 1px solid var(--line);
  }

  .colophon {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .placeholder {
    width: 1.5rem;
    height: 2rem;
    fill: none;
    stroke: var(--ink-3);
    stroke-width: 1.5;
  }

  .rotated {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-family: var(--mono);
    font-size: var(--step--1);
    letter-spacing: 0.1em;
    color: var(--ink-2);
  }

  .stamp {
    line-height: 1.6;
    text-transform: none;
    letter-spacing: 0.04em;
  }
</style>
