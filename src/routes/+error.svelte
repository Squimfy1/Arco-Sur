<script lang="ts">
  // Shown when a screen cannot be read. (When the whole wallet cannot be
  // read, src/error.html is shown instead.) The message is the server's own;
  // it never contains the key.
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>Cathedral · not read</title>
</svelte:head>

<section class="err">
  <p class="label">Cathedral / not read / {page.status}</p>
  <h1 class="display">This screen could not be <em>read</em></h1>
  <pre class="msg">{page.error?.message ?? "Unknown error"}</pre>
  <a class="btn" href="/" data-sveltekit-reload>Try again</a>
</section>

<style>
  .err {
    display: grid;
    gap: var(--space-5);
    justify-items: start;
    max-width: 44rem;
  }

  .err .label {
    margin: 0;
  }

  .msg {
    margin: 0;
    width: 100%;
    padding: var(--space-4);
    border: 1px solid var(--line);
    background: var(--void);
    font-family: var(--mono);
    font-size: var(--step--1);
    color: var(--ink-read);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
