<script lang="ts">
  // The app's frame: sidebar, top bar, and the screen in between. Every
  // screen shares one reading of the wallet (+layout.server.ts); Refresh
  // reads it again.
  import "@fontsource/inter-tight/400.css";
  import "@fontsource/inter-tight/500.css";
  import "@fontsource/inter-tight/600.css";
  import "@fontsource/space-grotesk/500.css";
  import "#lib/ui/theme.css";

  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import AccountChip from "#lib/ui/AccountChip.svelte";
  import Brand from "#lib/ui/Brand.svelte";
  import arcOnDark from "#lib/ui/brand/arc-on-dark.svg";
  import arcOnLight from "#lib/ui/brand/arc-on-light.svg";
  import Icon, { type IconName } from "#lib/ui/Icon.svelte";
  import { discreet, toggleDiscreet } from "#lib/ui/discreet.svelte.ts";
  import { startAurora } from "#lib/ui/globe/aurora.ts";
  import { followSystem } from "#lib/ui/settings.svelte.ts";

  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  const NAV: { href: string; label: string; icon: IconName }[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/portfolio", label: "Portfolio", icon: "portfolio" },
    { href: "/send", label: "Send", icon: "send" },
    { href: "/receive", label: "Receive", icon: "receive" },
    { href: "/swap", label: "Swap", icon: "swap" },
    { href: "/vaults", label: "Vaults", icon: "vault" },
    { href: "/activity", label: "Operations", icon: "operations" },
    { href: "/rules", label: "Rules", icon: "rules" },
  ];

  // "Match System" follows the computer's light or dark mode as it changes.
  $effect(followSystem);

  // The top bar's aurora, on every screen but Home, which has its own header.
  const home = $derived(page.url.pathname === "/");
  let aurora: HTMLCanvasElement | undefined = $state();
  $effect(() => {
    if (aurora) return startAurora(aurora);
  });

  // Refresh reads balances, history and operations again, live from Arc's
  // node, and says so for a moment when it has.
  let refreshing = $state(false);
  let updated = $state(false);
  async function refresh() {
    refreshing = true;
    try {
      await invalidateAll();
      updated = true;
      setTimeout(() => (updated = false), 2000);
    } finally {
      refreshing = false;
    }
  }

  // Read the wallet again every 15 seconds while the window is in view, so a
  // send or an incoming payment reaches the balance and its history on its
  // own, without pressing Refresh.
  const EVERY_MS = 15_000;
  $effect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !refreshing) void invalidateAll();
    }, EVERY_MS);
    return () => clearInterval(timer);
  });
</script>

