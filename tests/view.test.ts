/**
 * Stage 9: the view renders, it never calculates.
 *
 * Three kinds of test:
 *   1. buildView turns readings into the right strings (pure, no network).
 *   2. The template contains no arithmetic and imports no logic.
 *   3. Rendered for real, every number on the page is found in the view
 *      object, so nothing on screen was computed by the template.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "svelte/server";
import { describe, expect, test } from "vitest";

import { EURC, USDC } from "../src/lib/server/contracts.ts";
import { toWei } from "../src/lib/server/guard.ts";
import { walletMandate } from "../src/lib/server/mandate.ts";
import type { Report, Row } from "../src/lib/server/reconcile.ts";
import { type View, type ViewInput, buildView, group } from "../src/lib/server/view.ts";
import Page from "../src/routes/+page.svelte";

const ME = "0xCbEB3dcd3A96843b0324a983658bD31393466486";
const STRANGER = "0x1111111111111111111111111111111111111111";
const HASH = `0x${"ab".repeat(32)}`;

function row(line: number, over: Partial<Row> & { record?: Partial<Row["entry"]["record"]> }): Row {
  const { record, ...rest } = over;
  return {
    entry: {
      line,
      record: { ts: 1795199536.958, from: ME, to: ME, broadcast: true, amount_usdc: "0.1", ...record },
    },
    status: "MATCHED",
    problems: [],
    block: 100n,
    fee: toWei("0.00042"),
    outflow: 0n,
    ...rest,
  };
}

function input(over: Partial<ViewInput> = {}): ViewInput {
  const report: Report = {
    rows: [
      row(1, { record: { nonce: 0, tx_hash: HASH } }),
      row(2, {
        status: "REFUSED",
        block: null,
        fee: null,
        record: { to: STRANGER, broadcast: false, refused_because: "recipient not on the allowlist" },
      }),
      row(3, {
        status: "MATCHED",
        record: {
          kind: "approve",
          asset: "EURC",
          amount: "115792089237316195423570985008687907853269984665640564039457584007913129.639935",
          decimals: 6,
          nonce: 1,
          tx_hash: HASH,
        },
      }),
    ],
    senders: [
      {
        address: ME.toLowerCase(),
        chainNonce: 2,
        gaps: [],
        duplicates: [],
        fees: toWei("0.00084"),
        balance: {
          startBlock: 99n,
          start: toWei("40"),
          end: toWei("39.99916"),
          fees: toWei("0.00084"),
          outflow: 0n,
          unexplained: 0n,
        },
      },
    ],
    orphans: [],
    ok: true,
  };
  return {
    me: ME,
    readAt: new Date(2026, 10, 20, 14, 3, 12),
    block: 73234459n,
    nativeWei: toWei("1234.5"),
    tokens: [
      { contract: USDC, balance: { symbol: "USDC", decimals: 6, raw: 1234500000n, formatted: "1234.5" } },
      { contract: EURC, balance: { symbol: "EURC", decimals: 6, raw: 2500000n, formatted: "2.5" } },
    ],
    report,
    spent: { USDC: "0.9" },
    mandate: walletMandate(ME),
    ...over,
  };
}

describe("buildView", () => {
  test("groups thousands and keeps every decimal", () => {
    expect(group("1234567.0000001")).toBe("1,234,567.0000001");
    expect(group("-1000")).toBe("-1,000");
    expect(group("0.5")).toBe("0.5");
  });

  test("shows native USDC and other tokens, and uses USDC's token view only as a check", () => {
    const v = buildView(input());
    expect(v.holdings.map((h) => [h.asset, h.amount])).toEqual([["USDC", "1,234.5"], ["EURC", "2.5"]]);
    expect(v.holdingsCheck.tone).toBe("ok");
  });

  test("says so when the two views of USDC disagree", () => {
    const v = buildView(input({ nativeWei: toWei("1234.6") }));
    expect(v.holdingsCheck.tone).toBe("bad");
    expect(v.holdingsCheck.text).toContain("1234.6");
  });

  test("mandate usage: used, left and the bar's width come from the server", () => {
    const [usdc, eurc] = buildView(input()).mandate.limits;
    expect(usdc).toMatchObject({ asset: "USDC", perPayment: "1", total: "5", used: "0.9", left: "4.1", usedPercent: "18" });
    expect(eurc).toMatchObject({ asset: "EURC", used: "0", left: "5", usedPercent: "0" });
  });

  test("activity is newest first, with refusals quiet and unbounded amounts named", () => {
    const v = buildView(input());
    expect(v.activity.map((a) => a.line)).toEqual(["3", "2", "1"]);
    const [approve, refused, paid] = v.activity;
    expect(approve).toMatchObject({ kind: "Approval", amount: "unlimited", asset: "EURC" });
    expect(refused).toMatchObject({ status: "Refused", tone: "quiet", fee: "—", txUrl: null, toLabel: "" });
    expect(refused?.detail).toBe("recipient not on the allowlist");
    expect(paid).toMatchObject({ status: "Matched", tone: "ok", fee: "0.00042", detail: "block 100", toLabel: "this wallet" });
    expect(paid?.txUrl).toBe(`https://testnet.arcscan.app/tx/${HASH}`);
  });

  test("the accounting statement balances, and an unexplained amount turns it red", () => {
    const ok = buildView(input()).senders[0]?.accounting;
    expect(ok).toMatchObject({ start: "40", fees: "0.00084", expected: "39.99916", now: "39.99916", unexplained: "0", tone: "ok" });

    const base = input();
    const sender = base.report.senders[0]!;
    const leaked = buildView({
      ...base,
      report: { ...base.report, ok: false, senders: [{ ...sender, balance: { ...sender.balance!, unexplained: -toWei("1") } }] },
    });
    expect(leaked.verdict).toMatchObject({ tone: "bad", label: "Not reconciled" });
    expect(leaked.senders[0]?.accounting).toMatchObject({ unexplained: "-1", tone: "bad" });
    expect(leaked.senders[0]?.accounting?.verdict).toContain("never recorded");
  });

  test("the verdict counts what happened", () => {
    expect(buildView(input()).verdict).toEqual({ tone: "ok", label: "Reconciled", counts: "2 matched · 1 refused · 0 nonce gaps" });
  });
});

// ── the template ─────────────────────────────────────────────────────

const TEMPLATE = readFileSync(join(import.meta.dirname, "..", "src", "routes", "+page.svelte"), "utf8");

/** The markup's {…} expressions, without the script and style blocks. */
function expressions(source: string): string[] {
  const markup = source.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  return [...markup.matchAll(/\{([^{}]*)\}/g)]
    .map((m) => m[1]!.trim())
    .filter((e) => !e.startsWith("/"));   // {/each}, {/if}: block ends, not code
}

