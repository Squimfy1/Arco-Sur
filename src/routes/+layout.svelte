<script lang="ts">
  // The app's frame: sidebar, top bar, and the screen in between. Every
  // screen shares one reading of the wallet (+layout.server.ts); Refresh
  // reads it again.
  import "@fontsource/inter/400.css";
  import "@fontsource/inter/500.css";
  import "@fontsource/inter/600.css";
  import "@fontsource/ibm-plex-mono/400.css";
  import "@fontsource/ibm-plex-mono/500.css";
  import "#lib/ui/theme.css";

  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
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
    <div class="brand">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <path d="M8 22a8 8 0 0 1 16 0" fill="none" stroke="var(--accent-ink)" stroke-width="3" stroke-linecap="round" />
        <circle cx="16" cy="22" r="2.2" fill="var(--accent-ink)" />
      </svg>
      <span>Arco-Sur</span>
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
      <p class="nav-head">Account</p>
      <a href="/receive" class="acct">
        <span class="acct-dot" aria-hidden="true"></span>
        <span class="acct-text">
          <span>Testnet wallet</span>
          <span class="num muted">{data.wallet.short}</span>
        </span>
      </a>
      <p class="network"><Icon name="lock" size="0.9rem" /> {data.network}</p>
    </div>
  </aside>

  <div class="main">
    <header class="topbar">
      <div class="sync">
        <Pill tone={data.verdict.tone} label={data.verdict.label} />
        <span class="muted">block <span class="num">{data.block}</span> · read <span class="num">{data.readAt}</span></span>
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
    align-items: center;
    gap: var(--space-3);
    padding: 0 var(--space-3);
    font-size: var(--step-1);
    font-weight: 600;
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
    letter-spacing: 0.06em;
    text-transform: uppercase;
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
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .account {
    margin-top: auto;
  }

  .acct {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
  }

  .acct:hover {
    background: var(--panel);
  }

  .acct-dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--usd);
  }

  .acct-text {
    display: grid;
    font-size: var(--step--1);
  }

  .network {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-3) 0 0;
    padding: 0 var(--space-3);
    font-size: var(--step--2);
    color: var(--ink-3);
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    height: var(--topbar-height);
    padding: 0 var(--space-5);
    background: var(--bg);
    border-bottom: 1px solid var(--rule);
    -webkit-app-region: drag;
  }

  .sync {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    font-size: var(--step--1);
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

  .screen {
    width: 100%;
    max-width: var(--content-width);
    margin: 0 auto;
    padding: var(--space-6) var(--space-5) var(--space-7);
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

    .nav-head,
    .account {
      display: none;
    }

    .screen {
      padding: var(--space-5) var(--space-4) var(--space-6);
    }
  }
</style>
