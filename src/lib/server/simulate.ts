/**
 * Rehearse a transaction on the node before signing it.
 *
 * eth_call runs the whole transaction (from, to, value, data) against the
 * latest state and throws the result away; eth_estimateGas does the same and
 * reports the gas. Neither costs anything or needs a signature. If either
 * reverts, the real transaction would revert too, and would still burn gas,
 * so the send stops here and the chain's own reason goes in the log.
 *
 * What simulation cannot promise: the state can change between the rehearsal
 * and the real transaction landing (another transaction moves first). It
 * catches "this cannot work", not "this will certainly work".
 */

import * as arc from "./arc.ts";

export type TxShape = Readonly<{ to: string; value: bigint; data: `0x${string}` }>;

export type Simulation = { ok: true; gas: bigint } | { ok: false; reason: string };

/** The two rehearsals simulate needs. arc.ts runs them live. */
export type Simulator = {
  simulateCall(from: string, tx: TxShape): Promise<`0x${string}`>;
  estimateGas(from: string, tx: TxShape): Promise<bigint>;
};

// 21000 is the fixed cost of a plain value transfer. A contract call costs
// more and varies, so it is estimated, plus a 20% margin.
const NATIVE_GAS = 21000n;
const MARGIN_PERCENT = 120n;

/** A node refusal becomes a reason; anything else (network down) is rethrown. */
async function rehearse<T>(step: () => Promise<T>): Promise<{ value: T } | { reason: string }> {
  try {
    return { value: await step() };
  } catch (e) {
    if (e instanceof arc.RpcError) {
      return { reason: e.reason };
    }
    throw e;
  }
}

export async function simulate(from: string, tx: TxShape, node: Simulator = arc): Promise<Simulation> {
  const call = await rehearse(() => node.simulateCall(from, tx));
  if ("reason" in call) {
    return { ok: false, reason: call.reason };
  }

  if (tx.data === "0x") {
    return { ok: true, gas: NATIVE_GAS };
  }

  // A token transfer or approval returns a bool. A standard token reverts on
  // failure, but some return false instead, which is just as much a failure.
  // One that returns nothing at all cannot be confirmed, so it is refused.
  if (call.value === "0x") {
    return { ok: false, reason: "the token call returned nothing; cannot confirm it would succeed" };
  }
  if (BigInt(call.value) !== 1n) {
    return { ok: false, reason: "the token call returned false" };
  }

  const gas = await rehearse(() => node.estimateGas(from, tx));
  if ("reason" in gas) {
    return { ok: false, reason: gas.reason };
  }
  return { ok: true, gas: (gas.value * MARGIN_PERCENT) / 100n };
}
