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

export const ROOT = findRoot(import.meta.dirname);
export const KEY_FILE = join(ROOT, ".testnet_key");
export const LOG_FILE = join(ROOT, "evidence", "sends.jsonl");
