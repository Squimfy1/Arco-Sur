/**
 * The Send screen's "Review" button: everything send.ts does BEFORE signing,
 * and nothing after.
 *
 *     1. build the transaction the form describes
 *     2. decode it and ask the guard, exactly as execute() does
 *     3. rehearse it on the node (simulate)
 *
 * It never reads the private key, never signs, never broadcasts and never
 * writes to the evidence log. It answers "would the wallet allow this, and
 * would the chain accept it?", with a quote: the fee, the total and what
 * stays. Sending is then progress.ts, through the same build() and execute().
 *
 * Every figure in the answer is a finished string, like view.ts, so the
 * screen only places it.
 */

import * as arc from "./arc.ts";
import { CIRBTC, EURC, type KnownContract } from "./contracts.ts";
import * as guard from "./guard.ts";
import { decodeIntent, encodeTransfer, type TxRequest } from "./intent.ts";
import { type Reader, tokenInfo } from "./read.ts";
import { type Simulator, simulate } from "./simulate.ts";
import { cut, group } from "./view.ts";
import type { Review, ReviewForm, ReviewStep, SendQuote } from "../contract.ts";

export type { Review, ReviewForm, ReviewStep };

/** The assets the Send screen offers. USDC is native; the rest are tokens. */
const TOKEN_FOR: Record<string, KnownContract> = { EURC, cirBTC: CIRBTC };

export type ReviewContext = {
  me: string;
  mandate: guard.Mandate;
  spent: guard.Spent;
  node?: Simulator & { gasPrice(): Promise<bigint | null> };
  reader?: Reader;
  /** What the wallet holds of an asset, in base units; for the quote's "after". */
  balance?: (asset: string) => Promise<{ units: bigint; decimals: number } | null>;
};

const field = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** The same three fields, sent as JSON by the Send button. */
export function readJson(body: unknown): ReviewForm {
  const o = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return { to: text(o.to), amount: text(o.amount), asset: text(o.asset) || "USDC" };
}

export function readForm(data: FormData): ReviewForm {
  return { to: field(data.get("to")), amount: field(data.get("amount")), asset: field(data.get("asset")) || "USDC" };
}

/** The transaction a form describes, or why it describes none. */
export type Built =
  | { ok: true; tx: TxRequest; decimals: number | undefined; to: string; token: KnownContract | null }
  | { ok: false; label: string; text: string; title: string };

/** Build the transaction the form describes. No guard, no node, beyond reading a token's decimals. */
export async function build(form: ReviewForm, reader?: Reader): Promise<Built> {
  const bad = (label: string, text: string, title = "Not a Valid Payment"): Built => ({ ok: false, label, text, title });
  const to = guard.normalise(form.to);
  if (to === null) {
    return bad("Recipient", form.to === "" ? "no recipient given" : `not an address: ${JSON.stringify(form.to)}`);
  }
  if (form.asset === "USDC") {
    let value: bigint;
    try {
      value = guard.toWei(form.amount);
    } catch {
      return bad("Amount", form.amount === "" ? "no amount given" : `not a USDC amount: ${JSON.stringify(form.amount)}`);
    }
    return { ok: true, tx: { to: to as `0x${string}`, value, data: "0x" }, decimals: undefined, to, token: null };
  }
  const token = TOKEN_FOR[form.asset];
  if (token === undefined) {
    return bad("Asset", `${form.asset} is not an asset this wallet sends`);
  }
  let decimals: number;
  try {
    ({ decimals } = await tokenInfo(token, reader));
  } catch (e) {
    return bad("Token", `could not read ${form.asset}: ${(e as Error).message}`, "Could Not Read the Token");
  }
  let units: bigint;
  try {
    units = guard.toUnits(form.amount, decimals);
  } catch {
    return bad("Amount", form.amount === "" ? "no amount given" : `not a ${form.asset} amount: ${JSON.stringify(form.amount)}`);
  }
  return { ok: true, tx: { to: token.address as `0x${string}`, value: 0n, data: encodeTransfer(to as `0x${string}`, units) }, decimals, to, token };
}

export async function review(form: ReviewForm, ctx: ReviewContext): Promise<Review> {
  const node = ctx.node ?? arc;
  const steps: ReviewStep[] = [];
  const stop = (title: string): Review => ({ tone: "bad", title, steps, form });

  // 1. Build. A form field that is not an address or an amount stops here,
  //    with the guard's own wording where it has one.
  const built = await build(form, ctx.reader);
  if (!built.ok) {
    steps.push({ label: built.label, tone: "bad", text: built.text });
    return stop(built.title);
  }
  const { tx, decimals, to } = built;

  // 2. Decode, then decide: the guard judges what the bytes do, as in execute().
  const intent = decodeIntent(tx);
  const verdict = guard.checkIntent(ctx.mandate, intent, {
    chainId: arc.CHAIN_ID,
    decimals,
    alreadySent: ctx.spent,
    sender: ctx.me,
  });
  if (!verdict.allowed) {
    steps.push({ label: "Mandate", tone: "bad", text: verdict.reason });
    return stop("The Wallet Would Refuse This");
  }
  const self = guard.normalise(ctx.me) === to;
  steps.push({
    label: "Mandate",
    tone: "ok",
    text: `${group(form.amount)} ${form.asset} to ${self ? "this wallet" : to} is within the rules${self ? ", and to itself, so it uses none of the total" : ""}`,
  });

  // 3. Rehearse. A transaction that would revert still costs gas, so it stops here.
  const sim = await simulate(ctx.me, tx, node);
  if (!sim.ok) {
    steps.push({ label: "Rehearsal", tone: "bad", text: `the node says it would fail: ${sim.reason}` });
    return stop("The Chain Would Reject This");
  }
  const price = await node.gasPrice();
  const feeWei = price === null ? null : sim.gas * price;
  const fee = feeWei === null ? "unknown" : `${group(guard.fromWei(feeWei) ?? "?")} USDC`;
  steps.push({ label: "Rehearsal", tone: "ok", text: `the node accepts it: ${sim.gas} gas, fee about ${fee}` });

  return { tone: "ok", title: "Ready to Send", steps, form, quote: await sendQuote(form, ctx, { self, feeWei, fee }) };
}

/** What sending it costs and what it leaves, every figure finished. */
async function sendQuote(
  form: ReviewForm,
  ctx: ReviewContext,
  { self, feeWei, fee }: { self: boolean; feeWei: bigint | null; fee: string },
): Promise<SendQuote> {
  const amount = `${group(form.amount)} ${form.asset}`;
  const total = form.asset === "USDC" && feeWei !== null
    ? `${group(guard.fromWei(guard.toWei(form.amount) + feeWei) ?? "?")} USDC`
    : `${amount} and ${fee}`;
  let after = "unknown";
  const held = ctx.balance === undefined ? null : await ctx.balance(form.asset).catch(() => null);
  if (held !== null && feeWei !== null) {
    if (form.asset === "USDC") {
      const left = held.units - feeWei - (self ? 0n : guard.toWei(form.amount));
      after = `${cut(group(guard.fromWei(left) ?? "?"))} USDC`;
    } else {
      const left = held.units - (self ? 0n : guard.toUnits(form.amount, held.decimals));
      after = `${cut(group(guard.fromUnits(left, held.decimals) ?? "?"))} ${form.asset}, less ${fee} in fees`;
    }
  }
  return { amount, to: self ? "This Wallet" : to(form.to), fee: `about ${fee}`, total, after };
}

const to = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
