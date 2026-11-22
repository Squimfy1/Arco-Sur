/**
 * Swap one asset for another on Arc testnet, through Circle's own swap
 * service (App Kit Swap). Two transactions, both through execute(), so both
 * meet the guard, the rehearsal and the evidence log like any send:
 *
 *     1. quote      Circle's Stablecoin Service prices the swap and signs a
 *                   route for this wallet: what goes in, the least that must
 *                   come out, and who is paid (this wallet, and no one else;
 *                   the guard checks that from the call itself)
 *     2. approve    let Circle's swap contract take EXACTLY the amount in,
 *                   counted against the asset's total like a payment
 *     3. swap       one call to the swap contract, which takes the amount
 *                   and pays the output back here
 *     4. received   the output token's own Transfer events show what arrived
 *
 * The quote comes from https://api.circle.com/v1/stablecoinKits/swap, the
 * same service the SDK calls; no API key is needed on testnet. Testnet pools
 * are thin and their prices are not market prices.
 */

import { encodeFunctionData } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";

import { CIRBTC, EURC, SWAP_ADAPTER, USDC } from "./contracts.ts";
import * as guard from "./guard.ts";
import { decodeIntent, encodeApprove, type TxRequest } from "./intent.ts";
import { type ExecStep, execute } from "./send.ts";

const SERVICE = "https://api.circle.com/v1/stablecoinKits/swap";
const CHAIN = "Arc_Testnet";
// Testnet pools are thin: Arc's docs advise a wide slippage so a quote that
// moves a little before it lands does not fail. The minimum is shown first.
export const SLIPPAGE_BPS = 1000;

/** The assets a swap can use, as the swap contract sees them (USDC through its 6-decimal token view). */
export const SWAP_ASSETS: Record<string, { address: `0x${string}`; decimals: number }> = {
  USDC: { address: USDC.address, decimals: guard.ARC_USDC_TOKEN_DECIMALS },
  EURC: { address: EURC.address, decimals: 6 },
  cirBTC: { address: CIRBTC.address, decimals: 8 },
};

export class SwapError extends Error {
  name = "SwapError";
}

export type SwapRequest = { from: string; to: string; amount: string };

/** A swap request from the screen, as JSON. Anything missing is empty. */
export function readSwap(body: unknown): SwapRequest {
  const o = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return { from: text(o.from), to: text(o.to), amount: text(o.amount) };
}

/** A priced swap, ready to run: the two transactions and what to expect. Amounts in base units. */
export type SwapQuote = {
  request: SwapRequest;
  amountIn: bigint;
  estimatedOut: bigint;
  minOut: bigint;
  fee: bigint;
  deadline: bigint;
  approve: TxRequest;
  swap: TxRequest;
};

