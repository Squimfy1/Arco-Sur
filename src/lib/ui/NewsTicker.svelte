<script lang="ts">
  // The moving news line: one pill per story, drifting slowly to the left
  // without end. It stops while the pointer is over it, and stands still
  // for anyone who has asked the computer for less motion.
  import type { NewsItem } from "../contract.ts";
  import NewsLogo from "./NewsLogo.svelte";

  let { items }: { items: NewsItem[] } = $props();

  // The second copy is only there to close the loop: screen readers and the
  // Tab key skip it.
  const SKIP = -1;
</script>

<div class="ticker" aria-label="Latest from the Arc ecosystem">
  <div class="track">
    {#each [0, 1] as copy (copy)}
      <ul aria-hidden={copy === 1 ? "true" : undefined}>
        {#each items as n (n.headline)}
          <li>
            <a class="pill" href={n.source} target="_blank" rel="noreferrer" tabindex={copy === 1 ? SKIP : undefined}>
              <NewsLogo slug={n.slug} company={n.company} size="1.5rem" />
              <span class="company">{n.company}</span>
              <span class="text">{n.ticker}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/each}
  </div>
</div>

<style>
  .ticker {
    overflow: hidden;
    mask-image: linear-gradient(to right, transparent, var(--ink) 6%, var(--ink) 94%, transparent);
  }

  .track {
    display: flex;
    width: max-content;
  }

  ul {
    display: flex;
    gap: var(--space-3);
    margin: 0;
    padding: var(--space-1) var(--space-3) var(--space-1) 0;
    list-style: none;
  }

  .pill {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-4) var(--space-1) var(--space-1);
    border-radius: var(--pill);
    background: var(--panel);
    box-shadow: inset 0 0 0 1px var(--rule);
    white-space: nowrap;
    transition: background-color 0.2s var(--ease-out);
  }

  .pill:hover {
    background: var(--panel-2);
  }

  .pill :global(.logo) {
    border-radius: 50%;
  }

  .company {
    font-weight: 600;
  }

  .text {
    color: var(--ink-2);
  }

  @media (prefers-reduced-motion: no-preference) {
    .track {
      animation: drift var(--ticker-time, 80s) linear infinite;
    }

    .ticker:hover .track,
    .ticker:focus-within .track {
      animation-play-state: paused;
    }

    @keyframes drift {
      to {
        transform: translateX(-50%);
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ticker {
      overflow-x: auto;
    }
  }
</style>
