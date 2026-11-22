<script lang="ts">
  // The guard as a picture: a payment comes in at the top, the guard
  // decides, and it goes down one of two branches. With a tone (the Send
  // screen's review) the branch it took is lit and the other fades; with
  // none (the Rules screen) both stay plain. Shape borrowed from Inherence's
  // "proposes → decides → executes or blocked" diagram.
  import type { Tone } from "../contract.ts";
  import Icon from "./Icon.svelte";

  let { payment, tone = null }: { payment: string; tone?: Tone | null } = $props();

  const lit = $derived(tone === null ? null : tone === "ok" ? "pass" : "stop");
</script>

<figure class="tree" aria-label="The guard decides before anything is signed">
  <span class="chip top">{payment}</span>
  <span class="stem" aria-hidden="true"></span>
  <span class="guard">Guard</span>
  <div class="lower">
    <span class="fork" aria-hidden="true"></span>
    <div class="branches">
      <span class="chip" data-tone={lit === "pass" ? "ok" : undefined} class:dim={lit === "stop"}>
        <span class="mark"><Icon name="check" size="0.95rem" /></span>
        <span><b>Signs</b><br />within the rules</span>
      </span>
      <span class="chip" data-tone={lit === "stop" ? "bad" : undefined} class:dim={lit === "pass"}>
        <span class="mark"><span class="dot"></span></span>
        <span><b>Stopped</b><br />nothing is signed</span>
      </span>
    </div>
  </div>
</figure>

<style>
  .tree {
    display: grid;
    justify-items: center;
    margin: 0;
    padding: var(--space-4) 0 var(--space-2);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius);
    background: var(--panel-2);
    color: var(--ink-2);
    font-size: var(--step--1);
    line-height: 1.25;
    white-space: nowrap;
    box-shadow: var(--lift);
    transition: opacity 0.2s var(--ease-out);
  }

  .chip b {
    color: var(--ink);
    font-weight: 500;
  }

  .top {
    color: var(--ink);
  }

  .chip[data-tone] {
    box-shadow: var(--lift), inset 0 0 0 1px var(--tone);
  }

  .chip[data-tone] b {
    color: var(--tone);
  }

  .dim {
    opacity: 0.4;
  }

  .mark {
    display: grid;
    place-items: center;
    width: 1rem;
    color: var(--accent);
  }

  .dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--bad);
  }

  .stem {
    width: 1px;
    height: 1.5rem;
    background: var(--rule-strong);
  }

  .guard {
    padding: var(--space-1) var(--space-5);
    border-radius: var(--pill);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .lower {
    display: grid;
    width: min(30rem, 100%);
  }

  /* One line down from the guard, splitting to the middle of each branch. */
  .fork {
    position: relative;
    height: 1.5rem;
    margin-inline: 25%;
    margin-top: 1rem;
    border: 1px solid var(--rule-strong);
    border-bottom: 0;
    border-radius: var(--radius) var(--radius) 0 0;
  }

  .fork::before {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 100%;
    width: 1px;
    height: 1rem;
    background: var(--rule-strong);
  }

  .branches {
    display: grid;
    grid-template-columns: 1fr 1fr;
    justify-items: center;
  }
</style>