/** The service's answer, the parts read here. */
type ServiceQuote = {
  estimatedAmount: string;
  stopLimit: string;
  tokenInAddress: string;
  tokenOutAddress: string;
  toAddress: string;
  fees?: { provider?: { amount: string }[] };
  transaction: {
    signature: `0x${string}`;
    executionParams: {
      execId: string;
      deadline: string;
      metadata: `0x${string}`;
      tokens: { token: `0x${string}`; beneficiary: `0x${string}` }[];
      instructions: {
        target: `0x${string}`;
        data: `0x${string}`;
        value: string;
        tokenIn: `0x${string}`;
        amountToApprove: string;
        tokenOut: `0x${string}`;
        minTokenOut: string;
      }[];
    };
  };
};

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Price a swap for `me`. Throws SwapError with a reason a person can read. */
export async function quoteSwap(request: SwapRequest, me: string, fetcher: Fetcher = fetch): Promise<SwapQuote> {
  const tokenIn = SWAP_ASSETS[request.from];
  const tokenOut = SWAP_ASSETS[request.to];
  if (tokenIn === undefined || tokenOut === undefined) {
    throw new SwapError(`swaps are between ${Object.keys(SWAP_ASSETS).join(", ")}`);
  }
  if (request.from === request.to) {
    throw new SwapError(`a swap from ${request.from} to itself`);
  }
  let amountIn: bigint;
  try {
    amountIn = guard.toUnits(request.amount, tokenIn.decimals);
  } catch {
    throw new SwapError(request.amount === "" ? "no amount given" : `not a ${request.from} amount: ${JSON.stringify(request.amount)}`);
  }
  if (amountIn <= 0n) {
    throw new SwapError("the amount must be more than zero");
  }

  let response: Response;
  try {
    response = await fetcher(SERVICE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenInAddress: tokenIn.address,
        tokenInChain: CHAIN,
        tokenOutAddress: tokenOut.address,
        tokenOutChain: CHAIN,
        fromAddress: me,
        toAddress: me,
        amount: amountIn.toString(),
        slippageBps: SLIPPAGE_BPS,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new SwapError(`Circle's swap service did not answer: ${(e as Error).message}`);
  }
  const body = (await response.json().catch(() => null)) as (ServiceQuote & { message?: string }) | null;
  if (!response.ok || body === null || body.transaction === undefined) {
    throw new SwapError(`Circle's swap service could not price this: ${body?.message ?? `HTTP ${response.status}`}`);
  }
  if (
    guard.normalise(body.tokenInAddress) !== guard.normalise(tokenIn.address) ||
    guard.normalise(body.tokenOutAddress) !== guard.normalise(tokenOut.address) ||
    guard.normalise(body.toAddress) !== guard.normalise(me)
  ) {
    throw new SwapError("the quote does not match the swap asked for");
  }

  const ep = body.transaction.executionParams;
  const params = {
    instructions: ep.instructions.map((i) => ({
      target: i.target,
      data: i.data,
      value: BigInt(i.value),
      tokenIn: i.tokenIn,
      amountToApprove: BigInt(i.amountToApprove),
      tokenOut: i.tokenOut,
      minTokenOut: BigInt(i.minTokenOut),
    })),
    tokens: ep.tokens,
    execId: BigInt(ep.execId),
    deadline: BigInt(ep.deadline),
    metadata: ep.metadata,
  };
  const data = encodeFunctionData({
    abi: SWAP_ADAPTER.abi,
    functionName: "execute",
    args: [params, [{ permitType: 0, token: tokenIn.address, amount: amountIn, permitCalldata: "0x" }], body.transaction.signature],
  });

  return {
    request,
    amountIn,
    estimatedOut: BigInt(body.estimatedAmount),
    minOut: BigInt(body.stopLimit),
    fee: (body.fees?.provider ?? []).reduce((sum, f) => sum + BigInt(f.amount), 0n),
    deadline: BigInt(ep.deadline),
    approve: { to: tokenIn.address, value: 0n, data: encodeApprove(SWAP_ADAPTER.address, amountIn) },
    swap: { to: SWAP_ADAPTER.address, value: 0n, data },
  };
}

export type SwapStep =
  | { phase: "approve"; step: ExecStep }
  | { phase: "swap"; step: ExecStep };

/**
 * Run a quoted swap: approve, then swap. Both are checked by the guard
 * before EITHER is signed, so a swap the rules would refuse never leaves an
 * approval behind. Returns the swap's hash, or null if anything stopped it.
 */
export async function runSwap(
  mandate: guard.Mandate,
  q: SwapQuote,
  { account, logFile, onStep = () => {} }: { account: PrivateKeyAccount; logFile?: string; onStep?: (s: SwapStep) => void },
): Promise<string | null> {
  const verdict = guard.checkIntent(mandate, decodeIntent(q.swap), { chainId: mandate.chainId, sender: account.address });
  if (!verdict.allowed) {
    // execute() records the refusal in the log, with the guard's reason.
    await execute(mandate, q.swap, { account, logFile, onStep: (step) => onStep({ phase: "swap", step }) });
    return null;
  }

  let approved = false;
  await execute(mandate, q.approve, {
    account,
    logFile,
    receiptTimeoutMs: 60_000,
    onStep: (step) => {
      if (step.step === "confirmed") approved = step.ok;
      onStep({ phase: "approve", step });
    },
  });
  if (!approved) {
    return null;
  }
  return execute(mandate, q.swap, { account, logFile, onStep: (step) => onStep({ phase: "swap", step }) });
}
