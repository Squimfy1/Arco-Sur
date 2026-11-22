<script lang="ts">
  // The Home header: Arc's logo, large, over a globe of purple cubes that
  // turns slowly with agents flying between money centres. Only the top of
  // the globe shows. It stays dark in both looks (data-theme="dark"), so
  // Arc's white logo always reads.
  import arc from "./brand/arc-on-dark.svg";
  import { startGlobe } from "./globe/render.ts";

  let { subtitle }: { subtitle: string } = $props();
  let canvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    if (canvas) return startGlobe(canvas);
  });
</script>

<header class="arc-header" data-theme="dark">
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  <div class="words">
    <img class="logo" src={arc} alt="Arc" />
    <p class="subtitle">{subtitle}</p>
  </div>
</header>

<style>
  .arc-header {
    position: relative;
    overflow: hidden;
    height: clamp(18rem, 32vw, 24rem);
    border-radius: var(--radius-lg);
    background: var(--globe-bg);
    box-shadow: inset 0 0 0 1px var(--rule);
    isolation: isolate;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  /* The words sit over the empty left side; the pointer passes through to the globe. */
  .words {
    position: absolute;
    left: var(--space-6);
    bottom: var(--space-6);
    display: grid;
    gap: var(--space-3);
    pointer-events: none;
  }

  .logo {
    height: clamp(4.5rem, 9vw, 7rem);
    width: auto;
    justify-self: start;
  }

  .subtitle {
    margin: 0;
    max-width: 22rem;
    color: var(--ink-2);
    font-size: var(--step-1);
  }
</style>
