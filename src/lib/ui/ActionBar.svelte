<script lang="ts">
  // The wallet's main buttons: round, the first filled white, the rest
  // outlined. Send, Receive and Swap open screens in the app; Faucet and
  // Explorer open the web in your normal browser.
  import Icon, { type IconName } from "./Icon.svelte";

  let { faucet, explorer }: { faucet: string; explorer: string } = $props();

  const inApp: { href: string; label: string; icon: IconName; main?: boolean }[] = [
    { href: "/send", label: "Send", icon: "send", main: true },
    { href: "/receive", label: "Receive", icon: "receive" },
    { href: "/swap", label: "Swap", icon: "swap" },
  ];
</script>

<nav class="actions" aria-label="Wallet actions">
  {#each inApp as a (a.href)}
    <a class="action" href={a.href}>
      <span class="circle" class:main={a.main}><Icon name={a.icon} /></span>
      <span class="label">{a.label}</span>
    </a>
  {/each}
  <a class="action" href={faucet} target="_blank" rel="noreferrer">
    <span class="circle"><Icon name="faucet" /></span>
    <span class="label">Faucet ↗</span>
  </a>
  <a class="action" href={explorer} target="_blank" rel="noreferrer">
    <span class="circle"><Icon name="explorer" /></span>
    <span class="label">Explorer ↗</span>
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
  }

  .circle {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    border: 1px solid var(--bezel);
    background: transparent;
    color: var(--ink);
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .circle.main {
    border-color: var(--ink-bright);
    background: var(--ink-bright);
    color: var(--ink-on-light);
  }

  .action:hover .circle {
    border-color: var(--ink-2);
    background: var(--raised);
  }

  .action:hover .circle.main {
    background: var(--ink);
  }

  .action:hover .label {
    color: var(--ink);
  }
</style>
