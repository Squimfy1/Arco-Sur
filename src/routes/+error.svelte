<script lang="ts">
  // Shown when the page cannot be read: no key file, or the node is down.
  // The message is the server's own; it never contains the key.
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>Wallet Not Read</title>
</svelte:head>

<main>
  <p class="product">Arco-Sur</p>
  <h1>The wallet could not be read</h1>
  <p class="msg">{page.error?.message ?? "Unknown error"}</p>
  <p><a href="/" data-sveltekit-reload>Try again</a></p>
</main>

<style>
  main {
    max-width: 44rem;
    margin: 0 auto;
    padding: var(--space-6) var(--space-4);
  }

  .product {
    margin: 0;
    font-size: var(--step--1);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink-2);
  }

  h1 {
    font-size: var(--step-2);
    font-weight: 500;
    margin: var(--space-1) 0 var(--space-4);
  }

  .msg {
    font-size: var(--step--1);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
    overflow-wrap: anywhere;
  }
</style>
