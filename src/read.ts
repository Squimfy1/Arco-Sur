/**
 * Read any contract on Arc with eth_call.
 *
 * A contract is called with bytes: a 4-byte selector (which function) and the
 * arguments, each padded to 32 bytes. That format is the ABI encoding.
 * encodeBalanceOf builds it by hand once, so the bytes are not magic; every
 * other read uses viem's encoder, which handles any type a contract can take
 * or return, and is tested to agree with the hand-built version.
 *
 * Two traps are refused rather than turned into numbers:
 *   - an address with no contract answers "0x" to everything, which a careless
 *     reader shows as a zero balance;
 *   - decimals are read from the token, never assumed, and nonsense is refused.
 *     On Arc, USDC is 18 decimals natively and 6 through its token contract.
 *
 * Read-only: no signing, no gas, no nonce.
 */

import { parseArgs } from "node:util";

import {
  type Abi,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type ContractFunctionReturnType,
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
} from "viem";

import * as arc from "./arc.ts";
import { type KnownContract, TOKENS, USDC } from "./contracts.ts";
import * as guard from "./guard.ts";

/** A read that could not be trusted. Never turned into a default value. */
export class ContractReadError extends Error {
  name = "ContractReadError";
}

/** The two chain calls reading needs. arc.ts answers them live. */
export type Reader = {
  call(to: string, data: `0x${string}`): Promise<`0x${string}`>;
  code(address: string): Promise<`0x${string}`>;
};

// --- the encoding, by hand, once -------------------------------------------

// keccak256("balanceOf(address)"), first 4 bytes.
export const BALANCE_OF_SELECTOR = "0x70a08231";

/** balanceOf(holder) as bytes: selector + the address left-padded to 32 bytes. */
export function encodeBalanceOf(holder: string): `0x${string}` {
  const a = guard.normalise(holder);
  if (a === null) {
    throw new TypeError(`not an address: ${JSON.stringify(holder)}`);
  }
  return `${BALANCE_OF_SELECTOR}${a.slice(2).padStart(64, "0")}`;
}

// --- any contract -------------------------------------------------------------

// Addresses already confirmed to hold code, per reader, so each is checked once.
const confirmed = new WeakMap<Reader, Set<string>>();

async function requireCode(contract: { name?: string; address: string }, reader: Reader): Promise<void> {
  const seen = confirmed.get(reader) ?? new Set<string>();
  confirmed.set(reader, seen);
  const key = contract.address.toLowerCase();
  if (seen.has(key)) {
    return;
  }
  const code = await reader.code(contract.address);
  if (code.length <= 2) {
    throw new ContractReadError(
      `no contract at ${contract.address}${contract.name ? ` (${contract.name})` : ""}: ` +
        "wrong address or wrong network. Refusing to read it as zero.",
    );
  }
  seen.add(key);
}

type ReadFn<abi extends Abi> = ContractFunctionName<abi, "pure" | "view">;

/**
 * Call one read-only function of any contract and decode its answer.
 * Works for every function in the contract's ABI, whatever its types.
 */
export async function readContract<
  const abi extends Abi,
  fn extends ReadFn<abi>,
  const args extends ContractFunctionArgs<abi, "pure" | "view", fn>,
>(
  contract: { name?: string; address: `0x${string}`; abi: abi },
  functionName: fn,
  args: args,
  reader: Reader = arc,
): Promise<ContractFunctionReturnType<abi, "pure" | "view", fn, args>> {
  await requireCode(contract, reader);

  const label = `${contract.name ?? contract.address}.${String(functionName)}`;
  const data = encodeFunctionData({ abi: contract.abi, functionName, args } as never);

  let result: `0x${string}`;
  try {
    result = await reader.call(contract.address, data);
  } catch (e) {
    // The contract exists but refused the call: usually the wrong ABI for
    // this address, or a function that reverts for these arguments.
    if (e instanceof arc.RpcError) {
      throw new ContractReadError(`${label} failed on chain: ${e.message}`);
    }
    throw e;
  }

  if (result === "0x") {
    throw new ContractReadError(`${label} returned nothing`);
  }
  try {
    return decodeFunctionResult({ abi: contract.abi, functionName, data: result } as never) as ContractFunctionReturnType<
      abi,
      "pure" | "view",
      fn,
      args
    >;
  } catch (e) {
    throw new ContractReadError(
      `${label} returned bytes that do not match its ABI: ${(e as Error).message.split("\n")[0]}`,
    );
  }
}

// --- tokens ---------------------------------------------------------------------

// ERC-20 decimals is a uint8, so up to 255 is "valid". Real tokens use 0–18;
// anything far beyond is a broken or hostile token, so it is refused.
const MAX_SANE_DECIMALS = 36;

export type TokenInfo = { symbol: string; decimals: number };

/** A token's symbol and decimals, read from the chain and sanity-checked. */
export async function tokenInfo(token: KnownContract, reader: Reader = arc): Promise<TokenInfo> {
  const erc20 = { ...token, abi: USDC.abi };
  const decimals = await readContract(erc20, "decimals", [], reader);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_SANE_DECIMALS) {
    throw new ContractReadError(`${token.name} reports ${decimals} decimals; refusing to use it`);
  }
  const symbol = await readContract(erc20, "symbol", [], reader);
  return { symbol, decimals };
}

export type TokenBalance = TokenInfo & { raw: bigint; formatted: string };

/** How much of a token a holder has: the raw integer and the readable amount. */
export async function tokenBalance(token: KnownContract, holder: string, reader: Reader = arc): Promise<TokenBalance> {
  const info = await tokenInfo(token, reader);
  const erc20 = { ...token, abi: USDC.abi };
  const raw = await readContract(erc20, "balanceOf", [holder as `0x${string}`], reader);
  return { ...info, raw, formatted: formatUnits(raw, info.decimals) };
}

// Runs only when this file is started directly:
//   npm run balances                       for the wallet in .testnet_key
//   npm run balances -- --address 0x…      for any address
if (import.meta.main) {
  const { values: args } = parseArgs({ options: { address: { type: "string" } } });
  let holder = args.address;
  if (holder === undefined) {
    const { loadAccount } = await import("./send.ts");
    holder = loadAccount().address;
  }
  if (guard.normalise(holder) === null) {
    console.error(`not an address: ${holder}`);
    process.exit(1);
  }

  console.log(`address: ${holder}  (Arc testnet, chain ${arc.CHAIN_ID})\n`);

  const native = await arc.balanceWei(holder);
  console.log(`native  USDC  ${String(guard.fromWei(native)).padEnd(16)} 18 decimals  eth_getBalance`);

  let usdcRaw: bigint | null = null;
  for (const token of TOKENS) {
    const b = await tokenBalance(token, holder);
    if (token.address === USDC.address) usdcRaw = b.raw;
    console.log(
      `token   ${b.symbol.padEnd(5)} ${b.formatted.padEnd(16)} ${String(b.decimals).padStart(2)} decimals  ` +
        `${token.address.slice(0, 6)}…${token.address.slice(-4)}`,
    );
  }

  // Two views of the same money must agree once decimals are applied.
  if (native !== null && usdcRaw !== null) {
    const scale = 10n ** BigInt(guard.ARC_USDC_DECIMALS - 6);
    const agree = native / scale === usdcRaw;
    console.log(
      `\ncheck: native and token views of USDC ${agree ? "agree" : "DISAGREE"} ` +
        `to 6 decimals (${native / scale} vs ${usdcRaw})`,
    );
    process.exitCode = agree ? 0 : 1;
  }
}
