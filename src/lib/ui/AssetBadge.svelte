<script lang="ts">
  // The round mark beside an asset: its character ($, €) on a raised disc.
  let { badge, size = "2.25rem" }: { badge: string; size?: string } = $props();
</script>

<span class="badge-mark" style:--size={size} aria-hidden="true">{badge}</span>

<style>
  .badge-mark {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    border: 1px solid var(--bezel);
    background: var(--raised);
    font-family: var(--brand-face);
    font-weight: 500;
    font-size: calc(var(--size) * 0.42);
    color: var(--ink);
  }
</style>
