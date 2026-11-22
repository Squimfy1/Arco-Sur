/**
 * Sends and swaps from the app, told step by step.
 *
 * The screen asks for a send or a swap and gets back a stream of Progress
 * events (src/lib/contract.ts), each with finished text: the step names,
 * what happened, the explorer link. The work itself is execute() and
 * runSwap(), the same code `npm run send` uses; this file only words it.
 *
 * Every event goes out as it happens, so the window moves with the chain.
 * The work runs to the end even if the window is closed: the evidence log
 * gets its outcome line either way.
 */

import type { PrivateKeyAccount } from "viem/accounts";

import type { Progress, ReviewForm, SwapQuoteView } from "../contract.ts";
import * as arc from "./arc.ts";
import * as guard from "./guard.ts";
import { build } from "./review.ts";
import { type ExecStep, execute } from "./send.ts";
import { SWAP_ASSETS, type SwapQuote, runSwap } from "./swap.ts";
import { tokenBalance } from "./read.ts";
import { CIRBTC, EURC, USDC } from "./contracts.ts";
import { EXPLORER, cut, group } from "./view.ts";

type Emit = (p: Progress) => void;

const txLink = (hash: string) => `${EXPLORER}/tx/${hash}`;
/** A balance, cut to two places for reading. */
const usdc = (wei: bigint) => `${cut(group(guard.fromWei(wei) ?? "0"))} USDC`;
/** A fee, in full: cut to two places it would read 0.00. */
const fee = (wei: bigint) => `${group(guard.fromWei(wei) ?? "0")} USDC`;

/** The guard's verdict as a sentence: "within mandate; to this wallet…" → "Within the rules: to this wallet…". */
const rules = (reason: string) => {
  const rest = reason.replace(/^within mandate;?\s*/, "");
  return rest === "" ? "Within the rules." : `Within the rules: ${rest}.`;
};
const amountOf = (units: bigint, decimals: number) => group(guard.fromUnits(units, decimals) ?? "0");
const TOKENS = { EURC, cirBTC: CIRBTC, USDC } as const;

/** What the wallet holds of `asset` now, read from the chain, as shown. */
async function holding(asset: string, me: string): Promise<string> {
  if (asset === "USDC") {
    const wei = await arc.balanceWei(me);
    return wei === null ? "unknown" : usdc(wei);
  }
  const token = TOKENS[asset as keyof typeof TOKENS];
  if (token === undefined) return "unknown";
  const b = await tokenBalance(token, me);
  return `${cut(group(b.formatted))} ${asset}`;
}

const SEND_STEPS = [
  { id: "checked", label: "Checked Against the Rules" },
  { id: "rehearsed", label: "Rehearsed on the Chain" },
  { id: "broadcast", label: "Broadcast" },
  { id: "confirmed", label: "Confirmed" },
];

/** One transaction's steps, worded. `ids` renames them for a swap's second half. */
function narrate(step: ExecStep, emit: Emit, ids: Record<string, string> = {}): void {
  const id = (s: string) => ids[s] ?? s;
  switch (step.step) {
    case "checked":
      emit({ type: "step", id: id("checked"), detail: rules(step.reason), link: null });
      return;
    case "rehearsed":
      emit({ type: "step", id: id("rehearsed"), detail: `The node accepts it. Fee about ${fee(step.gas * step.price)}.`, link: null });
      return;
    case "broadcast":
      emit({ type: "step", id: id("broadcast"), detail: `Sent to the network with nonce ${step.nonce}.`, link: txLink(step.hash) });
      return;
    case "stopped":
      emit({ type: "fail", id: id(step.at === "funds" ? "rehearsed" : step.at), reason: step.at === "funds" ? `Not enough USDC for the fee: ${step.reason}.` : `${step.reason}.` });
      return;
    case "pending":
      emit({ type: "fail", id: id("confirmed"), reason: `No receipt yet. Do not send again: check the explorer, nonce ${step.nonce}.` });
      return;
    case "confirmed":
      return; // worded by the caller, which knows what it was for
  }
}

/** Send from the app: the form's payment, through execute(). */
export async function sendWithProgress(
  form: ReviewForm,
  ctx: { account: PrivateKeyAccount; mandate: guard.Mandate; logFile?: string },
  emit: Emit,
): Promise<void> {
  const me = ctx.account.address;
  emit({ type: "plan", title: `Sending ${group(form.amount)} ${form.asset}`, steps: SEND_STEPS });
  const built = await build(form);
  if (!built.ok) {
    emit({ type: "fail", id: "checked", reason: `${built.text}.` });
    emit({ type: "done", ok: false, status: "Not Sent", summary: "Nothing was signed.", link: null });
    return;
  }

  let link: string | null = null;
  let outcome: Extract<ExecStep, { step: "confirmed" }> | null = null;
  await execute(ctx.mandate, built.tx, {
    account: ctx.account,
    logFile: ctx.logFile,
    onStep: (step) => {
      if (step.step === "broadcast") link = txLink(step.hash);
      if (step.step === "confirmed") outcome = step;
      narrate(step, emit);
    },
  });

  const done = outcome as Extract<ExecStep, { step: "confirmed" }> | null;
  if (done === null) {
    emit({
      type: "done",
      ok: false,
      status: link === null ? "Not Sent" : "Pending",
      summary: link === null ? "Nothing was signed." : "Broadcast, but not yet confirmed. Do not send it again.",
      link,
    });
    return;
  }
  const now = await holding(form.asset, me);
  const block = done.block === null ? "" : `In block ${group(done.block.toString())}. `;
  emit({
    type: "step",
    id: "confirmed",
    detail: `${block}Fee ${fee(done.fee)}. ${done.ok ? `You now hold ${now}.` : "It reverted: only the fee was spent."}`,
    link,
  });
  emit({
    type: "done",
    ok: done.ok,
    status: done.ok ? "Confirmed" : "Reverted",
    summary: done.ok ? `${group(form.amount)} ${form.asset} arrived. ${done.proof[0]?.toUpperCase()}${done.proof.slice(1)}.` : done.proof,
    link,
  });
}