<div class="app">
  <aside class="sidebar">
    <div class="brand"><Brand /></div>

    <div class="who">
      <AccountChip name="Testnet Wallet" wallet={data.wallet} />
    </div>

    <nav aria-label="Screens">
      <p class="nav-head">Menu</p>
      {#each NAV as item (item.href)}
        <a href={item.href} class="nav" aria-current={page.url.pathname === item.href ? "page" : undefined}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>

    <div class="account">
      <p class="network">
        <img class="on-dark" src={arcOnDark} alt="Arc" />
        <img class="on-light" src={arcOnLight} alt="Arc" />
        <span>{data.chain}</span>
      </p>
      <a
        href="/settings"
        class="settings"
        aria-label="Settings"
        title="Settings"
        aria-current={page.url.pathname === "/settings" ? "page" : undefined}
      >
        <Icon name="settings" size="1.1rem" />
      </a>
    </div>
  </aside>

  <div class="main">
    <header class="topbar" class:patterned={!home} data-theme={home ? undefined : "dark"}>
      {#if !home}
        <canvas class="aurora" bind:this={aurora} aria-hidden="true"></canvas>
      {/if}
      <div class="tools">
        <span class="updated" aria-live="polite">{updated ? "Updated" : ""}</span>
        <button class="tool" onclick={refresh} disabled={refreshing} aria-label="Read the wallet again" title="Refresh">
          <span class:spin={refreshing}><Icon name="refresh" /></span>
        </button>
        <button
          class="tool"
          onclick={toggleDiscreet}
          aria-pressed={discreet.on}
          aria-label={discreet.on ? "Show amounts" : "Hide amounts"}
          title={discreet.on ? "Show amounts" : "Hide amounts"}
        >
          <Icon name={discreet.on ? "eye-off" : "eye"} />
        </button>
      </div>
    </header>

    <main class="screen" class:wide={page.url.pathname === "/"}>
      {@render children()}
    </main>

    <footer class="legal">
      Cathedral is an independent, non-commercial, open-source testnet wallet built on Arc for learning, not affiliated
      with or endorsed by Circle; Arc™ is a trademark of Circle Internet Group, Inc. and/or its affiliates, and other marks
      belong to their owners.
    </footer>
  </div>
</div>

<style>
  .app {
    display: grid;
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
    min-height: 100vh;
  }

  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-4) var(--space-3);
    /* room for the window's traffic-light buttons */
    padding-top: calc(var(--topbar-height) + var(--space-2));
    background: var(--sidebar);
    border-right: 1px solid var(--rule);
    -webkit-app-region: drag;
  }

  .sidebar a {
    -webkit-app-region: no-drag;
  }

  .brand {
    display: flex;
    padding: 0 var(--space-3);
  }

  .who {
    padding: 0 var(--space-1);
  }

  nav {
    display: grid;
    gap: 2px;
  }

  .nav-head {
    margin: 0 0 var(--space-2);
    padding: 0 var(--space-3);
    font-size: var(--step--2);
    font-weight: 600;
    color: var(--ink-3);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    color: var(--ink-2);
    font-weight: 500;
  }

  .nav:hover {
    background: var(--panel);
    color: var(--ink);
  }

  .nav[aria-current="page"] {
    background: var(--panel-2);
    color: var(--ink);
  }

  .account {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding: 0 var(--space-1) 0 var(--space-3);
  }

  .network {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--step--2);
    white-space: nowrap;
    color: var(--ink-3);
  }

  /* Arc's own logo, as supplied: never recoloured. */
  .network img {
    height: 0.95rem;
    width: auto;
  }

  /* Arc's white logo on the dark look, its dark one on the light look. */
  :global([data-theme="light"]) .on-dark,
  :global(:root:not([data-theme="light"])) .on-light {
    display: none;
  }

  .settings {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    color: var(--ink-3);
    transition:
      background-color 0.2s var(--ease-out),
      color 0.2s var(--ease-out);
  }

  .settings:hover,
  .settings[aria-current="page"] {
    background: var(--panel-2);
    color: var(--ink);
  }

  .settings[aria-current="page"] :global(svg) {
    transform: rotate(45deg);
  }

  @media (prefers-reduced-motion: no-preference) {
    .settings :global(svg) {
      transition: transform 0.3s var(--ease-out);
    }
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-4);
    height: var(--topbar-height);
    padding: 0 var(--space-5);
    background: var(--bg);
    border-bottom: 1px solid var(--rule);
    -webkit-app-region: drag;
  }

  .topbar.patterned {
    background: var(--globe-bg);
  }

  /* The aurora fills the bar and thins out behind the buttons on the right.
     It takes the pointer (for its hover colour), so the window is moved by
     the sidebar instead. */
  .aurora {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    -webkit-app-region: no-drag;
    -webkit-mask-image: linear-gradient(to left, transparent 40px, var(--ink) 220px);
    mask-image: linear-gradient(to left, transparent 40px, var(--ink) 220px);
  }


  .updated {
    align-self: center;
    margin-right: var(--space-1);
    font-size: var(--step--1);
    color: var(--ok);
  }

  .tools {
    position: relative;
    display: flex;
    gap: var(--space-1);
    -webkit-app-region: no-drag;
  }

  .tool {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--ink-2);
    cursor: pointer;
  }

  .tool:hover {
    background: var(--panel);
    color: var(--ink);
  }

  .tool:disabled {
    cursor: progress;
  }

  .spin {
    display: grid;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* The legal line: small print along the bottom of every screen, level
     with the network line in the sidebar, always in view. */
  .main {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .screen {
    flex: 1;
  }

  .legal {
    position: sticky;
    bottom: 0;
    z-index: 1;
    padding: var(--space-3) var(--space-5);
    background: var(--bg);
    border-top: 1px solid var(--rule);
    font-size: var(--step--3);
    line-height: 1.4;
    color: var(--ink-3);
  }

  .screen {
    width: 100%;
    max-width: var(--content-width);
    margin: 0 auto;
    padding: var(--space-6) var(--space-5) var(--space-7);
  }

  /* Home uses the whole width, with an even margin each side. */
  .screen.wide {
    max-width: none;
    padding-inline: var(--space-6);
  }

  @media (max-width: 48rem) {
    .app {
      grid-template-columns: minmax(0, 1fr);
    }

    .sidebar {
      position: static;
      height: auto;
      padding-top: var(--space-4);
    }

    nav {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .nav-head {
      display: none;
    }

    .screen {
      padding: var(--space-5) var(--space-4) var(--space-6);
    }
  }
</style>
