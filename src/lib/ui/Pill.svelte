<script lang="ts">
  // A status word with a glowing dot in its tone. The word always comes with it.
  import type { Tone } from "../contract.ts";
  let { tone, label }: { tone: Tone; label: string } = $props();
</script>

<span class="pill" data-tone={tone}>{label}</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.2rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: var(--pill);
    background: var(--void);
    font-family: var(--mono);
    font-size: var(--step--2);
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-read);
    white-space: nowrap;
  }

  .pill::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--tone);
    box-shadow: 0 0 8px var(--tone);
  }

  .pill[data-tone="quiet"]::before {
    background: transparent;
    border: 1px solid var(--tone);
    box-shadow: none;
  }
</style>
