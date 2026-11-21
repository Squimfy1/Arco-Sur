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
  <title>Cathedral · Receive</title>
</svelte:head>

<header class="page-head">
  <p class="label">Move / receive</p>
  <h1 class="display">Receive <em>funds</em></h1>
  <p class="lede muted">Give this address to whoever is paying you. It takes USDC and EURC on {data.network}.</p>
</header>

<section class="card void terrain address-card reg">
  <p class="label">Your address</p>
  <p class="address num">{data.wallet.address}</p>
  <div class="buttons">
    <button class="btn" onclick={copy}>
      <Icon name={copied ? "check" : "copy"} size="1.05rem" />
      {copied ? "Copied" : "Copy address"}
    </button>
    <a class="btn ghost" href={data.wallet.url} target="_blank" rel="noreferrer"><Icon name="external" size="1.05rem" /> Explorer ↗</a>
    <a class="btn ghost" href={data.links.faucet} target="_blank" rel="noreferrer"><Icon name="faucet" size="1.05rem" /> Get test funds ↗</a>
  </div>
</section>

<div class="key-idea warn">
  <span class="label">+ Testnet only</span>
  <span>Never send real money to this address. Its key is a throwaway file on this computer.</span>
</div>

<style>
  .page-head {
    padding-bottom: var(--space-6);
  }

  .page-head .label {
    margin: 0 0 var(--space-3);
  }

  .lede {
    margin: var(--space-4) 0 0;
  }

  .address-card {
    display: grid;
    gap: var(--space-4);
    justify-items: start;
    padding: var(--space-7) var(--space-6) var(--space-6);
    background-position: center 85%;
  }

  .address-card .label {
    margin: 0;
  }

  .address {
    margin: 0;
    width: 100%;
    font-size: clamp(1rem, 2.2vw, 1.5rem);
    font-weight: 300;
    overflow-wrap: anywhere;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .warn {
    margin-top: var(--space-6);
    max-width: 40rem;
  }
</style>
