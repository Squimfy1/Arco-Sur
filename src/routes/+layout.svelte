<script lang="ts">
  // The app's frame: sidebar, top bar, and the screen in between, dressed
  // as Cathedral. The logo heads the sidebar; menu items are pills, the one
  // you are on lit by the red bloom. Every screen shares one reading of the
  // wallet (+layout.server.ts); Refresh reads it again.
  import "@fontsource/geist/300.css";
  import "@fontsource/geist/400.css";
  import "@fontsource/geist/500.css";
  import "@fontsource/geist-mono/300.css";
  import "@fontsource/geist-mono/400.css";
  import "@fontsource/share-tech-mono/400.css";
  import "@fontsource/space-grotesk/500.css";
  import "#lib/ui/theme.css";

  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import Brand from "#lib/ui/Brand.svelte";
  import Footer from "#lib/ui/Footer.svelte";
  import Icon, { type IconName } from "#lib/ui/Icon.svelte";
  import Pill from "#lib/ui/Pill.svelte";
  import { discreet, toggleDiscreet } from "#lib/ui/discreet.svelte.ts";

  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  const NAV: { href: string; label: string; icon: IconName }[] = [
    { href: "/", label: "Portfolio", icon: "portfolio" },
    { href: "/activity", label: "Operations", icon: "operations" },
    { href: "/send", label: "Send", icon: "send" },
    { href: "/receive", label: "Receive", icon: "receive" },
    { href: "/swap", label: "Swap", icon: "swap" },
    { href: "/rules", label: "Rules", icon: "rules" },
  ];

  let refreshing = $state(false);
  async function refresh() {
    refreshing = true;
    try {
      await invalidateAll();
    } finally {
      refreshing = false;
    }
  }
</script>

<div class="app">
  <aside class="sidebar">
    <a href="/" class="brand" aria-label="Cathedral, portfolio"><Brand /></a>

    <nav aria-label="Screens">
      <p class="label head">Menu</p>
      {#each NAV as item (item.href)}
        <a href={item.href} class="nav" aria-current={page.url.pathname === item.href ? "page" : undefined}>
          <Icon name={item.icon} />
          <span class="nav-label">{item.label}</span>
          {#if item.href === "/activity"}<span class="badge num">{data.stats.operations}</span>{/if}
          {#if item.href === "/swap"}<span class="badge">off</span>{/if}
        </a>
      {/each}
    </nav>

    <div class="account">
      <p class="label head">Account</p>
      <a href="/receive" class="acct">
        <span class="acct-mark num" aria-hidden="true">0x</span>
        <span class="acct-text">
          <span>Testnet wallet</span>
          <span class="num faint">{data.wallet.short}</span>
        </span>
      </a>
      <div class="plates">
        <div class="plate"><span>Net</span><span>Arc test</span></div>
        <div class="plate"><span>Block</span><span>{data.block}</span></div>
      </div>
    </div>
  </aside>

  <div class="main">
    <header class="topbar">
      <div class="sync">
        <Pill tone={data.verdict.tone} label={data.verdict.label} />
        <span class="label">block <span class="num">{data.block}</span> / read <span class="num">{data.readAt}</span></span>
      </div>
      <div class="tools">
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

    <main class="screen">
      {@render children()}
    </main>

    <Footer {data} />
  </div>
</div>

<style>
  .app {
    display: grid;
    grid-template-columns: 15.5rem minmax(0, 1fr);
    min-height: 100vh;
  }

  .sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    /* room for the window's traffic-light buttons */
    padding: 3.25rem var(--space-3) var(--space-3);
    background: var(--pane);
    border-right: 1px solid var(--line);
    -webkit-app-region: drag;
  }

  .sidebar a {
    -webkit-app-region: no-drag;
  }

  .brand {
    padding: 0 var(--space-3);
  }

  nav {
    display: grid;
    gap: 2px;
  }

  .head {
    margin: 0 0 var(--space-2);
    padding: 0 var(--space-3);
  }

  /* Menu items are pills; the current one is lifted a tint and bloomed. */
  .nav {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 2.75rem;
    padding: 0 var(--space-3);
    border-radius: var(--radius);
    color: var(--ink-2);
    font-size: 0.9375rem;
  }

  .nav:hover {
    background: var(--raised);
    color: var(--ink);
  }

  .nav[aria-current="page"] {
    background: var(--line);
    color: var(--ink);
    font-weight: 400;
  }

  .nav[aria-current="page"]::before {
    content: "";
    position: absolute;
    left: calc(var(--space-3) * -1);
    top: 50%;
    width: 3px;
    height: 22px;
    margin-top: -11px;
    border-radius: 0 2px 2px 0;
    background: var(--signal);
    box-shadow: var(--signal-bloom);
  }

  .nav-label {
    flex: 1;
  }

  .account {
    margin-top: auto;
    display: grid;
    gap: var(--space-3);
  }

  .account .head {
    margin: 0;
  }

  .acct {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
  }

  .acct:hover {
    background: var(--raised);
  }

  .acct-mark {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--pill);
    border: 1px solid var(--bezel);
    background: var(--raised);
    font-size: var(--step--2);
  }

  .acct-text {
    display: grid;
    font-size: var(--step--1);
  }

  .plate {
    font-size: 0.9375rem;
  }

  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    height: 3.5rem;
    padding: 0 var(--space-6);
    background: var(--bg);
    border-bottom: 1px solid var(--line);
    -webkit-app-region: drag;
  }

  .sync {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
  }

  .tools {
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
    border-radius: var(--radius);
    background: transparent;
    color: var(--ink-2);
    cursor: pointer;
  }

  .tool:hover {
    background: var(--raised);
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

  .screen {
    flex: 1;
    width: 100%;
    max-width: var(--content-width);
    margin: 0 auto;
    padding: var(--space-6) var(--space-6) var(--space-8);
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

    .head,
    .account,
    .badge {
      display: none;
    }

    .topbar {
      padding: 0 var(--space-4);
    }

    .screen {
      padding: var(--space-5) var(--space-4) var(--space-7);
    }
  }
</style>
