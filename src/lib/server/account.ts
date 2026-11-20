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
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

import { KEY_FILE } from "./paths.ts";

/** No key file. Raised, not exited on, so the web app can show it as a page. */
export class NoKeyError extends Error {
  name = "NoKeyError";
  constructor() {
    super(
      `No key at ${KEY_FILE}. ` +
        "Create a THROWAWAY testnet wallet and put its private key there. " +
        "Never use a key that holds real funds.",
    );
  }
}

/** The wallet, or NoKeyError. */
export function readAccount(): PrivateKeyAccount {
  if (!existsSync(KEY_FILE)) {
    throw new NoKeyError();
  }
  let key = readFileSync(KEY_FILE, "utf8").trim();
  if (!key.startsWith("0x")) {
    key = "0x" + key;
  }
  return privateKeyToAccount(key as `0x${string}`);
}

/** For the CLI: the wallet, or a clear message and exit code 1. */
export function loadAccount(): PrivateKeyAccount {
  try {
    return readAccount();
  } catch (e) {
    if (e instanceof NoKeyError) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
}
