<script lang="ts">
  // One Filter button. It opens a list drawn like the asset picker's, with a
  // column per filter (Topic, Kind); one choice in each, "All" by default.
  // A screen may also offer a calendar day (Operations does). The button
  // names what is chosen.
  import Icon from "./Icon.svelte";

  type Group = { id: string; label: string; options: string[] };

  let {
    groups,
    chosen = $bindable({}),
    all = "All",
    everything = "All News",
    day = $bindable(""),
    dayShown = "",
    dayRange,
  }: {
    groups: Group[];
    chosen?: Record<string, string>;
    all?: string;
    /** What the button says when nothing narrows the list. */
    everything?: string;
    /** A calendar day, "2026-11-21", when the screen offers one; "" for any day. */
    day?: string;
    /** The chosen day as the button shows it. */
    dayShown?: string;
    /** Offer the day field, from the first day to the last that has anything. */
    dayRange?: { min: string; max: string };
  } = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();

  const valueOf = (g: Group) => chosen[g.id] ?? all;
  // What the button says: the choices that narrow the list, or that nothing does.
  const summary = $derived(
    [...(day ? [dayShown || day] : []), ...groups.map(valueOf).filter((v) => v !== all)].join(", ") || everything,
  );
  const narrowed = $derived(day !== "" || groups.some((g) => valueOf(g) !== all));

  function pick(g: Group, option: string) {
    chosen = { ...chosen, [g.id]: option };
  }

  function clear() {
    chosen = {};
    day = "";
  }

  function close(refocus = true) {
    open = false;
    if (refocus) trigger?.focus();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  }

  function onOutside(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) close(false);
  }
</script>

<svelte:window onpointerdown={onOutside} onkeydown={onKey} />

<div class="filter" bind:this={root}>
  <button
    bind:this={trigger}
    type="button"
    class="trigger"
    aria-haspopup="true"
    aria-expanded={open}
    aria-controls="filter-menu"
    onclick={() => (open ? close() : (open = true))}
  >
    <span class="mark" class:on={narrowed}><Icon name="filter" size="1.1rem" /></span>
    <span class="names">
      <span class="title">Filter</span>
      <span class="full">{summary}</span>
    </span>
    <span class="chevron" class:up={open}><Icon name="chevron" size="1.1rem" /></span>
  </button>

  {#if open}
    <div id="filter-menu" class="menu">
      {#if dayRange}
        <div class="day">
          <label class="group-name" for="filter-day">Day</label>
          <div class="day-row">
            <input id="filter-day" type="date" class="num" bind:value={day} min={dayRange.min} max={dayRange.max} />
          </div>
        </div>
      {/if}
      <div class="columns">
        {#each groups as g (g.id)}
          <div class="group" role="radiogroup" aria-labelledby="filter-{g.id}">
            <p class="group-name" id="filter-{g.id}">{g.label}</p>
            <ul>
              {#each [all, ...g.options] as option (option)}
                <li>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={valueOf(g) === option}
                    onclick={() => pick(g, option)}
                  >
                    <span class="label">{option}</span>
                    <span class="tick">
                      {#if valueOf(g) === option}<Icon name="check" size="1.1rem" />{/if}
                    </span>
                  </button>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
      <div class="foot">
        <button type="button" class="clear" onclick={clear} disabled={!narrowed}>Show All</button>
        <button type="button" class="btn" onclick={() => close()}>Done</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .filter {
    position: relative;
    width: min(22rem, 100%);
  }

  /* The button: drawn like the asset picker's. */
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

  .mark {
    display: grid;
    place-items: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--panel-2);
    color: var(--ink-2);
  }

  .mark.on {
    background: var(--accent);
    color: var(--accent-ink);
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
    overflow: hidden;
    font-size: var(--step--1);
    color: var(--ink-3);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .chevron {
    display: grid;
    color: var(--ink-2);
  }

  .chevron.up {
    transform: rotate(180deg);
  }

  /* The list: the asset picker's pop-up, wide enough for a column per filter. */
  .menu {
    position: absolute;
    top: calc(100% + var(--space-2));
    left: 0;
    z-index: 20;
    width: min(34rem, calc(100vw - var(--space-6)));
    padding: var(--space-2);
    background: var(--panel-2);
    border-radius: var(--radius-lg);
    box-shadow: var(--pop-shadow);
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--space-2);
  }

  .group-name {
    display: block;
    margin: var(--space-2) var(--space-3) var(--space-1);
    font-size: var(--step--1);
    color: var(--ink-3);
  }

  /* The day: a date field drawn like the other fields, the calendar the system's own. */
  .day {
    padding-bottom: var(--space-2);
    margin-bottom: var(--space-1);
    border-bottom: 1px solid var(--rule);
  }

  .day-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3) var(--space-1);
  }

  .day-row input {
    flex: 1;
    min-height: 2.75rem;
    padding: 0 var(--space-4);
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius);
    background: var(--bg);
    font-size: var(--step-1);
    font-weight: 500;
  }

  .day-row input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .day-row input::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.7;
  }

  ul {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
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

  .label {
    flex: 1;
    font-weight: 500;
  }

  [aria-checked="true"] .label {
    color: var(--accent);
    font-weight: 600;
  }

  .tick {
    display: grid;
    width: 1.1rem;
    color: var(--accent);
  }

  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--space-2);
    padding: var(--space-2) var(--space-2) 0;
    border-top: 1px solid var(--rule);
  }

  .clear {
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: var(--ink-2);
    cursor: pointer;
  }

  .clear:hover:not(:disabled) {
    background: var(--hover);
    color: var(--ink);
  }

  .clear:disabled {
    color: var(--ink-3);
    cursor: default;
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
