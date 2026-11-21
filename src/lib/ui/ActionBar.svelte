<script lang="ts">
  // The wallet's main buttons. Send, Receive, Swap open screens in the app;
  // Faucet and Explorer open the web in your normal browser.
  import Icon, { type IconName } from "./Icon.svelte";

  let { faucet, explorer }: { faucet: string; explorer: string } = $props();

  const inApp: { href: string; label: string; icon: IconName }[] = [
    { href: "/send", label: "Send", icon: "send" },
    { href: "/receive", label: "Receive", icon: "receive" },
    { href: "/swap", label: "Swap", icon: "swap" },
  ];
</script>

<nav class="actions" aria-label="Wallet actions">
  {#each inApp as a (a.href)}
    <a class="action" href={a.href}>
      <span class="circle"><Icon name={a.icon} /></span>
      <span>{a.label}</span>
    </a>
  {/each}
  <a class="action" href={faucet} target="_blank" rel="noreferrer">
    <span class="circle"><Icon name="faucet" /></span>
    <span>Faucet</span>
  </a>
  <a class="action" href={explorer} target="_blank" rel="noreferrer">
    <span class="circle"><Icon name="explorer" /></span>
    <span>Explorer</span>
  </a>
</nav>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
  }

  .action {
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    font-size: var(--step--1);
    font-weight: 500;
    color: var(--ink-2);
  }

  .circle {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-ink);
    transition: transform 0.12s ease;
  }

  .action:hover .circle {
    transform: translateY(-1px);
    filter: brightness(1.06);
  }

  .action:hover {
    color: var(--ink);
  }
</style>
