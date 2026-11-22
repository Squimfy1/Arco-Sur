<script lang="ts" module>
  export type Format = "pdf" | "doc" | "csv";

  export const FORMATS: { id: Format; name: string; ext: string; note: string }[] = [
    { id: "pdf", name: "PDF Document", ext: "PDF", note: "For printing and filing" },
    { id: "doc", name: "Word Document", ext: "DOC", note: "Opens in Word or Pages" },
    { id: "csv", name: "CSV Spreadsheet", ext: "CSV", note: "Opens in Excel or Numbers" },
  ];
</script>

<script lang="ts">
  // Which file to download: a button showing the chosen type, and a list
  // under it drawn like the asset picker's and the Filter's.
  import Icon from "./Icon.svelte";

  let { value = $bindable("pdf") }: { value?: Format } = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();
  const current = $derived(FORMATS.find((f) => f.id === value) ?? FORMATS[0]!);

  function choose(id: Format) {
    value = id;
    open = false;
    trigger?.focus();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      open = false;
      trigger?.focus();
    }
  }

  function onOutside(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onpointerdown={onOutside} onkeydown={onKey} />

<div class="picker" bind:this={root}>
  <button
    bind:this={trigger}
    type="button"
    class="trigger"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls="format-list"
    aria-label="File type: {current.name}"
    onclick={() => (open = !open)}
  >
    <span class="ext">{current.ext}</span>
    <span class="names">
      <span class="title">{current.name}</span>
      <span class="full">{current.note}</span>
    </span>
    <span class="chevron" class:up={open}><Icon name="chevron" size="1.1rem" /></span>
  </button>

  {#if open}
    <ul id="format-list" class="menu" role="listbox" aria-label="File type">
      {#each FORMATS as f (f.id)}
        <li role="option" aria-selected={f.id === value}>
          <button type="button" onclick={() => choose(f.id)}>
            <span class="ext">{f.ext}</span>
            <span class="names">
              <span class="title">{f.name}</span>
              <span class="full">{f.note}</span>
            </span>
            <span class="tick">{#if f.id === value}<Icon name="check" size="1.1rem" />{/if}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    width: min(18rem, 100%);
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

  /* The file type, on a small square like an asset's badge. */
  .ext {
    display: grid;
    place-items: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius);
    background: var(--accent-soft);
    color: var(--ink);
    font-size: var(--step--2);
    font-weight: 600;
  }

  .names {
    display: grid;
    flex: 1;
    min-width: 0;
    line-height: 1.25;
  }

  .title {
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
    margin: 0;
    padding: var(--space-2);
    list-style: none;
    background: var(--panel-2);
    border-radius: var(--radius-lg);
    box-shadow: var(--pop-shadow);
  }

  li button {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius);
    background: none;
    text-align: left;
    cursor: pointer;
  }

  li button:hover,
  li button:focus-visible {
    outline: none;
    background: var(--hover);
  }

  [aria-selected="true"] .title {
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
