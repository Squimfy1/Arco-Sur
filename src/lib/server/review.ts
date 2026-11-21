/**
 * The Send screen's "Review" button: everything send.ts does BEFORE signing,
 * and nothing after.
 *
 *     1. build the transaction the form describes
 *     2. decode it and ask the guard, exactly as execute() does
 *     3. rehearse it on the node (simulate)
 *
 * It never reads the private key, never signs, never broadcasts and never
 * writes to the evidence log. Signing from the app is Stage 10; until then
 * this answers "would the wallet allow this, and would the chain accept it?"
 *
 * Every figure in the answer is a finished string, like view.ts, so the
 * screen only places it.
 */

import * as arc from "./arc.ts";
import { EURC, type KnownContract } from "./contracts.ts";
import * as guard from "./guard.ts";
import { decodeIntent, encodeTransfer, type TxRequest } from "./intent.ts";
import { type Reader, tokenInfo } from "./read.ts";
import { type Simulator, simulate } from "./simulate.ts";
import { group } from "./view.ts";
import type { Review, ReviewForm, ReviewStep } from "../contract.ts";

export type { Review, ReviewForm, ReviewStep };

/** The assets the Send screen offers. USDC is native; the rest are tokens. */
const TOKEN_FOR: Record<string, KnownContract> = { EURC };

export type ReviewContext = {
  me: string;
  mandate: guard.Mandate;
  spent: guard.Spent;
  node?: Simulator & { gasPrice(): Promise<bigint | null> };
  reader?: Reader;
};

const field = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export function readForm(data: FormData): ReviewForm {
  return { to: field(data.get("to")), amount: field(data.get("amount")), asset: field(data.get("asset")) || "USDC" };
}

export async function review(form: ReviewForm, ctx: ReviewContext): Promise<Review> {
  const node = ctx.node ?? arc;
  const steps: ReviewStep[] = [];
  const stop = (title: string): Review => ({ tone: "bad", title, steps, form });

  // 1. Build. A form field that is not an address or an amount stops here,
  //    with the guard's own wording where it has one.
  const to = guard.normalise(form.to);
  if (to === null) {
    steps.push({ label: "Recipient", tone: "bad", text: `not an address: ${JSON.stringify(form.to)}` });
    return stop("Not a valid payment");
  }

  let tx: TxRequest;
  let decimals: number | undefined;
  if (form.asset === "USDC") {
    let value: bigint;
    try {
      value = guard.toWei(form.amount);
    } catch {
      steps.push({ label: "Amount", tone: "bad", text: `not a USDC amount: ${JSON.stringify(form.amount)}` });
      return stop("Not a valid payment");
    }
    tx = { to: to as `0x${string}`, value, data: "0x" };
  } else {
    const token = TOKEN_FOR[form.asset];
    if (token === undefined) {
      steps.push({ label: "Asset", tone: "bad", text: `${form.asset} is not an asset this wallet sends` });
      return stop("Not a valid payment");
    }
    try {
      ({ decimals } = await tokenInfo(token, ctx.reader));
    } catch (e) {
      steps.push({ label: "Token", tone: "bad", text: `could not read ${form.asset}: ${(e as Error).message}` });
      return stop("Could not read the token");
    }
    let units: bigint;
    try {
      units = guard.toUnits(form.amount, decimals);
    } catch {
      steps.push({ label: "Amount", tone: "bad", text: `not a ${form.asset} amount: ${JSON.stringify(form.amount)}` });
      return stop("Not a valid payment");
    }
    tx = { to: token.address as `0x${string}`, value: 0n, data: encodeTransfer(to as `0x${string}`, units) };
  }

  // 2. Decode, then decide: the guard judges what the bytes do, as in execute().
  const intent = decodeIntent(tx);
  const verdict = guard.checkIntent(ctx.mandate, intent, {
    chainId: arc.CHAIN_ID,
    decimals,
    alreadySent: ctx.spent,
  });
  if (!verdict.allowed) {
    steps.push({ label: "Mandate", tone: "bad", text: verdict.reason });
    return stop("The wallet would refuse this");
  }
  steps.push({ label: "Mandate", tone: "ok", text: `${group(form.amount)} ${form.asset} to ${to} is within the rules` });

  // 3. Rehearse. A transaction that would revert still costs gas, so it stops here.
  const sim = await simulate(ctx.me, tx, node);
  if (!sim.ok) {
    steps.push({ label: "Rehearsal", tone: "bad", text: `the node says it would fail: ${sim.reason}` });
    return stop("The chain would reject this");
  }
  const price = await node.gasPrice();
  const fee = price === null ? "unknown" : `about ${group(guard.fromWei(sim.gas * price) ?? "?")} USDC`;
  steps.push({ label: "Rehearsal", tone: "ok", text: `the node accepts it: ${sim.gas} gas, fee ${fee}` });

  return { tone: "ok", title: "Ready to sign", steps, form };
}
