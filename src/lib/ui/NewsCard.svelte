<script lang="ts">
  // One story: the company's logo and name, what kind of news it is, a
  // headline, two sentences, and the day, linking to where it was announced.
  import type { NewsItem } from "../contract.ts";
  import Icon from "./Icon.svelte";
  import NewsLogo from "./NewsLogo.svelte";

  let { item }: { item: NewsItem } = $props();
</script>

<article class="card story">
  <header>
    <NewsLogo slug={item.slug} company={item.company} size="2.75rem" />
    <span class="who">
      <span class="company">{item.company}</span>
      <span class="muted topic">{item.topic}</span>
    </span>
    <span class="kind">{item.kind}</span>
  </header>
  <h3>{item.headline}</h3>
  <p class="summary">{item.summary}</p>
  <footer>
    <span class="muted">{item.date}</span>
    <a href={item.source} target="_blank" rel="noreferrer">Read More <Icon name="external" size="0.95rem" /></a>
  </footer>
</article>

<style>
  .story {
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    gap: var(--space-3);
    transition:
      transform 0.2s var(--ease-out),
      box-shadow 0.2s var(--ease-out);
  }

  .story:hover {
    transform: translateY(-2px);
    box-shadow: var(--lift), inset 0 0 0 1px var(--rule-strong);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .who {
    display: grid;
    flex: 1;
    min-width: 0;
    line-height: 1.25;
  }

  .company {
    font-weight: 600;
  }

  .topic {
    font-size: var(--step--1);
  }

  .kind {
    flex: none;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--pill);
    background: var(--accent-soft);
    color: var(--ink);
    font-size: var(--step--1);
    font-weight: 500;
  }

  h3 {
    margin: var(--space-1) 0 0;
    font-size: var(--step-2);
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .summary {
    margin: 0;
    color: var(--ink-2);
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--step--1);
  }

  footer a {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--accent);
    font-weight: 500;
  }

  footer a:hover {
    text-decoration: underline;
  }
</style>
