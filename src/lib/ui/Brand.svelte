<script lang="ts">
  // The Cathedral mark and wordmark: the Sun Door in soft silver (a sun
  // with a pointed doorway opening into it), then "Cathedral" in Space Grotesk.
  import { MARK_VIEWBOX, markSvg } from "./mark.ts";

  let { size = "md", word = true }: { size?: "sm" | "md" | "lg"; word?: boolean } = $props();
  // Each copy of the mark gets its own fade (see mark.ts).
  const uid = $props.id();
  const fade = `mark-${uid}`;
</script>

<span class="brand" data-size={size}>
  <svg viewBox={MARK_VIEWBOX} class="mark" aria-hidden="true">{@html markSvg(fade)}</svg>
  {#if word}<span class="word">Cathedral</span>{/if}
</span>

<style>
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    color: var(--ink);
    font-family: var(--brand-face);
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  /* The sun is round: as tall as the wordmark's capitals and a little more. */
  .mark {
    height: 1.3em;
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
