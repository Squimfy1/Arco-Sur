<script lang="ts">
  // Send: fill in a payment, then Review it. Review runs the wallet's guard
  // and a rehearsal on the node, on the server, and shows what they said.
  // Nothing is signed from here yet: that is Stage 10.
  import { enhance, type SubmitFunction } from "$app/forms";
  import AssetBadge from "#lib/ui/AssetBadge.svelte";
  import Icon from "#lib/ui/Icon.svelte";
  import Pill from "#lib/ui/Pill.svelte";

  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let reviewing = $state(false);
  const review = $derived(form?.review);

  // Keep what was typed after a review, and show "Checking…" meanwhile.
  const submit: SubmitFunction = () => {
    reviewing = true;
    return async ({ update }) => {
      await update({ reset: false });
      reviewing = false;
    };
  };
</script>

<svelte:head>
  <title>Cathedral · Send</title>
</svelte:head>

<header class="page-head">
  <p class="label">Move / send / review before signing</p>
  <h1 class="display">Send a <em>payment</em></h1>
</header>

<div class="layout">
  <form class="card form reg" method="POST" action="?/review" use:enhance={submit}>
    <div class="field">
      <label for="asset">Asset</label>
      <select id="asset" name="asset" value={review?.form.asset ?? "USDC"}>
        {#each data.mandate.limits as l (l.asset)}
          <option value={l.asset}>{l.asset}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <label for="to">Recipient</label>
      <input id="to" name="to" class="num" list="allowed" placeholder="0x…" autocomplete="off" spellcheck="false" required value={review?.form.to ?? ""} />
      <datalist id="allowed">
        {#each data.mandate.recipients as r (r.address)}
          <option value={r.address}>{r.label}</option>
        {/each}
      </datalist>
    </div>

    <div class="field">
      <label for="amount">Amount</label>
      <input id="amount" name="amount" class="num" inputmode="decimal" placeholder="0.1" autocomplete="off" required value={review?.form.amount ?? ""} />
    </div>

    <div class="submit">
      <button class="btn" type="submit" disabled={reviewing}>
        <Icon name="rules" size="1.05rem" />
        {reviewing ? "Checking…" : "Review"}
      </button>
      <span class="label">Checks the rules, then rehearses on the chain. Signs nothing.</span>
    </div>
  </form>

  <aside class="side">
    <div class="key-idea">
      <span class="label">+ Key idea</span>
      <span>Nothing is signed until the rules allow what the transaction actually does.</span>
    </div>
    <div class="plates" aria-label="What you may send">
      {#each data.mandate.limits as l (l.asset)}
        <div class="plate"><span>{l.asset} left</span><span class="money">{l.left} / {l.total}</span></div>
        <div class="plate"><span>Per payment</span><span class="money">{l.perPayment}</span></div>
      {/each}
    </div>
    <div class="only">
      <span class="label">Only to</span>
      {#each data.mandate.recipients as r (r.address)}
        <span class="recipient">
          <AssetBadge badge="→" size="1.5rem" />
          <span class="num">{r.address}</span>{#if r.label}<span class="faint tag">{r.label}</span>{/if}
        </span>
      {/each}
    </div>
  </aside>
</div>

{#if review}
  <section class="card void result reg" data-tone={review.tone} aria-live="polite">
    <div class="result-head">
      <h2 class="heading">{review.title}</h2>
      <Pill tone={review.tone} label={review.tone === "ok" ? "Passed" : "Stopped"} />
    </div>
    <ol class="steps">
      {#each review.steps as s (s.label)}
        <li data-tone={s.tone}>
          <span class="step-label label">{s.label}</span>
          <span class="step-text">{s.text}</span>
        </li>
      {/each}
    </ol>
    {#if review.tone === "ok"}
      <div class="sign">
        <button class="btn" disabled><Icon name="lock" size="1.05rem" /> Sign and send</button>
        <p class="muted small">
          Signing from the app arrives in Stage 10. Until then, send this exact payment with
          <code>npm run send</code>, which runs the same checks and then signs.
        </p>
      </div>
    {/if}
  </section>
{/if}

<style>
  .page-head {
    padding-bottom: var(--space-6);
  }

  .page-head .label {
    margin: 0 0 var(--space-3);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: var(--space-6);
    align-items: start;
  }

  .form {
    display: grid;
    gap: var(--space-5);
    padding-top: var(--space-6);
  }

  .submit {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
  }

  .side {
    display: grid;
    gap: var(--space-5);
  }

  .only {
    display: grid;
    gap: var(--space-2);
  }

  .recipient {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--step--1);
    overflow-wrap: anywhere;
  }

  .result {
    margin-top: var(--space-6);
    padding-top: var(--space-6);
    border-color: var(--tone);
  }

  .result-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }

  .steps li {
    display: grid;
    grid-template-columns: 7rem minmax(0, 1fr);
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--pane);
    border-left: 1px solid var(--tone);
  }

  .step-label {
    color: var(--tone);
  }

  .step-text {
    overflow-wrap: anywhere;
  }

  .sign {
    margin-top: var(--space-5);
  }

  .small {
    font-size: var(--step--1);
  }

  code {
    font-family: var(--mono);
    color: var(--ink);
  }

  @media (max-width: 52rem) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
