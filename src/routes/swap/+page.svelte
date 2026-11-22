<script lang="ts">
  // Swap: choose what to give and what to get, ask Circle's swap service for
  // a quote, then Swap. The server approves Circle's swap contract for
  // exactly the amount, swaps, and the progress window follows each step.
  // Every figure comes from the backend; nothing is worked out here.
  import { invalidateAll } from "$app/navigation";
  import AmountInput from "#lib/ui/AmountInput.svelte";
  import AssetPicker from "#lib/ui/AssetPicker.svelte";
  import BalanceList from "#lib/ui/BalanceList.svelte";
  import Icon from "#lib/ui/Icon.svelte";
  import ProgressWindow from "#lib/ui/ProgressWindow.svelte";
  import { follow } from "#lib/ui/progress.ts";
  import type { Progress, SwapQuoteView } from "#lib/contract.ts";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let from = $state("USDC");
  let to = $state("EURC");
  let amount = $state("");
  let quote: SwapQuoteView | null = $state(null);
  let problem = $state("");
  let quoting = $state(false);
  let progress: Progress[] | null = $state(null);

  const held = $derived(data.mandate.limits.find((l) => l.asset === from)?.max ?? "");
  const asked = $derived({ from, to, amount });

  // A quote is for one exact swap: any change asks for a new one.
  $effect(() => {
    void asked;
    quote = null;
    problem = "";
  });

  function flip() {
    [from, to] = [to, from];
  }

  async function getQuote() {
    quoting = true;
    problem = "";
    const request = { from, to, amount };
    try {
      const r = await fetch("/api/swap/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const body = (await r.json()) as { quote?: SwapQuoteView; error?: string };
      if (body.quote) quote = body.quote;
      else problem = body.error ?? "Circle's swap service gave no quote.";
    } catch (e) {
      problem = `The app's server did not answer: ${(e as Error).message}`;
    } finally {
      quoting = false;
    }
  }

  async function swapIt() {
    progress = [];
    await follow("/api/swap", { from, to, amount }, (p) => (progress = [...(progress ?? []), p]));
    await invalidateAll();
  }

  function closeWindow() {
    progress = null;
    quote = null;
    amount = "";
  }
</script>

<svelte:head>
  <title>Swap</title>
</svelte:head>

<h1>Swap</h1>
<p class="muted lede">Trade one asset for another through Circle's swap service.</p>

<div class="layout">
  <section class="card swap">
    <div class="side">
      <label class="muted" for="from-amount" id="from-label">From</label>
      <AmountInput id="from-amount" bind:value={amount} max={held} label="Amount to swap" />
      <AssetPicker id="from" name="from" label="from-label" options={data.mandate.limits} value={from} onpick={(a) => (from = a)} />
    </div>
    <button class="arrow" type="button" onclick={flip} aria-label="Swap the two sides" title="Swap the two sides">
      <Icon name="swap" />
    </button>
    <div class="side">
      <span class="muted" id="to-label">To</span>
      <AmountInput id="to-amount" disabled value={quote?.estimate ?? ""} label="Amount received, about" />
      <AssetPicker id="to" name="to" label="to-label" options={data.mandate.limits} value={to} onpick={(a) => (to = a)} />
    </div>

    {#if quote}
      <dl class="quote" aria-live="polite">
        <div><dt>You Pay</dt><dd class="num money">{quote.pay}</dd></div>
        <div><dt>You Receive, About</dt><dd class="num money">{quote.receive}</dd></div>
        <div><dt>At Least</dt><dd class="num money">{quote.atLeast}</dd></div>
        <div><dt>Rate</dt><dd class="num">{quote.rate}</dd></div>
        <div><dt>Fees</dt><dd class="num">{quote.fee}</dd></div>
        <div><dt>Quote Expires</dt><dd>{quote.expires}</dd></div>
      </dl>
      <p class="note" data-tone="warn">Testnet prices come from thin test pools and are not market prices.</p>
      <button class="btn" type="button" onclick={swapIt} disabled={progress !== null}>
        <Icon name="swap" size="1.1rem" /> Swap
      </button>
    {:else}
      <button class="btn" type="button" onclick={getQuote} disabled={quoting || amount === ""}>
        <Icon name="rules" size="1.1rem" /> {quoting ? "Asking Circle…" : "Get Quote"}
      </button>
    {/if}
    {#if problem}
      <p class="note" data-tone="bad" role="alert">{problem}</p>
    {/if}
    <p class="why">
      A swap lets one contract take your tokens: <strong>{data.mandate.spenders}</strong> The rules check that every token
      it pays out comes back to this wallet before anything is signed.
    </p>
  </section>

  <BalanceList holdings={data.holdings} current={from} />
</div>

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

  .swap {
    display: grid;
    gap: var(--space-3);
  }

  .swap > .btn {
    justify-self: start;
  }

  .side {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: var(--radius);
    background: var(--panel-2);
  }

  .arrow {
    justify-self: center;
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 0;
    border-radius: 50%;
    background: var(--panel-2);
    color: var(--ink-2);
    cursor: pointer;
    transition:
      background-color 0.2s var(--ease-out),
      transform 0.3s var(--ease-out);
  }

  .arrow:hover {
    background: var(--hover);
    color: var(--ink);
    transform: rotate(180deg);
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

  .note {
    margin: 0;
    font-size: var(--step--1);
    color: var(--tone);
  }

  .why {
    margin: 0;
    font-size: var(--step--1);
    color: var(--ink-2);
  }

  @media (max-width: 48rem) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
