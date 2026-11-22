// Turning the statement into files to keep: a CSV for spreadsheets, a Word
// document, and the PDF. Each takes the backend's finished statement and
// only lays it out; nothing is worked out here.

import type { Statement } from "../contract.ts";

/** Save `body` as a file through the browser's (or the app's) download. */
export function save(name: string, type: string, body: BlobPart): void {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/** One line per operation, with the statement's header lines above, for Excel or Numbers. */
export function csv(s: Statement): string {
  const head = [
    [s.title],
    ["Wallet", s.wallet],
    ["Network", s.network],
    ["Covers", s.covers],
    ["Generated", s.generated],
    [],
    ["Date", "Time", "Type", "Detail", "Amount", "Asset", "Counterparty", "Nonce", "Fee (USDC)", "Status", "Transaction"],
  ];
  const lines = s.rows.map((r) => [r.date, r.time, r.kind, r.detail, r.amount, r.asset, r.counterparty, r.nonce, r.fee, r.status, r.txUrl ?? ""]);
  const foot = [[], ...s.summary.map((x) => [x.label, x.value]), [], [s.copyright], [s.notice]];
  // A byte-order mark first, so Excel reads the accents and the euro sign.
  return "﻿" + [...head, ...lines, ...foot].map((row) => row.map(cell).join(",")).join("\r\n");
}

/**
 * A Word document: the statement's own markup, in an HTML file Word opens as
 * a document. Word reads plain colours only, taken from theme.css (--doc-*).
 */
export function word(sheet: HTMLElement): string {
  const css = getComputedStyle(document.documentElement);
  const c = (name: string) => css.getPropertyValue(name).trim();
  const style = `
    body { font-family: "Inter Tight", Arial, sans-serif; font-size: 10pt; color: ${c("--doc-ink")}; }
    h1 { font-size: 20pt; font-weight: normal; margin: 12pt 0 4pt; }
    .muted, .meta dt, th { color: ${c("--doc-muted")}; }
    .brand { font-size: 14pt; font-weight: bold; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid ${c("--doc-rule")}; padding: 4pt 6pt; text-align: left; vertical-align: top; }
    th { font-weight: normal; font-size: 8.5pt; }
    .num { text-align: right; }
    [data-tone="ok"] .status { color: ${c("--doc-ok")}; }
    [data-tone="bad"] .status { color: ${c("--doc-bad")}; }
    a { color: ${c("--doc-accent")}; }
    svg { display: none; }
  `;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Statement</title><style>${style}</style></head><body>${sheet.outerHTML}</body></html>`;
}