/** A quote, worded for the Swap screen. */
export function quoteView(q: SwapQuote): SwapQuoteView {
  const into = SWAP_ASSETS[q.request.from]!;
  const out = SWAP_ASSETS[q.request.to]!;
  const pay = amountOf(q.amountIn, into.decimals);
  const receive = amountOf(q.estimatedOut, out.decimals);
  // How much out per one in, from the estimate, cut to 6 places.
  const per = q.amountIn === 0n ? 0n : (q.estimatedOut * 10n ** BigInt(into.decimals) * 10n ** 6n) / (q.amountIn * 10n ** BigInt(out.decimals));
  const minutes = Math.round((Number(q.deadline) - Date.now() / 1000) / 60);
  return {
    from: q.request.from,
    to: q.request.to,
    pay: `${pay} ${q.request.from}`,
    receive: `${receive} ${q.request.to}`,
    estimate: receive,
    atLeast: `${amountOf(q.minOut, out.decimals)} ${q.request.to}`,
    fee: `${amountOf(q.fee, into.decimals)} ${q.request.from} to Circle, plus the network fee in USDC`,
    rate: `1 ${q.request.from} = ${group(guard.fromUnits(per, 6) ?? "0")} ${q.request.to}`,
    expires: minutes > 60 ? "in over an hour" : minutes <= 1 ? "in about a minute" : `in about ${minutes} minutes`,
  };
}

const SWAP_STEPS = [
  { id: "quoted", label: "Quote Locked" },
  { id: "approved", label: "Swap Contract Approved" },
  { id: "broadcast", label: "Swap Broadcast" },
  { id: "received", label: "Received" },
];

/** Swap from the app: approve, then swap, each through execute(). */
export async function swapWithProgress(
  q: SwapQuote,
  ctx: { account: PrivateKeyAccount; mandate: guard.Mandate; logFile?: string },
  emit: Emit,
): Promise<void> {
  const me = ctx.account.address;
  const v = quoteView(q);
  emit({ type: "plan", title: `Swapping ${v.pay} for ${q.request.to}`, steps: SWAP_STEPS });
  emit({ type: "step", id: "quoted", detail: `About ${v.receive}, at least ${v.atLeast}, from Circle's swap service.`, link: null });

  let link: string | null = null;
  let result: Extract<ExecStep, { step: "confirmed" }> | null = null;
  await runSwap(ctx.mandate, q, {
    account: ctx.account,
    logFile: ctx.logFile,
    onStep: ({ phase, step }) => {
      if (phase === "approve") {
        if (step.step === "confirmed") {
          if (step.ok) emit({ type: "step", id: "approved", detail: `Allowed to take exactly ${v.pay}. Fee ${fee(step.fee)}.`, link: txLink(step.hash) });
          else emit({ type: "fail", id: "approved", reason: "The approval reverted; nothing was swapped." });
        } else if (step.step === "stopped" || step.step === "pending") {
          narrate(step, emit, { checked: "approved", rehearsed: "approved", confirmed: "approved" });
        }
        return;
      }
      if (step.step === "broadcast") link = txLink(step.hash);
      if (step.step === "confirmed") result = step;
      if (step.step === "broadcast" || step.step === "stopped" || step.step === "pending") {
        narrate(step, emit, { checked: "broadcast", rehearsed: "broadcast", confirmed: "received" });
      }
    },
  });

  const done = result as Extract<ExecStep, { step: "confirmed" }> | null;
  if (done === null) {
    emit({ type: "done", ok: false, status: link === null ? "Not Swapped" : "Pending", summary: link === null ? "No swap was sent." : "Broadcast, but not yet confirmed.", link });
    return;
  }
  const out = SWAP_ASSETS[q.request.to]!;
  const got = done.received === null ? "nothing" : `${amountOf(done.received, out.decimals)} ${q.request.to}`;
  if (!done.ok) {
    emit({ type: "fail", id: "received", reason: "The swap reverted: only the fee was spent, and the approval is unused." });
    emit({ type: "done", ok: false, status: "Reverted", summary: done.proof, link });
    return;
  }
  const [inNow, outNow] = await Promise.all([holding(q.request.from, me), holding(q.request.to, me)]);
  emit({ type: "step", id: "received", detail: `${got} arrived. You now hold ${inNow} and ${outNow}.`, link });
  emit({ type: "done", ok: true, status: "Swapped", summary: `${v.pay} became ${got}. Fee ${fee(done.fee)}.`, link });
}
