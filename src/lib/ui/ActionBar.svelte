<script lang="ts">
  // The wallet's main buttons, as pills: Send filled, the rest outlined.
  // Send, Receive, Swap open screens in the app; Faucet and Explorer open
  // the web in your normal browser.
  import Icon, { type IconName } from "./Icon.svelte";

  let { faucet, explorer }: { faucet: string; explorer: string } = $props();

  const inApp: { href: string; label: string; icon: IconName }[] = [
    { href: "/send", label: "Send", icon: "send" },
    { href: "/receive", label: "Receive", icon: "receive" },
    { href: "/swap", label: "Swap", icon: "swap" },
  ];
</script>

<nav class="actions" aria-label="Wallet actions">
  {#each inApp as a, i (a.href)}
    <a class="btn" class:outline={i > 0} href={a.href}><Icon name={a.icon} size="1.1rem" /> {a.label}</a>
  {/each}
  <a class="btn outline" href={faucet} target="_blank" rel="noreferrer"><Icon name="faucet" size="1.1rem" /> Faucet</a>
  <a class="btn outline" href={explorer} target="_blank" rel="noreferrer"><Icon name="explorer" size="1.1rem" /> Explorer</a>
</nav>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
</style>
