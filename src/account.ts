/**
 * The wallet: load the throwaway testnet key.
 *
 * Its own file so that anything needing the address (send.ts, read.ts) can
 * import it without importing each other.
 *
 * Key handling: the private key is read from a file that must be gitignored,
 * never from source, never from a chat. Use a throwaway testnet wallet.
 * Plain text on disk is the weakest key storage there is; Stage 11 replaces
 * it with an encrypted keystore before any real money is involved.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

// Code lives in src/; the key lives at the repo root.
const KEY_FILE = join(import.meta.dirname, "..", ".testnet_key");

export function loadAccount(): PrivateKeyAccount {
  if (!existsSync(KEY_FILE)) {
    console.error(
      `No key at ${KEY_FILE}.\n` +
        "Create a THROWAWAY testnet wallet and put its private key there.\n" +
        "Never use a key that holds real funds.",
    );
    process.exit(1);
  }
  let key = readFileSync(KEY_FILE, "utf8").trim();
  if (!key.startsWith("0x")) {
    key = "0x" + key;
  }
  return privateKeyToAccount(key as `0x${string}`);
}
