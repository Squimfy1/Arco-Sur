<script lang="ts">
  // The round coin mark beside an asset: the issuer's official logo for the
  // coins that have one here (src/lib/ui/coins), otherwise the character the
  // backend sends ($, €) on a plain disc.
  import eurc from "./coins/eurc.svg";
  import usdc from "./coins/usdc.svg";
  import usdt from "./coins/usdt.svg";

  let { asset, badge, size = "2.25rem" }: { asset: string; badge: string; size?: string } = $props();

  const LOGOS: Record<string, string> = { USDC: usdc, EURC: eurc, USDT: usdt };
  const logo = $derived(LOGOS[asset]);
</script>

{#if logo}
  <img class="badge" src={logo} alt="" style:--size={size} />
{:else}
  <span class="badge glyph" style:--size={size} aria-hidden="true">{badge}</span>
{/if}

<style>
  .badge {
    display: inline-grid;
    place-items: center;
    flex: none;
    /* Circle's minimum for a token logo on screen is 32 px tall. */
    width: max(var(--size), 2rem);
    height: max(var(--size), 2rem);
    border-radius: 50%;
  }

  .glyph {
    font-weight: 600;
    font-size: calc(var(--size) * 0.45);
    color: var(--badge-ink);
    background: var(--other);
  }
</style>
