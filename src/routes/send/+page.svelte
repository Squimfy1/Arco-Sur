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
  <title>Arco-Sur · Send</title>
</svelte:head>

<h1>Send</h1>
<p class="muted lede">Every payment is checked against this wallet's rules and rehearsed on the chain before anything is signed.</p>

<div class="layout">
  <form
    class="card form"
    method="POST"
    action="?/review"
    use:enhance={submit}
  >
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

    <button class="btn" type="submit" disabled={reviewing}>
      <Icon name="rules" size="1.1rem" />
      {reviewing ? "Checking…" : "Review"}
    </button>
  </form>

  <aside class="card limits">
    <h2 class="card-title">What you may send</h2>
    {#each data.mandate.limits as l (l.asset)}
      <div class="limit">
        <AssetBadge asset={l.asset} badge={l.badge} size="1.75rem" />
        <span>
          <span class="num money">{l.left} {l.asset}</span> left of <span class="num money">{l.total}</span>
          <span class="muted block">at most <span class="num money">{l.perPayment}</span> per payment</span>
        </span>
      </div>
    {/each}
    <p class="muted small">Only to:</p>
    {#each data.mandate.recipients as r (r.address)}
      <p class="small num">{r.address}{#if r.label}<span class="muted tag">· {r.label}</span>{/if}</p>
    {/each}
  </aside>
</div>

{#if review}
  <section class="card result" data-tone={review.tone} aria-live="polite">
    <div class="result-head">
      <h2 class="card-title">{review.title}</h2>
      <Pill tone={review.tone} label={review.tone === "ok" ? "Passed" : "Stopped"} />
    </div>
    <ol class="steps">
      {#each review.steps as s (s.label)}
        <li data-tone={s.tone}>
          <span class="step-label">{s.label}</span>
          <span class="step-text">{s.text}</span>
        </li>
      {/each}
    </ol>
    {#if review.tone === "ok"}
      <div class="sign">
        <button class="btn" disabled><Icon name="lock" size="1.1rem" /> Sign and send</button>
        <p class="muted small">
          Signing from the app arrives in Stage 10. Until then, send this exact payment with
          <code>npm run send</code>, which runs the same checks and then signs.
        </p>
      </div>
    {/if}
  </section>
{/if}

<style>
  h1 {
    margin: 0;
    font-size: var(--step-3);
    font-weight: 600;
  }

  .lede {
    margin: var(--space-1) 0 var(--space-5);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: var(--space-5);
    align-items: start;
  }

  .form {
    display: grid;
    gap: var(--space-4);
  }

  .form .btn {
    justify-self: start;
  }

  .limit {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--rule);
  }

  .block {
    display: block;
    font-size: var(--step--1);
  }

  .small {
    font-size: var(--step--1);
    overflow-wrap: anywhere;
  }

  .result {
    margin-top: var(--space-5);
    box-shadow: inset 0 0 0 1px var(--tone);
  }

  .result-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
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
    grid-template-columns: 6rem minmax(0, 1fr);
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius);
    background: var(--panel-2);
    border-left: 3px solid var(--tone);
  }

  .step-label {
    font-weight: 600;
    color: var(--tone);
  }

  .step-text {
    overflow-wrap: anywhere;
  }

  .sign {
    margin-top: var(--space-4);
  }

  code {
    font-family: var(--mono);
    color: var(--ink);
  }

  @media (max-width: 48rem) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
