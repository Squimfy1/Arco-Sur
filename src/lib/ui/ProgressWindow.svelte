<script lang="ts">
  // The window a payment goes through in. The app stays visible behind it,
  // blurred. Four steps down the middle, joined by a line that turns green
  // as each one is done; the one under way pulses; one that fails turns
  // red with the reason. At the end: the status and the explorer link that
  // proves it. Everything shown comes from the backend's Progress events.
  import type { Progress } from "../contract.ts";
  import Icon from "./Icon.svelte";

  let { events, onclose }: { events: Progress[]; onclose: () => void } = $props();

  const plan = $derived(events.find((e) => e.type === "plan"));
  const done = $derived(events.find((e) => e.type === "done"));
  const failed = $derived(events.find((e) => e.type === "fail"));
  const finished = $derived(new Map(events.flatMap((e) => (e.type === "step" ? [[e.id, e] as const] : []))));
  const steps = $derived(
    (plan?.type === "plan" ? plan.steps : []).map((s) => {
      const step = finished.get(s.id);
      const state = step ? "done" : failed?.type === "fail" && failed.id === s.id ? "failed" : "waiting";
      return { ...s, state, detail: step?.detail ?? (failed?.type === "fail" && failed.id === s.id ? failed.reason : ""), link: step?.link ?? null };
    }),
  );
  // The step under way: the first not done, while nothing has failed or ended.
  const current = $derived(done || failed ? -1 : steps.findIndex((s) => s.state === "waiting"));
  // The line below a step turns green once the step after it is done too.
  const joined = $derived(steps.map((s, i) => s.state === "done" && steps[i + 1]?.state === "done"));

  let box: HTMLDivElement | undefined = $state();
  $effect(() => {
    box?.focus();
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape" && done) onclose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="scrim">
  <div class="box" role="dialog" aria-modal="true" aria-labelledby="progress-title" tabindex="-1" bind:this={box}>
    <h2 id="progress-title">{plan?.type === "plan" ? plan.title : "Starting"}</h2>

    <ol class="steps">
      {#each steps as s, i (s.id)}
        <li data-state={s.state} class:current={i === current} class:joined={joined[i]} aria-current={i === current ? "step" : undefined}>
          <span class="bullet" aria-hidden="true">
            {#if s.state === "done"}<Icon name="check" size="0.85rem" />{:else if s.state === "failed"}<Icon name="refused" size="0.85rem" />{/if}
          </span>
          <span class="words">
            <span class="label">{s.label}</span>
            {#if s.detail}<span class="detail">{s.detail}</span>{/if}
            {#if s.link}<a class="link" href={s.link} target="_blank" rel="noreferrer">View in Explorer <Icon name="external" size="0.85rem" /></a>{/if}
          </span>
        </li>
      {/each}
    </ol>

    <div class="end" aria-live="polite">
      {#if done?.type === "done"}
        <span class="status" data-tone={done.ok ? "ok" : "bad"}>{done.status}</span>
        <p class="summary">{done.summary}</p>
        <div class="buttons">
          {#if done.link}
            <a class="btn outline" href={done.link} target="_blank" rel="noreferrer"><Icon name="external" size="1rem" /> Proof on the Explorer</a>
          {/if}
          <button class="btn" type="button" onclick={onclose}>Done</button>
        </div>
      {:else}
        <span class="status" data-tone="quiet">Working</span>
        <p class="summary muted">Keep the app open until this finishes.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: var(--space-4);
    background: var(--scrim);
    backdrop-filter: blur(var(--blur));
    -webkit-backdrop-filter: blur(var(--blur));
  }

  .box {
    width: min(30rem, 100%);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    background: var(--panel);
    box-shadow: var(--pop-shadow);
  }

  .box:focus {
    outline: none;
  }

  h2 {
    margin: 0 0 var(--space-5);
    font-size: var(--step-3);
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .steps {
    display: grid;
    gap: var(--space-5);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* A line from each bullet down to the next: grey, with a green one over
     it that grows down once both ends are done. */
  li:not(:last-child)::before,
  li:not(:last-child)::after {
    content: "";
    position: absolute;
    left: calc(0.75rem - 1px);
    top: 1.5rem;
    width: 2px;
    height: calc(100% - 1.5rem + var(--space-5));
  }

  li:not(:last-child)::before {
    background: var(--rule-strong);
  }

  li:not(:last-child)::after {
    background: var(--ok);
    transform: scaleY(0);
    transform-origin: top;
  }

  li.joined::after {
    transform: scaleY(1);
  }

  li {
    position: relative;
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr);
    gap: var(--space-3);
    align-items: start;
  }

  .bullet {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: var(--panel);
    box-shadow: inset 0 0 0 2px var(--rule-strong);
    color: var(--ok-bg);
    transition:
      background-color 0.3s var(--ease-out),
      box-shadow 0.3s var(--ease-out);
  }

  li[data-state="done"] .bullet {
    background: var(--ok);
    box-shadow: none;
  }

  li[data-state="failed"] .bullet {
    background: var(--bad);
    box-shadow: none;
    color: var(--bad-bg);
  }

  li.current .bullet {
    box-shadow: inset 0 0 0 2px var(--ok);
  }

  .words {
    display: grid;
    gap: var(--space-1);
    padding-top: 0.1rem;
  }

  .label {
    font-weight: 600;
  }

  li[data-state="waiting"]:not(.current) .label {
    color: var(--ink-3);
  }

  .detail {
    font-size: var(--step--1);
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }

  li[data-state="failed"] .detail {
    color: var(--bad);
  }

  .link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    justify-self: start;
    font-size: var(--step--1);
    color: var(--accent);
    font-weight: 500;
  }

  .link:hover {
    text-decoration: underline;
  }

  .end {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
    margin-top: var(--space-6);
    padding-top: var(--space-5);
    border-top: 1px solid var(--rule);
  }

  .status {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--pill);
    background: var(--tone-bg);
    color: var(--tone);
    font-size: var(--step--1);
    font-weight: 600;
  }

  .summary {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  @media (prefers-reduced-motion: no-preference) {
    .box {
      animation: rise 220ms var(--ease-out);
    }

    .scrim {
      animation: fade 200ms ease-out;
    }

    li::after {
      transition: transform 0.6s var(--ease-out);
    }

    li.current .bullet {
      animation: pulse 1.2s ease-in-out infinite;
    }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
    }

    @keyframes fade {
      from {
        opacity: 0;
      }
    }

    @keyframes pulse {
      50% {
        box-shadow:
          inset 0 0 0 2px var(--ok),
          0 0 0 5px var(--ok-bg);
      }
    }
  }
</style>
