<script lang="ts">
  // The amount: a large field, the biggest thing in a form, with Max inside
  // it on the right. Max puts in the figure the backend worked out; nothing
  // is calculated here.
  let {
    id,
    name,
    value = $bindable(""),
    max = "",
    disabled = false,
    placeholder = "0.00",
    label,
  }: { id: string; name?: string; value?: string; max?: string; disabled?: boolean; placeholder?: string; label?: string } = $props();
</script>

<div class="amount" class:off={disabled}>
  <input
    {id}
    {name}
    class="num"
    inputmode="decimal"
    autocomplete="off"
    {placeholder}
    {disabled}
    aria-label={label}
    required={!disabled}
    bind:value
  />
  {#if !disabled}
    <button class="max" type="button" disabled={!max} onclick={() => (value = max)}>Max</button>
  {/if}
</div>

<style>
  .amount {
    position: relative;
  }

  input {
    width: 100%;
    min-height: 4.25rem;
    padding: 0 5.5rem 0 var(--space-4);
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius-lg);
    background: var(--bg);
    font-size: var(--step-3);
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  input::placeholder {
    color: var(--ink-3);
  }

  .off input {
    padding-right: var(--space-4);
    color: var(--ink-3);
  }

  .max {
    position: absolute;
    top: 50%;
    right: var(--space-3);
    transform: translateY(-50%);
    padding: var(--space-2) var(--space-4);
    border: 0;
    border-radius: var(--pill);
    background: var(--panel-2);
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s var(--ease-out);
  }

  .max:hover {
    background: var(--hover);
  }

  .max:disabled {
    color: var(--ink-3);
    cursor: not-allowed;
  }
</style>
