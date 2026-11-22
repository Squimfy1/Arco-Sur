<script lang="ts">
  // Home: Arc's header, the moving news line, then the stories, filtered by
  // the topic and the kind of news chosen; the two filters work together.
  // The stories come from the backend (src/lib/server/news.ts).
  import ArcHeader from "#lib/ui/ArcHeader.svelte";
  import FilterMenu from "#lib/ui/FilterMenu.svelte";
  import NewsCard from "#lib/ui/NewsCard.svelte";
  import NewsTicker from "#lib/ui/NewsTicker.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const ALL = "All";
  let chosen: Record<string, string> = $state({});
  const topic = $derived(chosen.topic ?? ALL);
  const kind = $derived(chosen.kind ?? ALL);
  const shown = $derived(
    data.news.items.filter((n) => (topic === ALL || n.topic === topic) && (kind === ALL || n.kind === kind)),
  );
  const groups = $derived([
    { id: "topic", label: "Topic", options: data.news.topics },
    { id: "kind", label: "Kind", options: data.news.kinds },
  ]);
</script>

<svelte:head>
  <title>Home</title>
</svelte:head>

<h1 class="visually-hidden">Home</h1>
<ArcHeader subtitle="The stablecoin chain, and what is being built on it." />

<section class="news" aria-labelledby="news-title">
  <div class="head">
    <h2 id="news-title">What's Going On in Arc</h2>
    <p class="muted">News from companies in the <a href={data.news.ecosystem} target="_blank" rel="noreferrer">Arc ecosystem</a>, as of {data.news.asOf}.</p>
  </div>

  <NewsTicker items={data.news.items} />

  <FilterMenu {groups} bind:chosen all={ALL} />

  <div class="grid">
    {#each shown as item (item.headline)}
      <NewsCard {item} />
    {:else}
      <p class="muted none">No news of that kind in this topic yet.</p>
    {/each}
  </div>
</section>

<style>
  .news {
    display: grid;
    gap: var(--space-5);
    margin-top: var(--space-6);
  }

  .head {
    display: grid;
    gap: var(--space-1);
  }

  h2 {
    margin: 0;
    font-size: var(--step-4);
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .head p {
    margin: 0;
  }

  .head a {
    color: var(--accent);
  }

  .none {
    margin: 0;
  }




  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
    gap: var(--space-4);
  }
</style>
