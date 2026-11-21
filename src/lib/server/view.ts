/**
 * Turn what the chain and the log say into what the page shows.
 *
 * The page renders, it never calculates. Every amount, count, date and
 * percentage is decided here, on the server, as a finished string. The
 * template only places them. That keeps the money arithmetic in one tested
 * place (bigint, never floating point) and lets a test check that every
 * number on screen came from this object.
 *
 * It produces data only: words, amounts and meanings ("ok", "out"), typed by
 * src/lib/contract.ts. No colour, size, class name or coordinate is decided
 * here; how any of it looks belongs to the frontend (src/lib/ui).
 *
 * buildView is pure: give it the readings, get the view. load() in
 * src/routes/+layout.server.ts does the reading.
 */

import type { Accounting, ActivityRow, Day, History, Holding, Limit, SenderView, Tone, View } from "../contract.ts";
import { CHAIN_ID } from "./arc.ts";
import type { KnownContract } from "./contracts.ts";
import { ARC_USDC_TOKEN, type Mandate, type Spent, fromUnits, fromWei, normalise, toUnits } from "./guard.ts";
import type { TokenBalance } from "./read.ts";
import { type Report, type Row, type Status, claimed } from "./reconcile.ts";

export const EXPLORER = "https://testnet.arcscan.app";
/** Circle's testnet faucet: where test USDC and EURC come from. */
export const FAUCET = "https://faucet.circle.com";

