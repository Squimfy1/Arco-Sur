/**
 * Stage 9: turn what the chain and the log say into what the page shows.
 *
 * The page renders, it never calculates. Every amount, count, date and
 * percentage is decided here, on the server, as a finished string. The
 * template only places them. That keeps the money arithmetic in one tested
 * place (bigint, never floating point) and lets a test check that every
 * number on screen came from this object.
 *
 * buildView is pure: give it the readings, get the view. load() in
 * src/routes/+page.server.ts does the reading.
 */

import { CHAIN_ID } from "./arc.ts";
import type { KnownContract } from "./contracts.ts";
import { ARC_USDC_TOKEN, type Mandate, type Spent, fromUnits, fromWei, normalise, toUnits } from "./guard.ts";
import type { TokenBalance } from "./read.ts";
import { type Report, type Row, type Status, claimed } from "./reconcile.ts";

export const EXPLORER = "https://testnet.arcscan.app";

/** How a value should read: fine, needs a look, wrong, or simply recorded. */
export type Tone = "ok" | "warn" | "bad" | "quiet";

export type Holding = { asset: string; amount: string; decimals: string; source: string };

export type Limit = {
  asset: string;
  perPayment: string;
  total: string;
  used: string;
  left: string;
  usedPercent: string;   // "0".."100", for the bar's width only
};

export type ActivityRow = {
  line: string;
  when: string;
  nonce: string;
  status: string;
  tone: Tone;
  kind: string;
  amount: string;
  asset: string;
  to: string;
  toShort: string;
  toLabel: string;        // "this wallet", or ""
  fee: string;
  detail: string;
  txUrl: string | null;
  problems: string[];
};

export type Accounting = {
  address: string;
  startBlock: string;
  start: string;
  fees: string;
  outflow: string;
  expected: string;
  now: string;
  unexplained: string;
  tone: Tone;
  verdict: string;
};

export type SenderView = {
  address: string;
  label: string;          // checksummed, with "this wallet" when it is
  chainNonce: string;
  gaps: string;
  gapsTone: Tone;
  duplicates: string;
  feesPaid: string;
  accounting: Accounting | null;
};

export type View = {
  readAt: string;
  network: string;
  block: string;
  wallet: { address: string; short: string; url: string };
  verdict: { tone: Tone; label: string; counts: string };
  holdings: Holding[];
  holdingsCheck: { tone: Tone; text: string };
  mandate: { recipients: string[]; spenders: string; limits: Limit[] };
  activity: ActivityRow[];
  senders: SenderView[];
  orphans: string[];
};

export type ViewInput = {
  me: string;
  readAt: Date;
  block: bigint | null;
  nativeWei: bigint | null;
  tokens: readonly { contract: KnownContract; balance: TokenBalance }[];
  report: Report;
  spent: Spent;
  mandate: Mandate;
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

function activity(row: Row, me: string): ActivityRow {
  const r = row.entry.record;
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
    when: stamp(new Date(r.ts * 1000)),
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
  };
}

function limit(asset: string, perPayment: string, total: string, used: string, decimals: number): Limit {
  const totalUnits = toUnits(total, decimals);
  const usedUnits = toUnits(used, decimals);
  const leftUnits = totalUnits > usedUnits ? totalUnits - usedUnits : 0n;
  const pct = totalUnits === 0n ? 0n : (usedUnits * 100n) / totalUnits;
  return {
    asset,
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
  const holdings: Holding[] = [
    {
      asset: "USDC",
      amount: input.nativeWei === null ? unknown : group(fromWei(input.nativeWei) ?? unknown),
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
      amount: group(balance.formatted),
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
    holdings,
    holdingsCheck,
    mandate: {
      recipients: mandate.allowedRecipients.map((a) => (normalise(a) === normalise(me) ? `${a} (this wallet)` : a)),
      spenders: mandate.allowedSpenders.length === 0 ? "No one. Every approval is refused." : mandate.allowedSpenders.join(", "),
      limits,
    },
    // Newest first: the question on opening the page is "what just happened".
    activity: report.rows.map((r) => activity(r, me)).reverse(),
    senders,
    orphans: report.orphans.map(
      (o) => `Line ${o.line} records an outcome for ${short(o.record.tx_hash)}, a transaction no line records sending.`,
    ),
  };
}
