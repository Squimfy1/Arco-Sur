import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

const local = { host: "127.0.0.1", port: 5173, strictPort: true };

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter(),
      // The window may load only the app's own files: no outside scripts,
      // styles, fonts or connections. SvelteKit hashes its own inline script.
      csp: {
        mode: "hash",
        directives: {
          "default-src": ["self"],
          "script-src": ["self"],
          "style-src": ["self", "unsafe-inline"],
          "img-src": ["self", "data:"],
          "font-src": ["self"],
          "connect-src": ["self"],
          "object-src": ["none"],
          "base-uri": ["none"],
          "form-action": ["self"],
          "frame-ancestors": ["none"],
        },
      },
    }),
  ],
  // Every font and image stays a real file, never an inline data: URL, so the
  // strict font-src and img-src above need no exception.
  build: { assetsInlineLimit: 0 },
  // `npm run dev` only, for working on the screens with hot reload.
  server: local,
  preview: local,
  test: { include: ["tests/**/*.test.ts"] },
});
