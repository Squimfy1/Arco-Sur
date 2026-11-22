/**
 * The statement: Operations as a dated record, for keeping or handing over.
 *
 * Built from the same view every screen reads (view.ts), narrowed by the
 * filters chosen on Operations, with its totals worked out here so the page
 * and every exported file only place them.
 */

import type { ActivityRow, Statement, StatementFilter, View } from "../contract.ts";
import { fromWei, toWei } from "./guard.ts";
import { dayLabel, group, stamp } from "./view.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-20" as "20 Nov 2026". */
const shortDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
};

/** A row's fee in wei, or null when none was paid (a refusal) or it is unknown. */
function feeWei(r: ActivityRow): bigint | null {
  try {
    return toWei(r.fee);
  } catch {
    return null;
  }
}

/** The filters from a page address; anything missing means any. */
export function readFilter(params: URLSearchParams): StatementFilter {
  const text = (k: string) => (params.get(k) ?? "").trim();
  return { day: /^\d{4}-\d{2}-\d{2}$/.test(text("day")) ? text("day") : "", kind: text("kind"), status: text("status") };
}

export function statement(view: View, filter: StatementFilter, now: Date): Statement {
  const rows = view.days
    .flatMap((d) => d.rows)
    .filter((r) => (filter.day === "" || r.day === filter.day) && (filter.kind === "" || r.kind === filter.kind) && (filter.status === "" || r.status === filter.status));

  const fees = rows.reduce((sum, r) => sum + (feeWei(r) ?? 0n), 0n);
  const count = (status: string) => rows.filter((r) => r.status === status).length;

  const narrowing = [
    filter.day === "" ? "" : dayLabel(new Date(`${filter.day}T12:00:00`)),
    filter.kind,
    filter.status,
  ].filter(Boolean);

  const generated = stamp(now);
  return {
    title: "Statement of Operations",
    wallet: view.wallet.address,
    network: view.network,
    generated: `${dayLabel(now)}, ${generated.slice(11, 16)}`,
    covers: narrowing.length === 0 ? "All operations" : narrowing.join(", "),
    summary: [
      { label: "Operations", value: String(rows.length) },
      { label: "Matched", value: String(count("Matched")) },
      { label: "Refused", value: String(count("Refused")) },
      { label: "Fees Paid", value: `${group(fromWei(fees) ?? "0")} USDC` },
    ],
    rows: rows.map((r) => ({
      date: shortDay(r.day),
      time: r.time,
      kind: r.kind,
      detail: r.status === "Refused" || r.icon === "swap" ? r.detail : "",
      amount: r.amount,
      asset: r.asset,
      counterparty: r.toLabel ? r.toLabel.replace(/^./, (c) => c.toUpperCase()) : r.toShort,
      nonce: r.nonce,
      fee: feeWei(r) === null ? "" : r.fee,
      status: r.status,
      tone: r.tone,
      tx: r.txUrl === null ? "" : `${r.txUrl.slice(r.txUrl.lastIndexOf("/") + 1, r.txUrl.lastIndexOf("/") + 9)}…${r.txUrl.slice(-6)}`,
      txUrl: r.txUrl,
    })),
    copyright: `© ${now.getFullYear()} Cathedral`,
    notice: "Independent, non-commercial testnet wallet built on Arc; not affiliated with or endorsed by Circle. Testnet funds have no value.",
    fileDate: generated.slice(0, 10),
  };
}
