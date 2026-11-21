<script lang="ts">
  // The round coin mark beside an asset. The backend gives the character;
  // the colour per asset is chosen here.
  let { asset, badge, size = "2.25rem" }: { asset: string; badge: string; size?: string } = $props();
  const hue = $derived(asset === "USDC" ? "usd" : asset === "EURC" ? "eur" : "other");
</script>

<span class="badge" data-hue={hue} style:--size={size} aria-hidden="true">{badge}</span>

<style>
  .badge {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    font-weight: 600;
    font-size: calc(var(--size) * 0.45);
    color: var(--badge-ink);
    background: var(--other);
  }

  [data-hue="usd"] {
    background: var(--usd);
  }

  [data-hue="eur"] {
    background: var(--eur);
  }
</style>
