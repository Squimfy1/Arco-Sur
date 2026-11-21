<script lang="ts">
  // A status word in its tone's colour. The word always comes with it.
  import type { Tone } from "../contract.ts";
  let { tone, label }: { tone: Tone; label: string } = $props();
</script>

<span class="pill" data-tone={tone}>{label}</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0.1rem var(--space-2);
    border-radius: var(--pill);
    font-size: var(--step--2);
    font-weight: 500;
    color: var(--tone);
    background: var(--tone-bg);
    white-space: nowrap;
  }

  .pill::before {
    content: "";
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: currentColor;
  }
</style>
