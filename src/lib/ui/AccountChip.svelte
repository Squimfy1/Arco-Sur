<script lang="ts">
  // The account at the top of the sidebar: its name with a small menu, then
  // a chip with the network's icon, the short address, and a copy button.
  // Laid out like a browser wallet's account header. The menu opens in place,
  // right under the name, as a chip drawn like the address chip.
  import arcIcon from "./brand/arc-network.svg";
  import Icon from "./Icon.svelte";

  let { name, wallet }: { name: string; wallet: { address: string; short: string; url: string } } = $props();

  let copied = $state(false);
  let menu: HTMLDetailsElement | undefined = $state();

  async function copy() {
    await navigator.clipboard.writeText(wallet.address);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function closeMenu() {
    if (menu) menu.open = false;
  }
</script>

<div class="account">
  <details class="menu" bind:this={menu}>
    <summary class="name">
      <span>{name}</span>
      <Icon name="chevron" size="1rem" />
    </summary>
    <div class="pop">
      <a class="chip option" href={wallet.url} target="_blank" rel="noreferrer" onclick={closeMenu}>
        <span class="slot"><Icon name="external" size="1rem" /></span>
        <span class="label">View in Explorer</span>
      </a>
    </div>
  </details>

  <div class="chip">
    <img class="net" src={arcIcon} alt="Arc" />
    <span class="num addr" title={wallet.address}>{wallet.short}</span>
    <button class="copy" type="button" onclick={copy} aria-label={copied ? "Address copied" : "Copy address"} title={copied ? "Copied" : "Copy address"}>
      <Icon name={copied ? "check" : "copy"} size="1rem" />
    </button>
  </div>
</div>

<style>
  .account {
    display: grid;
    gap: var(--space-2);
    -webkit-app-region: no-drag;
  }

  .menu {
    display: grid;
    gap: var(--space-2);
  }

  .name {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--step-1);
    font-weight: 500;
    list-style: none;
    cursor: pointer;
  }

  .name::-webkit-details-marker {
    display: none;
  }

  .name :global(svg) {
    color: var(--ink-3);
    transition: transform 0.2s var(--ease-out);
  }

  .menu[open] .name :global(svg) {
    transform: rotate(180deg);
  }

  /* The option: the same chip as the address below it. */
  .option {
    padding-right: var(--space-3);
    color: var(--ink-2);
    transition:
      background-color 0.2s var(--ease-out),
      color 0.2s var(--ease-out);
  }

  .option:hover {
    background: var(--panel-2);
    color: var(--ink);
  }

  .slot {
    display: grid;
    place-items: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius);
    background: var(--panel-2);
  }

  .label {
    font-size: var(--step--1);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: no-preference) {
    .menu[open] .pop {
      animation: drop 160ms var(--ease-out);
    }

    @keyframes drop {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
  }

  .chip {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: max-content;
    max-width: 100%;
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-1);
    border-radius: var(--radius-lg);
    background: var(--panel);
  }

  .net {
    flex: none;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius);
  }

  .addr {
    font-size: var(--step--1);
    color: var(--ink-2);
    white-space: nowrap;
  }

  .copy {
    display: grid;
    place-items: center;
    padding: var(--space-1);
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: var(--ink-3);
    cursor: pointer;
  }

  .copy:hover {
    background: var(--hover);
    color: var(--ink);
  }
</style>
