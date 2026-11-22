<script lang="ts">
  // Receive: the address to give someone who wants to pay this wallet.
  import Icon from "#lib/ui/Icon.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  let copied = $state(false);

  async function copy() {
    await navigator.clipboard.writeText(data.wallet.address);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<svelte:head>
  <title>Receive</title>
</svelte:head>

<h1>Receive</h1>
<p class="muted lede">Give this address to whoever is paying you. It takes USDC and EURC on {data.network}.</p>

<section class="card receive">
  <p class="label">Your Address</p>
  <p class="address num">{data.wallet.address}</p>
  <div class="buttons">
    <button class="btn" onclick={copy}>
      <Icon name={copied ? "check" : "copy"} size="1.1rem" />
      {copied ? "Copied" : "Copy Address"}
    </button>
    <a class="btn ghost" href={data.wallet.url} target="_blank" rel="noreferrer">
      <Icon name="external" size="1.1rem" /> View in Explorer
    </a>
    <a class="btn ghost" href={data.links.faucet} target="_blank" rel="noreferrer">
      <Icon name="faucet" size="1.1rem" /> Get Test Funds
    </a>
  </div>
  <p class="warn" data-tone="warn">
    Testnet only. Never send real money to this address: its key is a throwaway file on this computer.
  </p>
</section>

<style>
  .lede {
    margin: var(--space-1) 0 var(--space-5);
  }

  .receive {
    display: grid;
    gap: var(--space-4);
    justify-items: start;
  }

  .label {
    margin: 0;
    color: var(--ink-3);
  }

  .address {
    margin: 0;
    width: 100%;
    padding: var(--space-4);
    border: 1px dashed var(--rule-strong);
    border-radius: var(--radius);
    font-size: var(--step-1);
    overflow-wrap: anywhere;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .warn {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    background: var(--tone-bg);
    color: var(--tone);
    font-size: var(--step--1);
  }
</style>
