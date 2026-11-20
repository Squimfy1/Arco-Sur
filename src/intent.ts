/**
 * What a transaction actually does, decoded from its bytes.
 *
 * A transaction is three things: `to`, `value` and `data`. A plain USDC
 * payment has empty data and the amount in `value`. A token transfer has
 * `value` 0, `to` is the TOKEN contract, and the real recipient and amount
 * are inside `data`. The guard must judge the decoded call, so every
 * transaction goes through decodeIntent before it goes near the guard.
 *
 * Anything that is not a plain payment, a token transfer or a token approval
 * decodes to "unknown", and the guard refuses unknown. Default deny.
 */

import { decodeFunctionData, encodeFunctionData, erc20Abi } from "viem";

import type { Intent } from "./guard.ts";

/** The three fields of a transaction that decide what it does. */
export type TxRequest = Readonly<{ to: `0x${string}`; value: bigint; data: `0x${string}` }>;

export function decodeIntent(tx: TxRequest): Intent {
  if (tx.data === "0x") {
    return { kind: "native", to: tx.to, amount: tx.value };
  }
  if (tx.value !== 0n) {
    return { kind: "unknown", reason: "sends native USDC and calls a contract in one transaction" };
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

export function encodeTransfer(to: `0x${string}`, amount: bigint): `0x${string}` {
  return encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amount] });
}

export function encodeApprove(spender: `0x${string}`, amount: bigint): `0x${string}` {
  return encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}
