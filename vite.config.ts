// One config for the web app (SvelteKit on Vite) and the tests (Vitest).
//
// The app is a local tool: it listens on 127.0.0.1 only, never on the
// network, because the server side holds the wallet's key.

import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

const local = { host: "127.0.0.1", port: 5173, strictPort: true };

export default defineConfig({
  plugins: [sveltekit({ adapter: adapter() })],
  server: local,
  preview: local,
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
