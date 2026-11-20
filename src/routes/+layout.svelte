<script lang="ts">
  // Fonts are bundled from node_modules, so the page makes no request
  // outside localhost.
  import "@fontsource/ibm-plex-sans/400.css";
  import "@fontsource/ibm-plex-sans/500.css";
  import "@fontsource/ibm-plex-sans/600.css";
  import "@fontsource/ibm-plex-mono/400.css";
  import "@fontsource/ibm-plex-mono/500.css";
  import "../app.css";

  let { children } = $props();
</script>

{@render children()}
