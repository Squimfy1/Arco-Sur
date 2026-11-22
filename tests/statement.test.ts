/**
 * The statement: Operations narrowed by the filters, with its totals worked
 * out in the backend, and the CSV laid out from it.
 */

import { expect, test } from "vitest";

import type { ActivityRow, View } from "../src/lib/contract.ts";
import { readFilter, statement } from "../src/lib/server/statement.ts";
import { csv } from "../src/lib/ui/export.ts";

const row = (over: Partial<ActivityRow>): ActivityRow => ({
  line: "1", when: "", day: "2026-11-21", time: "18:32:04", nonce: "12", status: "Matched", tone: "ok",
  kind: "Payment", icon: "self", amount: "0.1", asset: "USDC", to: "0xabc", toShort: "0xabc…", toLabel: "this wallet",
  fee: "0.000525", detail: "block 1", txUrl: "https://testnet.arcscan.app/tx/0x5ac60d1234567890c51623", problems: [], ...over,
});

const view = {
  wallet: { address: "0xCbEB3dcd3A96843b0324a983658bD31393466486" },
  network: "Arc testnet, chain 5042002",
  days: [
    { label: "Saturday 21 November 2026", rows: [row({}), row({ line: "2", kind: "Swap", icon: "refused", status: "Refused", tone: "quiet", fee: "—", nonce: "—", detail: "swap of 2 USDC exceeds the per-payment limit 1", txUrl: null })] },
    { label: "Friday 20 November 2026", rows: [row({ line: "3", day: "2026-11-20", fee: "0.00042" })] },
  ],
} as unknown as View;

const NOW = new Date(2026, 10, 21, 18, 56);

test("every operation, with the counts and the fees paid added up", () => {
  const s = statement(view, readFilter(new URLSearchParams()), NOW);
  expect(s.covers).toBe("All operations");
  expect(s.summary).toEqual([
    { label: "Operations", value: "3" },
    { label: "Matched", value: "2" },
    { label: "Refused", value: "1" },
    { label: "Fees Paid", value: "0.000945 USDC" },
  ]);
  expect(s.rows[0]).toMatchObject({ date: "21 Nov 2026", counterparty: "This wallet", fee: "0.000525", tx: "0x5ac60d…c51623" });
  // A refusal paid nothing and has no transaction; its reason stays.
  expect(s.rows[1]).toMatchObject({ fee: "", tx: "", txUrl: null, detail: "swap of 2 USDC exceeds the per-payment limit 1" });
  expect(s).toMatchObject({ copyright: "© 2026 Cathedral", fileDate: "2026-11-21", generated: "Saturday 21 November 2026, 18:56" });
});

test("the filters narrow it, and say so", () => {
  const s = statement(view, readFilter(new URLSearchParams({ day: "2026-11-21", status: "Matched" })), NOW);
  expect(s.rows).toHaveLength(1);
  expect(s.covers).toBe("Saturday 21 November 2026, Matched");
  expect(readFilter(new URLSearchParams({ day: "yesterday" })).day).toBe("");
});

test("the CSV has the header lines, one line per operation, and quotes what needs it", () => {
  const text = csv(statement(view, readFilter(new URLSearchParams()), NOW));
  expect(text.startsWith("﻿Statement of Operations")).toBe(true);
  expect(text).toContain("Date,Time,Type,Detail,Amount,Asset,Counterparty,Nonce,Fee (USDC),Status,Transaction");
  expect(text).toContain('"Arc testnet, chain 5042002"');
  expect(text).toContain("21 Nov 2026,18:32:04,Payment,,0.1,USDC,This wallet,12,0.000525,Matched,https://testnet.arcscan.app/tx/");
  expect(text).toContain("Fees Paid,0.000945 USDC");
});
