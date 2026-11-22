<script lang="ts" module>
  // Line icons on a 24-unit grid, drawn for this app. A name in, a picture
  // out; the backend's Direction values ("out", "in", …) are names here too.
  const PATHS = {
    home: "M3 12 12 4l9 8M5 10v10h5v-6h4v6h5V10",
    portfolio: "M4 20V10m6 10V4m6 16v-7m4 7H3",
    operations: "M4 7h13M4 7l3-3M4 7l3 3M20 17H7m13 0-3-3m3 3-3 3",
    send: "M12 20V5m0 0-6 6m6-6 6 6",
    receive: "M12 4v15m0 0-6-6m6 6 6-6",
    swap: "M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3",
    faucet: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z",
    explorer: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4",
    rules: "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
    refresh: "M20 11a8 8 0 0 0-14.6-4M4 4v4h4m-4 5a8 8 0 0 0 14.6 4M20 20v-4h-4",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
    "eye-off": "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2",
    copy: "M9 9h11v11H9zM5 15H4V4h11v1",
    check: "m5 12 5 5 9-10",
    chevron: "m7 10 5 5 5-5",
    external: "M14 4h6v6m0-6-9 9M18 14v6H4V6h6",
    out: "M7 17 17 7m0 0H9m8 0v8",
    in: "M17 7 7 17m0 0h8m-8 0V9",
    self: "M17 3l3 3-3 3M20 6H9a5 5 0 0 0 0 10h1M7 21l-3-3 3-3M4 18h11a5 5 0 0 0 0-10h-1",
    approve: "M14 10a4 4 0 1 0-4 4l1 1h2v2h2v2h3v-3l-4-4Z",
    refused: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM5.6 5.6l12.8 12.8",
    lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
    filter: "M4 5h16l-6 7.5V18l-4 2v-7.5L4 5Z",
    close: "M6 6l12 12M18 6 6 18",
    vault: "M4 4h16v15H4zM6 19v2m12-2v2M14 11.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm2 0h1.5",
    settings:
      "M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  } as const;

  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = "1.25rem" }: { name: IconName; size?: string } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.8"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name]} />
</svg>
