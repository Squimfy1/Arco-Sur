<script lang="ts">
  // The recipient: a field to type or paste an address, with a list under
  // it of the addresses the rules allow, drawn like the asset picker's.
  // It replaces the system's suggestion list, which cannot be styled.
  import arcIcon from "./brand/arc-network.svg";
  import Icon from "./Icon.svelte";

  let {
    id,
    name,
    value = $bindable(""),
    options,
  }: { id: string; name: string; value?: string; options: { address: string; label: string }[] } = $props();

  let open = $state(false);
  let active = $state(0);
  let root: HTMLDivElement | undefined = $state();

  // Typing narrows the list; an address already chosen shows them all.
  const shown = $derived.by(() => {
    const q = value.trim().toLowerCase();
    const exact = options.some((o) => o.address.toLowerCase() === q);
    if (q === "" || exact) return options;
    return options.filter((o) => o.address.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
  });

  function choose(i: number) {
    const o = shown[i];
    if (o) value = o.address;
    open = false;
  }

  function onKey(e: KeyboardEvent) {
    const last = shown.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) open = true;
      else active = Math.min(last, active + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = Math.max(0, active - 1);
    } else if (e.key === "Enter" && open && shown.length > 0) {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      open = false;
    }
  }

  function onOutside(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onpointerdown={onOutside} />

<div class="recipient" bind:this={root}>
  <input
    {id}
    {name}
    class="num"
    placeholder="0x…"
    autocomplete="off"
    spellcheck="false"
    role="combobox"
    aria-expanded={open}
    aria-controls="{id}-list"
    aria-autocomplete="list"
    aria-activedescendant={open ? `${id}-option-${active}` : undefined}
    bind:value
    onfocus={() => (open = true)}
    oninput={() => {
      open = true;
      active = 0;
    }}
    onkeydown={onKey}
  />
  <button class="toggle" type="button" tabindex="-1" aria-label="Show allowed recipients" onclick={() => (open = !open)}>
    <span class:up={open}><Icon name="chevron" size="1.1rem" /></span>
  </button>

  {#if open && shown.length > 0}
    <ul id="{id}-list" class="menu" role="listbox">
      {#each shown as o, i (o.address)}
        <li
          id="{id}-option-{i}"
          role="option"
          tabindex="-1"
          aria-selected={o.address.toLowerCase() === value.trim().toLowerCase()}
          class:active={i === active}
          onpointermove={() => (active = i)}
          onpointerdown={(e) => e.preventDefault()}
          onclick={() => choose(i)}
          onkeydown={onKey}
        >
          <img class="net" src={arcIcon} alt="" />
          <span class="names">
            <span class="label">{o.label || "Address"}</span>
            <span class="num addr">{o.address}</span>
          </span>
          <span class="tick">
            {#if o.address.toLowerCase() === value.trim().toLowerCase()}<Icon name="check" size="1.1rem" />{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .recipient {
    position: relative;
  }

  input {
    width: 100%;
    min-height: 2.75rem;
    padding: 0 3rem 0 var(--space-4);
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius);
    background: var(--bg);
  }

  input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .toggle {
    position: absolute;
    top: 50%;
    right: var(--space-2);
    transform: translateY(-50%);
    display: grid;
    place-items: center;
    padding: var(--space-1);
    border: 0;
    background: none;
    color: var(--ink-2);
    cursor: pointer;
  }

  .toggle span {
    display: grid;
    transition: transform 0.15s var(--ease-out);
  }

  .toggle .up {
    transform: rotate(180deg);
  }

  /* The same pop-up as the asset picker's. */
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

  .net {
    flex: none;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius);
  }

  .names {
    display: grid;
    flex: 1;
    min-width: 0;
    line-height: 1.25;
  }

  .label {
    font-weight: 600;
    text-transform: capitalize;
  }

  li[aria-selected="true"] .label {
    color: var(--accent);
  }

  .addr {
    font-size: var(--step--1);
    color: var(--ink-3);
    overflow-wrap: anywhere;
  }

  .tick {
    display: grid;
    width: 1.1rem;
    color: var(--accent);
  }

  @media (prefers-reduced-motion: no-preference) {
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
