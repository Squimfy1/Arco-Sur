<script lang="ts" module>
  // Company logos for the Home news, one file per company in ./news, named
  // by the slug the backend sends. Sources are listed in ./news/README.md.
  const FILES = import.meta.glob<string>("./news/*.{svg,png,webp,jpg}", { eager: true, query: "?url", import: "default" });
  const LOGOS: Record<string, string> = Object.fromEntries(
    Object.entries(FILES).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ""), url]),
  );
</script>

<script lang="ts">
  let { slug, company, size = "2.5rem" }: { slug: string; company: string; size?: string } = $props();
  const src = $derived(LOGOS[slug]);
</script>

<span class="logo" style:width={size} style:height={size}>
  {#if src}
    <img {src} alt="" />
  {:else}
    <span class="initial">{company.slice(0, 1)}</span>
  {/if}
  <span class="visually-hidden">{company}</span>
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
