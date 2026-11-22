/**
 * Where the repo's files live, wherever the code runs from.
 *
 * The CLI runs these .ts files straight from src/lib/server/; the web app
 * may run them bundled from somewhere under .svelte-kit/ or build/. Both sit
 * inside the repo, so walk up until the folder that holds this project's
 * package.json. Then the key and the evidence log are always the same files.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

function findRoot(start: string): string {
  for (let dir = start; ; dir = dirname(dir)) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg) && (JSON.parse(readFileSync(pkg, "utf8")) as { name?: string }).name === "arco-sur") {
      return dir;
    }
    if (dirname(dir) === dir) {
      throw new Error(`no arco-sur package.json above ${start}`);
    }
  }
}

// The desktop app runs from inside its own bundle, whose package.json is also
// named arco-sur, so it says where the repo is instead (electron/main.js).
export const ROOT = process.env.ARCO_SUR_ROOT ?? findRoot(import.meta.dirname);
export const KEY_FILE = join(ROOT, ".testnet_key");
export const LOG_FILE = join(ROOT, "evidence", "sends.jsonl");
// What the chain said about the balance in the past. Final, so kept; safe to delete.
export const TIMELINE_FILE = join(ROOT, "cache", "timeline.json");
// The monthly limits set on the Settings screen. Rules, so on the server.
export const LIMITS_FILE = join(ROOT, "settings", "limits.json");