export type {
  Accounting, ActivityRow, Day, History, Holding, Limit, SenderView, Tone, View,
} from "../contract.ts";
export type ViewInput = {
  me: string;
  readAt: Date;
  block: bigint | null;
  nativeWei: bigint | null;
  tokens: readonly { contract: KnownContract; balance: TokenBalance }[];
  report: Report;
  spent: Spent;
  mandate: Mandate;
  /** Native balance at some blocks, for the chart. Optional: no chart without it. */
  history?: readonly { block: bigint; wei: bigint }[];
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const unknown = "—";

/** A local date and time, to the second: 2026-11-20 14:03:12. */
export function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/**
 * "1,234.56789" → "1,234.56": at most two decimals, cut and never rounded
 * up, so a short figure never shows more than is there. "—" stays "—".
 */
export function cut(grouped: string): string {
  const [whole = grouped, frac] = grouped.split(".");
  return frac === undefined ? whole : `${whole}.${frac.slice(0, 2).padEnd(2, "0")}`;
}

/** 1234567.5 → "1,234,567.5": thousands grouped, every decimal kept. */
export function group(amount: string): string {
  const [whole = "", frac] = amount.split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = sign ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sign + grouped + (frac === undefined ? "" : `.${frac}`);
}

const STATUS: Record<Status, { label: string; tone: Tone }> = {
  MATCHED: { label: "Matched", tone: "ok" },
  REFUSED: { label: "Refused", tone: "quiet" },
  PENDING: { label: "Pending", tone: "warn" },
  DIVERGENT: { label: "Divergent", tone: "bad" },
  MISSING: { label: "Missing", tone: "bad" },
  REVERTED: { label: "Reverted", tone: "bad" },
};

const KIND: Record<string, string> = {
  native: "Payment",
  transfer: "Token transfer",
  approve: "Approval",
  unknown: "Unknown call",
};

const NAMES: Record<string, { name: string; badge: string }> = {
  USDC: { name: "US Dollar Coin", badge: "$" },
  EURC: { name: "Euro Coin", badge: "€" },
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

/** "Friday 20 November 2026": a heading for one day of operations. */
export function dayLabel(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function activity(row: Row, me: string): ActivityRow {
  const r = row.entry.record;
  const when = new Date(r.ts * 1000);
  const fromMe = normalise(r.from) === normalise(me);
  const toMe = normalise(r.to) === normalise(me);
  const icon: ActivityRow["icon"] =
    row.status === "REFUSED" ? "refused"
    : r.kind === "approve" ? "approve"
    : fromMe && toMe ? "self"
    : fromMe ? "out"
    : "in";
  const { amount, asset } = claimed(r);
  const to = r.to;
  let detail = "";
  if (row.status === "REFUSED") {
    detail = r.refused_because ?? "no reason logged";
  } else if (row.block !== null) {
    detail = `block ${row.block}`;
  } else if (row.status === "PENDING") {
    detail = "sent, not yet mined";
  }
  return {
    line: String(row.entry.line),
    when: stamp(when),
    nonce: r.nonce === undefined ? unknown : String(r.nonce),
    status: STATUS[row.status].label,
    tone: STATUS[row.status].tone,
    kind: KIND[r.kind ?? "native"] ?? "Unknown call",
    // A refused unbounded approval logs a 78-digit amount; it reads as "unlimited".
    amount: amount.length > 24 ? "unlimited" : group(amount),
    asset,
    to,
    toShort: short(to),
    toLabel: normalise(to) === normalise(me) ? "this wallet" : "",
    fee: row.fee === null ? unknown : `${fromWei(row.fee)}`,
    detail,
    txUrl: r.tx_hash === undefined ? null : `${EXPLORER}/tx/${r.tx_hash}`,
    problems: row.problems,
    icon,
    day: stamp(when).slice(0, 10),
    time: stamp(when).slice(11),
  };
}

/** Group operations (already newest first) under one heading per day. */
function byDay(rows: readonly { row: ActivityRow; at: Date }[]): Day[] {
  const days: Day[] = [];
  for (const { row, at } of rows) {
    const last = days.at(-1);
    if (last !== undefined && last.rows[0]?.day === row.day) {
      last.rows.push(row);
    } else {
      days.push({ label: dayLabel(at), rows: [row] });
    }
  }
  return days;
}

/**
 * The balance history: each point's place as a fraction (0..1) of the block
 * span and of the balance range. The money math stays here in bigint; the
 * frontend decides how big the chart is and how it is drawn.
 */
export function history(points: readonly { block: bigint; wei: bigint }[]): History | null {
  const sorted = [...new Map(points.map((p) => [p.block, p])).values()].sort((a, b) =>
    a.block < b.block ? -1 : a.block > b.block ? 1 : 0,
  );
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first === undefined || last === undefined || first.block === last.block) return null;

  let lo = first.wei;
  let hi = first.wei;
  for (const p of sorted) {
    if (p.wei < lo) lo = p.wei;
    if (p.wei > hi) hi = p.wei;
  }
  const span = last.block - first.block;
  const range = hi - lo;
  // Fractions to 4 places, worked out in bigint; a flat balance sits at 0.5.
  const frac = (part: bigint, whole: bigint) => Number((part * 10_000n) / whole) / 10_000;
  return {
    points: sorted.map((p) => ({
      x: frac(p.block - first.block, span),
      y: range === 0n ? 0.5 : frac(p.wei - lo, range),
      block: String(p.block),
      balance: group(fromWei(p.wei) ?? unknown),
    })),
    high: group(fromWei(hi) ?? unknown),
    low: group(fromWei(lo) ?? unknown),
    from: `block ${first.block}`,
    to: `block ${last.block}`,
  };
}

function limit(asset: string, perPayment: string, total: string, used: string, decimals: number): Limit {
  const totalUnits = toUnits(total, decimals);
  const usedUnits = toUnits(used, decimals);
  const leftUnits = totalUnits > usedUnits ? totalUnits - usedUnits : 0n;
  const pct = totalUnits === 0n ? 0n : (usedUnits * 100n) / totalUnits;
  return {
    asset,
    badge: NAMES[asset]?.badge ?? asset.slice(0, 1),
    perPayment: group(perPayment),
    total: group(total),
    used: group(fromUnits(usedUnits, decimals) ?? "0"),
    left: group(fromUnits(leftUnits, decimals) ?? "0"),
    usedPercent: String(pct > 100n ? 100n : pct),
  };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function buildView(input: ViewInput): View {
  const { me, report, mandate, spent } = input;

  // Holdings: native USDC (what pays gas), then every token except USDC's
  // own ERC-20 view, which is the same money and is used only as a check.
  const nativeAmount = input.nativeWei === null ? unknown : group(fromWei(input.nativeWei) ?? unknown);
  const holdings: Holding[] = [
    {
      asset: "USDC",
      ...NAMES["USDC"]!,
      amount: nativeAmount,
      short: cut(nativeAmount),
      decimals: "18",
      source: "native balance, pays gas",
    },
  ];
  let usdcView: bigint | null = null;
  for (const { contract, balance } of input.tokens) {
    if (normalise(contract.address) === ARC_USDC_TOKEN) {
      usdcView = balance.raw;
      continue;
    }
    holdings.push({
      asset: balance.symbol,
      ...(NAMES[balance.symbol] ?? { name: balance.symbol, badge: balance.symbol.slice(0, 1) }),
      amount: group(balance.formatted),
      short: cut(group(balance.formatted)),
      decimals: String(balance.decimals),
      source: `token ${short(contract.address)}`,
    });
  }

  let holdingsCheck: View["holdingsCheck"];
  if (input.nativeWei === null || usdcView === null) {
    holdingsCheck = { tone: "warn", text: "USDC's token view was not read, so the two views were not compared." };
  } else if (input.nativeWei / 10n ** 12n === usdcView) {
    holdingsCheck = { tone: "ok", text: "USDC's token view at 0x3600…0000 agrees with the native balance to 6 decimals." };
  } else {
    holdingsCheck = {
      tone: "bad",
      text: `USDC's token view says ${fromUnits(usdcView, 6)}, the native balance says ${fromWei(input.nativeWei)}. They should agree.`,
    };
  }

  const limits: Limit[] = [
    limit("USDC", mandate.maxAmountUsdc, mandate.maxTotalUsdc, spent["USDC"] ?? "0", 18),
    ...mandate.tokens.map((t) => limit(t.symbol, t.maxAmount, t.maxTotal, spent[t.symbol] ?? "0", t.decimals)),
  ];

  const count = (s: Status) => report.rows.filter((r) => r.status === s).length;
  const gaps = report.senders.reduce((n, s) => n + s.gaps.length, 0);
  const counted: string[] = [];
  for (const s of ["MATCHED", "REFUSED", "PENDING", "DIVERGENT", "MISSING", "REVERTED"] as const) {
    const n = count(s);
    if (n > 0 || s === "MATCHED") counted.push(`${n} ${STATUS[s].label.toLowerCase()}`);
  }
  counted.push(plural(gaps, "nonce gap"));

  const senders: SenderView[] = report.senders.map((s) => {
    const b = s.balance;
    let accounting: Accounting | null = null;
    if (b !== null) {
      const ok = b.unexplained === 0n;
      accounting = {
        address: s.address,
        startBlock: String(b.startBlock),
        start: group(fromWei(b.start) ?? unknown),
        fees: group(fromWei(b.fees) ?? unknown),
        outflow: group(fromWei(b.outflow) ?? unknown),
        expected: group(fromWei(b.start - b.fees - b.outflow) ?? unknown),
        now: group(fromWei(b.end) ?? unknown),
        unexplained: group(fromWei(b.unexplained) ?? unknown),
        tone: ok ? "ok" : "bad",
        verdict: ok
          ? "Every USDC of change is accounted for."
          : b.unexplained > 0n
            ? "More arrived than the log explains: a deposit, or a refund."
            : "More left than the log explains: a send or fee it never recorded.",
      };
    }
    const mine = normalise(s.address) === normalise(me);
    return {
      address: s.address,
      label: mine ? `${me} (this wallet)` : s.address,
      chainNonce: String(s.chainNonce),
      gaps: s.gaps.length === 0 ? "none" : s.gaps.join(", "),
      gapsTone: s.gaps.length === 0 ? "ok" : "bad",
      duplicates: s.duplicates.join(", "),
      feesPaid: group(fromWei(s.fees) ?? unknown),
      accounting,
    };
  });

  const rows = report.rows.map((r) => ({ row: activity(r, me), at: new Date(r.entry.record.ts * 1000) })).reverse();
  const native = holdings[0]!.amount;
  const [whole = native, fraction] = native.split(".");
  const fees = report.senders.reduce((n, s) => n + s.fees, 0n);

  return {
    readAt: stamp(input.readAt),
    network: `Arc testnet · chain ${CHAIN_ID}`,
    block: input.block === null ? unknown : String(input.block),
    wallet: { address: me, short: short(me), url: `${EXPLORER}/address/${me}` },
    verdict: {
      tone: report.ok ? "ok" : "bad",
      label: report.ok ? "Reconciled" : "Not reconciled",
      counts: counted.join(" · "),
    },
    total: {
      whole,
      fraction: fraction === undefined ? "" : `.${fraction}`,
      // Cut, not rounded: the big number never shows more than is there.
      short: cut(native),
      asset: "USDC",
    },
    history: input.history === undefined ? null : history(input.history),
    holdings,
    holdingsCheck,
    mandate: {
      recipients: mandate.allowedRecipients.map((a) => ({
        address: a,
        label: normalise(a) === normalise(me) ? "this wallet" : "",
      })),
      spenders: mandate.allowedSpenders.length === 0 ? "No one. Every approval is refused." : mandate.allowedSpenders.join(", "),
      limits,
    },
    // Newest first: the question on opening the page is "what just happened".
    activity: rows.map((r) => r.row),
    days: byDay(rows),
    stats: {
      operations: String(report.rows.length),
      matched: String(count("MATCHED")),
      refused: String(count("REFUSED")),
      feesPaid: group(fromWei(fees) ?? unknown),
    },
    senders,
    links: { faucet: FAUCET, explorer: `${EXPLORER}/address/${me}` },
    orphans: report.orphans.map(
      (o) => `Line ${o.line} records an outcome for ${short(o.record.tx_hash)}, a transaction no line records sending.`,
    ),
  };
}
