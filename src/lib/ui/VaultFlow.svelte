<script lang="ts">
  // How a vault works, step by step, in the guard diagram's style. On the
  // left, four numbered steps saying what happens; on the right, the money's
  // path beside them: your deposit, down into the vault, out along one
  // branch per market, and the interest back to you (the dashed loop up the
  // right side). Every line runs from one box to the next and carries one
  // arrowhead, where it arrives. Every word is the backend's.
  import type { VaultFlow } from "../contract.ts";
  import Icon from "./Icon.svelte";

  let { flow }: { flow: VaultFlow } = $props();
  const columns = $derived(String(Math.max(1, flow.branches.length)));
  const many = $derived(flow.branches.length > 1);
  const step = (i: number) => flow.steps[i] ?? { title: "", text: "" };
</script>

<figure class="flow" aria-label="How {flow.vault} works, in four steps" style:--n={columns}>
  <!-- Step 1: the deposit -->
  <div class="step" style:grid-row="1">
    <span class="num">1</span>
    <div><b>{step(0).title}</b><p>{step(0).text}</p></div>
  </div>
  <div class="cell" style:grid-row="1">
    <span class="rail first" aria-hidden="true"></span>
    <div class="path">
      <span class="line blank" aria-hidden="true"></span>
      <div class="node">
        <span class="chip top"><Icon name="receive" size="0.95rem" /> {flow.deposit}</span>
        <span class="arm in" aria-hidden="true"></span>
      </div>
      <span class="line" aria-hidden="true"></span>
    </div>
  </div>

  <!-- Step 2: the vault decides where it goes -->
  <div class="step" style:grid-row="2">
    <span class="num">2</span>
    <div><b>{step(1).title}</b><p>{step(1).text}</p></div>
  </div>
  <div class="cell" style:grid-row="2">
    <span class="rail" aria-hidden="true"></span>
    <div class="path">
      <span class="line head" aria-hidden="true"></span>
      <div class="node">
        <span class="centre">
          <span class="vault">{flow.vault}</span>
          <span class="note">{flow.vaultNote}</span>
        </span>
      </div>
      <span class="line" aria-hidden="true"></span>
    </div>
  </div>

  <!-- Step 3: out to the borrowers, one branch per market -->
  <div class="step" style:grid-row="3">
    <span class="num">3</span>
    <div><b>{step(2).title}</b><p>{step(2).text}</p></div>
  </div>
  <div class="cell" style:grid-row="3">
    <span class="rail" aria-hidden="true"></span>
    <div class="path">
      <!-- With several branches the arrowheads are on each branch; with one, here. -->
      <span class="line" class:head={!many} aria-hidden="true"></span>
      {#if flow.branches.length > 0}
        <div class="branches" class:many>
          {#each flow.branches as b (b.title)}
            <div class="branch">
              <span class="chip"><span><b>{b.title}</b><br />{b.note}</span></span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="node"><span class="chip">Borrowers</span></div>
      {/if}
      <span class="line" aria-hidden="true"></span>
    </div>
  </div>

  <!-- Step 4: the interest comes back -->
  <div class="step" style:grid-row="4">
    <span class="num">4</span>
    <div><b>{step(3).title}</b><p>{step(3).text}</p></div>
  </div>
  <div class="cell" style:grid-row="4">
    <span class="rail last" aria-hidden="true"></span>
    <div class="path">
      <span class="line head" aria-hidden="true"></span>
      <div class="node">
        <span class="chip back" data-tone="ok">
          <span class="mark"><Icon name="check" size="0.95rem" /></span>
          <span>{flow.back}</span>
        </span>
        <span class="arm out" aria-hidden="true"></span>
      </div>
      <span class="line blank" aria-hidden="true"></span>
    </div>
  </div>

  <span class="loop-label" aria-hidden="true">interest back to you</span>
</figure>

<style>
  .flow {
    --loop: 2.75rem; /* the room on the right for the interest's way back */
    position: relative;
    display: grid;
    grid-template-columns: minmax(12rem, 17rem) minmax(0, 1fr);
    column-gap: var(--space-5);
    margin: 0;
  }

  /* The steps: a number in a circle, a title, one or two sentences. */
  .step {
    grid-column: 1;
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    align-self: center;
    padding-block: var(--space-3);
  }

  .step .num {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--ink);
    font-size: var(--step--1);
    font-weight: 600;
  }

  .step b {
    display: block;
    font-weight: 600;
  }

  .step p {
    margin: var(--space-1) 0 0;
    font-size: var(--step--1);
    color: var(--ink-2);
  }

  /* Each row of the diagram: a line in from above, the box, a line out
     below. The lines grow to fill the row, so they meet the next row's. */
  .cell {
    grid-column: 2;
    position: relative;
    display: flex;
  }

  .path {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    margin-right: var(--loop);
  }

  .line {
    position: relative;
    align-self: center;
    flex: 1;
    width: 1px;
    min-height: 1.25rem;
    background: var(--rule-strong);
  }

  .line.blank {
    background: none;
  }

  /* The one arrowhead, at the foot of a line, touching the box below. */
  .line.head::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top: 6px solid var(--ink-3);
    border-bottom: 0;
  }

  /* A box, centred, with room either side; the right side can carry the loop's arm. */
  .node {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
  }

  .node > :first-child {
    grid-column: 2;
  }

  .centre {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
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
    line-height: 1.3;
    box-shadow: var(--lift);
    text-align: left;
  }

  .chip b {
    color: var(--ink);
    font-weight: 500;
  }

  .top {
    color: var(--ink);
    font-weight: 500;
  }

  .back {
    max-width: 30rem;
    box-shadow: var(--lift), inset 0 0 0 1px var(--tone);
    color: var(--ink);
  }

  .mark {
    display: grid;
    place-items: center;
    width: 1rem;
    flex: none;
    color: var(--tone);
  }

  .vault {
    padding: var(--space-1) var(--space-5);
    border-radius: var(--pill);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }

  .note {
    font-size: var(--step--1);
    color: var(--ink-3);
  }

  /* The branches: a bar under the line from the vault, a stub with an
     arrowhead down into each branch, and below them a bar joining them. */
  .branches {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: var(--space-2);
  }

  .branch {
    position: relative;
    display: grid;
    justify-items: center;
  }

  .branch .chip {
    width: 100%;
    max-width: 15rem;
    padding: var(--space-2) var(--space-3);
  }

  .branches.many {
    padding-block: 1.25rem;
  }

  .branches.many::before,
  .branches.many::after {
    content: "";
    position: absolute;
    left: calc(50% / var(--n));
    right: calc(50% / var(--n));
    height: 1px;
    background: var(--rule-strong);
  }

  .branches.many::before {
    top: 0;
  }

  .branches.many::after {
    bottom: 0;
  }

  .branches.many .branch::before,
  .branches.many .branch::after {
    content: "";
    position: absolute;
    left: 50%;
    width: 1px;
    height: 1.25rem;
    background: var(--rule-strong);
  }

  .branches.many .branch::before {
    top: -1.25rem;
  }

  .branches.many .branch::after {
    bottom: -1.25rem;
  }

  .branches.many .branch .chip {
    position: relative;
  }

  .branches.many .branch .chip::before {
    content: "";
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top: 6px solid var(--ink-3);
    border-bottom: 0;
  }

  /* The interest's way back: an arm out of the interest box, up the right
     side, and an arm into the deposit with the head pointing at it. */
  .rail {
    position: absolute;
    top: 0;
    bottom: 0;
    right: calc(var(--loop) / 2);
    border-right: 1px dashed var(--ok);
  }

  .rail.first {
    top: 50%;
  }

  .rail.last {
    bottom: 50%;
  }

  .arm {
    grid-column: 3;
    position: relative;
    height: 0;
    margin-left: var(--space-2);
    margin-right: calc(var(--loop) / -2);
    border-top: 1px dashed var(--ok);
  }

  .arm.in::before {
    content: "";
    position: absolute;
    left: -2px;
    top: -6px;
    border: 5px solid transparent;
    border-right: 7px solid var(--ok);
    border-left: 0;
  }

  .loop-label {
    grid-column: 2;
    grid-row: 2 / 4;
    justify-self: end;
    align-self: center;
    margin-right: calc(var(--loop) / 2 - 0.6rem);
    padding: var(--space-2) 0;
    background: var(--panel);
    color: var(--ok);
    font-size: var(--step--2);
    white-space: nowrap;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
  }

  @media (max-width: 56rem) {
    .flow {
      grid-template-columns: minmax(0, 1fr);
    }

    .step,
    .cell {
      grid-column: 1;
      grid-row: auto !important;
    }

    .path {
      margin-right: 0;
    }

    .branches {
      grid-template-columns: minmax(0, 1fr);
    }

    .branches.many::before,
    .branches.many::after,
    .rail,
    .arm,
    .loop-label {
      display: none;
    }
  }
</style>
