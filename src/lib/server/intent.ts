/**
 * What a transaction actually does, decoded from its bytes.
 *
 * A transaction is three things: `to`, `value` and `data`. A plain USDC
 * payment has empty data and the amount in `value`. A token transfer has
 * `value` 0, `to` is the TOKEN contract, and the real recipient and amount
 * are inside `data`. The guard must judge the decoded call, so every
 * transaction goes through decodeIntent before it goes near the guard.
 *
 * A call to Circle's swap contract decodes to "swap": what goes in, what
 * should come out, and every address the contract would pay.
 *
 * Anything that is not a plain payment, a token transfer, a token approval
 * or a swap decodes to "unknown", and the guard refuses unknown. Default deny.
 */

import { decodeFunctionData, encodeFunctionData, erc20Abi } from "viem";

import { SWAP_ADAPTER } from "./contracts.ts";
import type { Intent } from "./guard.ts";

const ZERO = "0x0000000000000000000000000000000000000000";

/** The three fields of a transaction that decide what it does. */
export type TxRequest = Readonly<{ to: `0x${string}`; value: bigint; data: `0x${string}` }>;

export function decodeIntent(tx: TxRequest): Intent {
  if (tx.data === "0x") {
    return { kind: "native", to: tx.to, amount: tx.value };
  }
  if (tx.value !== 0n) {
    return { kind: "unknown", reason: "sends native USDC and calls a contract in one transaction" };
  }

  if (tx.to.toLowerCase() === SWAP_ADAPTER.address.toLowerCase()) {
    return decodeSwap(tx);
  }

  let decoded;
  try {
    decoded = decodeFunctionData({ abi: erc20Abi, data: tx.data });
  } catch {
    return { kind: "unknown", reason: `calldata ${tx.data.slice(0, 10)}… is not a token function` };
  }

  switch (decoded.functionName) {
    case "transfer": {
      const [to, amount] = decoded.args;
      return { kind: "transfer", token: tx.to, to, amount };
    }
    case "approve": {
      const [spender, amount] = decoded.args;
      return { kind: "approve", token: tx.to, spender, amount };
    }
    default:
      return { kind: "unknown", reason: `${decoded.functionName} is not a payment this guard checks` };
  }
}

/**
 * Circle's swap call. The input is what tokenInputs says the contract takes;
 * the output is the last instruction's token, with its minimum; and every
 * token entry names who it is paid to.
 */
function decodeSwap(tx: TxRequest): Intent {
  let args;
  try {
    ({ args } = decodeFunctionData({ abi: SWAP_ADAPTER.abi, data: tx.data }));
  } catch {
    return { kind: "unknown", reason: `calldata ${tx.data.slice(0, 10)}… is not a swap this guard reads` };
  }
  const [params, inputs] = args;
  const input = inputs[0];
  if (inputs.length !== 1 || input === undefined) {
    return { kind: "unknown", reason: `a swap taking ${inputs.length} tokens; this guard reads one` };
  }
  const outputs = params.instructions.filter((i) => i.tokenOut.toLowerCase() !== ZERO);
  const last = outputs[outputs.length - 1];
  if (last === undefined) {
    return { kind: "unknown", reason: "a swap with no output token" };
  }
  return {
    kind: "swap",
    via: tx.to,
    tokenIn: input.token,
    amountIn: input.amount,
    tokenOut: last.tokenOut,
    minOut: last.minTokenOut,
    beneficiaries: params.tokens.map((t) => t.beneficiary),
  };
}

export function encodeTransfer(to: `0x${string}`, amount: bigint): `0x${string}` {
  return encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amount] });
}

export function encodeApprove(spender: `0x${string}`, amount: bigint): `0x${string}` {
  return encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}
