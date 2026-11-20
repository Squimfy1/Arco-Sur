/**
 * Arc RPC client. The helpers only read; ask() can also broadcast.
 *
 * One lesson baked in: Arc's edge rejects Python's default User-Agent with
 * HTTP 403. The UA below is required, not cosmetic. (Browsers send their own
 * User-Agent and do not let a page change it.)
 */

export const RPC = "https://rpc.testnet.arc.io";
export const CHAIN_ID = 5042002;

// Arc rejects the default python-urllib User-Agent with 403.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/** The node answered, and its answer was an error. */
export class RpcError extends Error {
  name = "RpcError";
}

/**
 * Make one JSON-RPC call. Returns the `result` field.
 *
 * Throws RpcError if the node returns an error object, so a failure is
 * never silently treated as a value. An HTTP failure (such as 403) is a
 * plain Error: the node was never reached.
 */
export async function ask(method: string, params: unknown[] = [], timeoutMs = 25_000): Promise<unknown> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`${method}: HTTP ${res.status} ${res.statusText}`);
  }

  const payload = (await res.json()) as { result?: unknown; error?: unknown };

  if (payload.error !== undefined) {
    throw new RpcError(`${method}: ${JSON.stringify(payload.error)}`);
  }

  return payload.result ?? null;
}

/** 0x hex string to bigint. null stays null, so UNKNOWN stays UNKNOWN. */
export function toInt(hex: unknown): bigint | null {
  if (hex === null || hex === undefined) {
    return null;
  }
  return BigInt(hex as string);
}

// --- the calls the execution loop and the reconciler need ------------------

export async function blockNumber(): Promise<bigint | null> {
  return toInt(await ask("eth_blockNumber"));
}

export async function balanceWei(address: string): Promise<bigint | null> {
  return toInt(await ask("eth_getBalance", [address, "latest"]));
}

/**
 * Transactions already sent from this address.
 *
 * This is the protocol's own idempotency counter: transaction N cannot be
 * mined twice, and cannot be mined before N-1.
 */
export async function nonce(address: string): Promise<number | null> {
  const n = toInt(await ask("eth_getTransactionCount", [address, "latest"]));
  return n === null ? null : Number(n);
}

export async function gasPrice(): Promise<bigint | null> {
  return toInt(await ask("eth_gasPrice"));
}

/** The receipt fields this project reads. The node sends more. */
export type Receipt = {
  status?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  blockNumber?: string;
};

/** null while pending. Once mined: status 1 = success, 0 = reverted. */
export async function receipt(txHash: string): Promise<Receipt | null> {
  return (await ask("eth_getTransactionReceipt", [txHash])) as Receipt | null;
}

/** The transaction fields this project reads. The node sends more. */
export type ChainTx = {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  nonce: string;
  blockNumber: string | null;
};

/**
 * What a transaction actually contained, as the chain recorded it.
 * null if the chain has never seen this hash. The receipt says whether it
 * succeeded; this says who, to whom, and how much.
 */
export async function transaction(txHash: string): Promise<ChainTx | null> {
  return (await ask("eth_getTransactionByHash", [txHash])) as ChainTx | null;
}

// --- contracts ----------------------------------------------------------------

/**
 * Run a contract function read-only and return its raw answer.
 *
 * eth_call executes on the node and throws the result away: no transaction,
 * no gas, no nonce, no signature. Careful: an address with NO contract also
 * answers "0x" without any error. read.ts checks code() first for that reason.
 */
export async function call(to: string, data: `0x${string}`): Promise<`0x${string}`> {
  return (await ask("eth_call", [{ to, data }, "latest"])) as `0x${string}`;
}

/** The contract's deployed bytecode. "0x" means there is no contract there. */
export async function code(address: string): Promise<`0x${string}`> {
  return (await ask("eth_getCode", [address, "latest"])) as `0x${string}`;
}
