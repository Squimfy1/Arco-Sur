<script lang="ts">
  // The asset chooser: a button showing the chosen coin, and a list that
  // opens under it with every asset the rules allow, each with its logo
  // and name. It replaces the system <select>, whose
  // menu cannot show logos. The choice is posted with the form through a
  // hidden input, exactly as the <select> was.
  import type { Limit } from "../contract.ts";
  import AssetBadge from "./AssetBadge.svelte";
  import Icon from "./Icon.svelte";

  let {
    id,
    name,
    label,
    options,
    value,
    onpick,
  }: { id: string; name: string; label: string; options: Limit[]; value: string; onpick?: (asset: string) => void } = $props();

  // Follows `value` when the page hands a new one, and the user's pick otherwise.
  let selected = $derived(value);
  let open = $state(false);
  let active = $state(0); // the row the keyboard is on
  let root: HTMLDivElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();
  let list: HTMLUListElement | undefined = $state();

  const current = $derived(options.find((o) => o.asset === selected) ?? options[0]);

  $effect(() => {
    if (open) list?.focus();
  });

  function show() {
    active = Math.max(0, options.findIndex((o) => o.asset === current?.asset));
    open = true;
  }

  function close(refocus = true) {
    open = false;
    if (refocus) trigger?.focus();
  }

  function choose(i: number) {
    const o = options[i];
    if (o) {
      selected = o.asset;
      onpick?.(o.asset);
    }
    close();
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      show();
    }
  }

  function onListKey(e: KeyboardEvent) {
    const last = options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => (active = Math.min(last, active + 1)),
      ArrowUp: () => (active = Math.max(0, active - 1)),
      Home: () => (active = 0),
      End: () => (active = last),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => close(),
      Tab: () => close(false),
    };
    const act = keys[e.key];
    if (act) {
      if (e.key !== "Tab") e.preventDefault();
      act();
      return;
    }
    // Type a letter to jump to the first asset starting with it.
    if (e.key.length === 1) {
      const i = options.findIndex((o) => o.asset.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) active = i;
    }
  }

  function onOutside(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) close(false);
  }
</script>

<svelte:window onpointerdown={onOutside} />

<div class="picker" bind:this={root}>
  <input type="hidden" {name} value={current?.asset ?? ""} />

  <button
    bind:this={trigger}
    {id}
    type="button"
    class="trigger"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls="{id}-list"
    aria-labelledby="{label} {id}-value"
    onclick={() => (open ? close() : show())}
    onkeydown={onTriggerKey}
  >
    {#if current}
      <AssetBadge asset={current.asset} badge={current.badge} size="2rem" />
      <span class="names" id="{id}-value">
        <span class="ticker">{current.asset}</span>
        <span class="full">{current.name}</span>
      </span>
    {/if}
    <span class="chevron" class:up={open}><Icon name="chevron" size="1.1rem" /></span>
  </button>

  {#if open}
    <ul
      bind:this={list}
      id="{id}-list"
      class="menu"
      role="listbox"
      tabindex="-1"
      aria-labelledby={label}
      aria-activedescendant="{id}-option-{active}"
      onkeydown={onListKey}
    >
      {#each options as o, i (o.asset)}
        <li
          id="{id}-option-{i}"
          role="option"
          tabindex="-1"
          aria-selected={o.asset === current?.asset}
          class:active={i === active}
          onpointermove={() => (active = i)}
          onclick={() => choose(i)}
          onkeydown={onListKey}
        >
          <AssetBadge asset={o.asset} badge={o.badge} size="2rem" />
          <span class="names">
            <span class="ticker">{o.asset}</span>
            <span class="full">{o.name}</span>
          </span>
          <span class="tick">
            {#if o.asset === current?.asset}<Icon name="check" size="1.1rem" />{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .picker {
    position: relative;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 3.25rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius);
    background: var(--bg);
    text-align: left;
    cursor: pointer;
  }

  .trigger:hover {
    border-color: var(--ink-3);
  }

  .trigger:focus-visible,
  .trigger[aria-expanded="true"] {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .names {
    display: grid;
    flex: 1;
    min-width: 0;
    line-height: 1.25;
  }

  .ticker {
    font-weight: 600;
  }

  .full {
    font-size: var(--step--1);
    color: var(--ink-3);
  }

  .chevron {
    display: grid;
    color: var(--ink-2);
  }

  .chevron.up {
    transform: rotate(180deg);
  }

  .menu {
    position: absolute;
    top: calc(100% + var(--space-2));
    inset-inline: 0;
    z-index: 20;
    max-height: 20rem;
    overflow-y: auto;
    margin: 0;
    padding: var(--space-2);
    list-style: none;
    background: var(--panel-2);
    border-radius: var(--radius-lg);
    box-shadow: var(--pop-shadow);
  }

  .menu:focus {
    outline: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    cursor: pointer;
  }

  li.active {
    background: var(--hover);
  }

  li[aria-selected="true"] .ticker {
    color: var(--accent);
  }

  .tick {
    display: grid;
    width: 1.1rem;
    color: var(--accent);
  }

  @media (prefers-reduced-motion: no-preference) {
    .chevron {
      transition: transform 150ms ease;
    }

    .menu {
      animation: drop 140ms ease-out;
    }

    @keyframes drop {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
  }
</style>
