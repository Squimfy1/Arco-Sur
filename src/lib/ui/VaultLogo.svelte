<script lang="ts" module>
  // Protocol and curator logos for the Vaults screen, one file per name in
  // ./vaults, named by the slug the backend sends. Sources: ./vaults/README.md.
  const FILES = import.meta.glob<string>("./vaults/*.{svg,png,webp,jpg}", { eager: true, query: "?url", import: "default" });
  const LOGOS: Record<string, string> = Object.fromEntries(
    Object.entries(FILES).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ""), url]),
  );
</script>

<script lang="ts">
  let { slug, name, size = "2.25rem" }: { slug: string; name: string; size?: string } = $props();
  const src = $derived(LOGOS[slug]);
</script>

<span class="logo" style:width={size} style:height={size}>
  {#if src}
    <img {src} alt="" />
  {:else}
    <span class="initial">{name.slice(0, 1)}</span>
  {/if}
  <span class="visually-hidden">{name}</span>
</span>

<style>
  .logo {
    display: grid;
    place-items: center;
    flex: none;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--logo-plate);
    box-shadow: inset 0 0 0 1px var(--rule);
  }

  img {
    width: 72%;
    height: 72%;
    object-fit: contain;
  }

  .initial {
    font-weight: 600;
    color: var(--ink-2);
  }
</style>
