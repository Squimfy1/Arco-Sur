<script lang="ts">
  // The Cathedral mark and wordmark: the cross, then "Cathedral" in Space
  // Grotesk with only the C capitalised (the "07 Capital C" pick).
  import { CROSS_PATH, CROSS_VIEWBOX } from "./cross.ts";

  let { size = "md", word = true }: { size?: "sm" | "md" | "lg"; word?: boolean } = $props();
</script>

<span class="brand" data-size={size}>
  <svg viewBox={CROSS_VIEWBOX} class="cross" aria-hidden="true"><path fill="currentColor" d={CROSS_PATH} /></svg>
  {#if word}<span class="word">Cathedral</span>{/if}
</span>

<style>
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.6em;
    color: var(--ink);
    font-family: var(--brand-face);
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .cross {
    height: 1.55em;
    width: auto;
    flex: none;
  }

  [data-size="sm"] {
    font-size: 1rem;
  }

  [data-size="md"] {
    font-size: 1.1875rem;
  }

  [data-size="lg"] {
    font-size: 2.5rem;
  }
</style>
