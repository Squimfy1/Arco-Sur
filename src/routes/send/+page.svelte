<script lang="ts">
  // Send: fill in a payment, then Review it. Review runs the wallet's guard
  // and a rehearsal on the node, on the server, and shows what they said
  // with a quote. Send then signs and broadcasts it on the server, and the
  // progress window follows each step until the chain confirms it.
  import { enhance, type SubmitFunction } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import ProgressWindow from "#lib/ui/ProgressWindow.svelte";
  import { follow } from "#lib/ui/progress.ts";
  import type { Progress } from "#lib/contract.ts";
  import AssetPicker from "#lib/ui/AssetPicker.svelte";
  import BalanceList from "#lib/ui/BalanceList.svelte";
  import AmountInput from "#lib/ui/AmountInput.svelte";
  import Icon from "#lib/ui/Icon.svelte";
  import Pill from "#lib/ui/Pill.svelte";
  import RecipientField from "#lib/ui/RecipientField.svelte";

  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let reviewing = $state(false);
  const review = $derived(form?.review);

  // What is being typed. Each follows the last review, and the fields below.
  let asset = $derived(review?.form.asset ?? "USDC");
  let to = $derived(review?.form.to ?? "");
  let amount = $derived(review?.form.amount ?? "");
  const chosen = $derived(data.mandate.limits.find((l) => l.asset === asset) ?? data.mandate.limits[0]);
  // Why a refused review stopped: the step that failed, in the backend's words.
  const stopped = $derived(review?.tone === "ok" ? undefined : review?.steps.find((s) => s.tone !== "ok"));

  // The payment going through, step by step, while the window is open.
  let progress: Progress[] | null = $state(null);
  let sent = $state(false);

  async function sendIt() {
    if (!review) return;
    progress = [];
    sent = false;
    await follow("/api/send", review.form, (p) => (progress = [...(progress ?? []), p]));
    sent = true;
    // Read the wallet again, so the balance and its history show the result.
    await invalidateAll();
  }

  function closeWindow() {
    progress = null;
  }

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
  <title>Send</title>
</svelte:head>

<h1>Send</h1>
<p class="muted lede">Every payment is checked against this wallet's rules and rehearsed on the chain before anything is signed.</p>

<div class="layout">
  <form
    class="card form"
    method="POST"
    action="?/review"
    novalidate
    use:enhance={submit}
  >
    <div class="field">
      <label for="amount">Amount</label>
      <AmountInput id="amount" name="amount" bind:value={amount} max={chosen?.max ?? ""} placeholder="0.10" />
    </div>

    <div class="field">
      <label id="asset-label" for="asset">Asset</label>
      <AssetPicker
        id="asset"
        name="asset"
        label="asset-label"
        options={data.mandate.limits}
        value={asset}
        onpick={(a) => (asset = a)}
      />
    </div>

    <div class="field">
      <label for="to">Recipient</label>
      <RecipientField id="to" name="to" bind:value={to} options={data.mandate.recipients} />
    </div>

    <button class="btn" type="submit" disabled={reviewing}>
      <Icon name="rules" size="1.1rem" />
      {reviewing ? "Checking…" : "Review"}
    </button>
  </form>

  <BalanceList holdings={data.holdings} current={asset} />
</div>

{#if review}
  <section class="card result" data-tone={review.tone} aria-live="polite">
    <div class="result-head">
      <h2 class="card-title">{review.title}</h2>
      <Pill tone={review.tone} label={review.tone === "ok" ? "Passed" : "Stopped"} />
    </div>
    {#if stopped}
      <p class="why" data-tone={stopped.tone}><span class="why-label">{stopped.label}:</span> {stopped.text}</p>
    {/if}
    {#if review.tone === "ok" && review.quote}
      <dl class="quote">
        <div><dt>Amount</dt><dd class="num money">{review.quote.amount}</dd></div>
        <div><dt>To</dt><dd>{review.quote.to}</dd></div>
        <div><dt>Network Fee</dt><dd class="num money">{review.quote.fee}</dd></div>
        <div><dt>Total</dt><dd class="num money">{review.quote.total}</dd></div>
        <div><dt>Balance After</dt><dd class="num money">{review.quote.after}</dd></div>
      </dl>
      <div class="sign">
        <button class="btn" type="button" onclick={sendIt} disabled={progress !== null}>
          <Icon name="send" size="1.1rem" /> {sent ? "Send Again" : "Send"}
        </button>
        <p class="muted small">Signed on this computer with the testnet key, then broadcast to Arc.</p>
      </div>
    {/if}
  </section>
{/if}

{#if progress}
  <ProgressWindow events={progress} onclose={closeWindow} />
{/if}

<style>
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

  .why {
    margin: 0;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }

  .why-label {
    font-weight: 600;
    color: var(--tone);
  }

  .quote {
    display: grid;
    margin: 0;
    border-radius: var(--radius);
    background: var(--panel-2);
  }

  .quote div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
  }

  .quote div + div {
    border-top: 1px solid var(--rule);
  }

  .quote dt {
    color: var(--ink-3);
  }

  .quote dd {
    margin: 0;
    font-weight: 500;
    text-align: right;
  }

  .sign {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }

  .sign p {
    margin: 0;
  }

  @media (max-width: 48rem) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