test("the template's expressions contain no arithmetic and no formatting", () => {
  const exprs = expressions(TEMPLATE);
  expect(exprs.length).toBeGreaterThan(40);
  // Strings inside an expression may hold any character; judge only the code.
  const code = exprs.map((e) => e.replace(/"[^"]*"/g, '""'));
  const offenders = code.filter((e) =>
    /[+*/%]|(?<![=!<>])-(?![>-])|\bNumber\(|BigInt|parse(Int|Float)|toFixed|toLocale|Intl\.|Math\./.test(e),
  );
  expect(offenders).toEqual([]);
});

test("the checker would catch arithmetic if someone added it", () => {
  // Control for the test above: same rule, on expressions that do sums.
  const bad = ["l.used + 1", "a.fee * 2", "Number(b.now)", "b.start - b.fees"];
  const caught = bad.filter((e) => /[+*/%]|(?<![=!<>])-(?![>-])|\bNumber\(/.test(e));
  expect(caught).toEqual(bad);
});

test("the template imports nothing but its own types", () => {
  const script = TEMPLATE.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "";
  const imports = [...script.matchAll(/^\s*import\s.*$/gm)].map((m) => m[0].trim());
  expect(imports).toEqual(['import type { PageProps } from "./$types";']);
});

// ── the rendered page ────────────────────────────────────────────────

/** Visible text: tags and the head removed. */
function visibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** Numbers on screen that appear nowhere in the view object. */
function untraced(text: string, view: View): string[] {
  const source = JSON.stringify(view);
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0]).filter((n) => !source.includes(n));
}

test("every number on the rendered page traces to a value in the view", () => {
  const view = buildView(input());
  const { body } = render(Page, { props: { data: view } as never });
  const text = visibleText(body);

  // It really rendered the data.
  expect(text).toContain("1,234.5");
  expect(text).toContain("Reconciled");
  expect(text).toContain("39.99916");

  const numbers = [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)];
  expect(numbers.length).toBeGreaterThan(20);
  expect(untraced(text, view)).toEqual([]);
});

test("control: a number the view never contained is reported", () => {
  const view = buildView(input());
  expect(untraced("balance 1,234.5 and 987654.321", view)).toEqual(["987654.321"]);
});
