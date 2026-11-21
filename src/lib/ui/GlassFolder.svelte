<script lang="ts">
  // The library's glass folder: a dark back with a tab, two paper sheets,
  // and a frosted front panel with a debossed label. CSS only.
  let { label }: { label: string } = $props();
</script>

<div class="gf" aria-hidden="true">
  <div class="back"></div>
  <div class="paper p1"></div>
  <div class="paper p2"></div>
  <div class="front"><span class="name">{label}</span></div>
</div>

<style>
  .gf {
    position: relative;
    width: 11rem;
    height: 8.25rem;
  }

  .back {
    position: absolute;
    inset: 12px 0 0;
    background: var(--folder);
    border-radius: 14px;
  }

  .back::before {
    content: "";
    position: absolute;
    left: 0;
    top: -10px;
    width: 64px;
    height: 22px;
    background: var(--folder);
    border-radius: 10px 10px 0 0;
  }

  .paper {
    position: absolute;
    background: linear-gradient(180deg, var(--paper-top), var(--paper-bottom));
    border-radius: 4px;
    box-shadow: 0 1px 3px var(--shade);
  }

  .p1 {
    left: 24px;
    top: 4px;
    width: 96px;
    height: 92px;
  }

  .p2 {
    left: 66px;
    top: -2px;
    width: 84px;
    height: 92px;
    clip-path: polygon(0 0, 72% 0, 100% 18%, 100% 100%, 0 100%);
  }

  .front {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 86px;
    border-radius: 12px;
    background: var(--folder-front);
    -webkit-backdrop-filter: blur(9px);
    backdrop-filter: blur(9px);
    border: 1px solid var(--folder-edge);
    box-shadow: inset 0 1px 0 var(--folder-shine), 0 14px 28px var(--shade);
  }

  .name {
    position: absolute;
    left: 16px;
    bottom: 14px;
    font-size: 1.0625rem;
    color: var(--folder-label);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
