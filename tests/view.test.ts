/**
 * The screens render, they never calculate.
 *
 * Three kinds of test:
 *   1. buildView turns readings into the right data (pure, no network).
 *   2. No template contains arithmetic.
 *   3. Every screen, rendered for real: every number on it is found in the
 *      data the backend sent, so nothing on screen was computed by the look.
 *
 * tests/decoupling.test.ts checks the other rule: the look and the backend
 * never reach into each other.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { createRawSnippet } from "svelte";
import { render } from "svelte/server";
import { describe, expect, test, vi } from "vitest";

// The frame highlights the screen you are on, from SvelteKit's page state,
// which only exists inside a running app. Here it says: the portfolio.
vi.mock("$app/state", () => ({ page: { url: new URL("arco://app/") } }));

import { EURC, USDC } from "../src/lib/server/contracts.ts";
import { toWei } from "../src/lib/server/guard.ts";
import { DEFAULTS } from "../src/lib/server/limits.ts";
import { walletMandate } from "../src/lib/server/mandate.ts";
import type { Report, Row } from "../src/lib/server/reconcile.ts";
import { type View, type ViewInput, buildView, cut, dayLabel, group, history } from "../src/lib/server/view.ts";
import { at, draw, percent } from "../src/lib/ui/chart.ts";
import Layout from "../src/routes/+layout.svelte";
import Portfolio from "../src/routes/portfolio/+page.svelte";
import Activity from "../src/routes/activity/+page.svelte";
import Receive from "../src/routes/receive/+page.svelte";
import Rules from "../src/routes/rules/+page.svelte";
import Send from "../src/routes/send/+page.svelte";
import Settings from "../src/routes/settings/+page.svelte";
import Swap from "../src/routes/swap/+page.svelte";

const ME = "0xCbEB3dcd3A96843b0324a983658bD31393466486";
const STRANGER = "0x1111111111111111111111111111111111111111";
const HASH = `0x${"ab".repeat(32)}`;
// The moment the fixture is read (its readAt), in seconds, for the balance timeline.
const NOW = BigInt(new Date(2026, 10, 20, 14, 3, 12).getTime() / 1000);
const DAY = 86_400n;

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
    mandate: walletMandate(ME, DEFAULTS),
    timeline: [
      { block: 99n, wei: toWei("40"), time: NOW - 10n * DAY },
      { block: 100n, wei: toWei("39.99958"), time: NOW - 2n * DAY },
      { block: 120n, wei: toWei("39.99916"), time: NOW - 3600n },
    ],
    ...over,
  };
}

describe("buildView", () => {
  test("cut keeps two decimals and never rounds up", () => {
    expect(cut("39.9950290611")).toBe("39.99");
    expect(cut("1,234.5")).toBe("1,234.50");
    expect(cut("0")).toBe("0");
    expect(cut("—")).toBe("—");
  });

  test("groups thousands and keeps every decimal", () => {
    expect(group("1234567.0000001")).toBe("1,234,567.0000001");
    expect(group("-1000")).toBe("-1,000");
    expect(group("0.5")).toBe("0.5");
  });

  test("shows native USDC and other tokens, and uses USDC's token view only as a check", () => {
    const v = buildView(input());
    expect(v.holdings.map((h) => [h.asset, h.amount, h.short, h.badge])).toEqual([
      ["USDC", "1,234.5", "1,234.50", "$"],
      ["EURC", "2.5", "2.50", "€"],
    ]);
    expect(v.total).toEqual({ whole: "1,234", fraction: ".5", short: "1,234.50", asset: "USDC" });
    // Cut, never rounded up: 39.9999 shows as 39.99, not 40.00.
    expect(buildView(input({ nativeWei: toWei("39.9999") })).total.short).toBe("39.99");
    expect(v.holdingsCheck.tone).toBe("ok");
  });

  test("says so when the two views of USDC disagree", () => {
    const v = buildView(input({ nativeWei: toWei("1234.6") }));
    expect(v.holdingsCheck.tone).toBe("bad");
    expect(v.holdingsCheck.text).toContain("1234.6");
  });

  test("mandate usage: used, left and the bar's width come from the server", () => {
    const [usdc, eurc] = buildView(input()).mandate.limits;
    expect(usdc).toMatchObject({ asset: "USDC", name: "USD Coin", badge: "$", perPayment: "1", total: "5", used: "0.9", left: "4.1", usedPercent: "18" });
    expect(eurc).toMatchObject({ asset: "EURC", name: "Euro Coin", used: "0", left: "5", usedPercent: "0" });
  });

  test("activity is newest first, with refusals quiet and unbounded amounts named", () => {
    const v = buildView(input());
    expect(v.activity.map((a) => a.line)).toEqual(["3", "2", "1"]);
    const [approve, refused, paid] = v.activity;
    expect(approve).toMatchObject({ kind: "Approval", amount: "unlimited", asset: "EURC", icon: "approve" });
    expect(refused).toMatchObject({ status: "Refused", tone: "quiet", fee: "—", txUrl: null, toLabel: "", icon: "refused" });
    expect(refused?.detail).toBe("recipient not on the allowlist");
    expect(paid).toMatchObject({ status: "Matched", tone: "ok", fee: "0.00042", detail: "block 100", toLabel: "this wallet", icon: "self" });
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
    expect(buildView(input()).verdict).toEqual({ tone: "ok", label: "Reconciled", counts: "2 matched, 1 refused, 0 nonce gaps" });
    expect(buildView(input()).stats).toEqual({ operations: "3", matched: "2", refused: "1", feesPaid: "0.00084" });
  });

  test("operations are grouped under one heading per day, newest day first", () => {
    const base = input();
    const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime() / 1000;
    const [a, b, c] = base.report.rows;
    const v = buildView({
      ...base,
      report: {
        ...base.report,
        rows: [
          { ...a!, entry: { ...a!.entry, record: { ...a!.entry.record, ts: at(2026, 10, 19) } } },
          { ...b!, entry: { ...b!.entry, record: { ...b!.entry.record, ts: at(2026, 10, 20) } } },
          { ...c!, entry: { ...c!.entry, record: { ...c!.entry.record, ts: at(2026, 10, 20) } } },
        ],
      },
    });
    expect(v.days.map((d) => [d.label, d.rows.map((r) => r.line)])).toEqual([
      ["Friday 20 November 2026", ["3", "2"]],
      ["Thursday 19 November 2026", ["1"]],
    ]);
    expect(dayLabel(new Date(2026, 0, 4))).toBe("Sunday 4 January 2026");
  });

  test("the balance history is data: one series per range, places from 0 to 1, amounts as labels", () => {
    const h = buildView(input()).history!;
    expect(h.ranges.map((r) => r.id)).toEqual(["1D", "1W", "1M", "1Y", "All"]);

    // All: from nothing at the first funding, every change, then the balance now.
    const all = h.ranges.at(-1)!;
    expect(all.points.map((p) => p.balance)).toEqual(["0", "40", "39.99958", "39.99916", "1,234.5"]);
    expect(all.points.map((p) => p.x)).toEqual([0, 0, 0.8, 0.9958, 1]);
    expect(all).toMatchObject({ high: { balance: "1,234.5", x: 1, y: 1 }, low: { balance: "0", x: 0, y: 0 }, change: "+1,234.50 USDC", tone: "ok" });

    // 1D opens with the balance held a day ago, then the change an hour ago.
    const day = h.ranges[0]!;
    expect(day.points.map((p) => p.balance)).toEqual(["39.99958", "39.99916", "1,234.5"]);
    expect(day.from).toBe("2026-11-19");
    expect(day.to).toBe("2026-11-20");

    // A wallet younger than a range starts that range when it was funded.
    expect(h.ranges[3]!.points).toEqual(all.points);
  });

  test("a flat balance sits in the middle; no funding is no history", () => {
    const now = new Date(Number(NOW) * 1000);
    const flat = history([{ block: 1n, wei: 5n, time: NOW - 2n * DAY }], 5n, now)!.ranges[0]!;
    expect(flat.points.map((p) => p.y)).toEqual([0.5, 0.5]);
    expect(flat).toMatchObject({ change: "No change", tone: "quiet" });
    // The change reads to two decimals, cut; less than a cent says so.
    const fee = history([{ block: 1n, wei: 5n * 10n ** 18n, time: NOW - 2n * DAY }], 5n * 10n ** 18n - 420_000_000_000_000n, now)!;
    expect(fee.ranges[0]!.change).toBe("−<0.01 USDC");
    expect(history([], 5n, now)).toBeNull();
    expect(history([{ block: 1n, wei: 0n, time: NOW }], 0n, now)).toBeNull();
    expect(buildView(input({ timeline: undefined })).history).toBeNull();
  });

  test("the frontend draws those places at whatever size it chooses", () => {
    const points = [{ x: 0, y: 1 }, { x: 0.0476, y: 0.5 }, { x: 1, y: 0 }];
    expect(draw(points, 600, 160).line).toBe("M0.0,12.0 H28.6 V80.0 H600.0 V148.0");
    expect(draw(points, 100, 50, 0).line).toBe("M0.0,0.0 H4.8 V25.0 H100.0 V50.0");
    expect(draw([], 600, 160)).toEqual({ line: "", area: "" });
    // The hover reads the step it is over; labels stay off the very edges.
    expect([0, 0.04, 0.5, 1].map((fx) => at(points, fx))).toEqual([0, 0, 1, 2]);
    expect(percent({ x: 0.5, y: 0.5 }, 100, 0)).toEqual({ left: "50.00%", top: "50.00%" });
    expect(percent({ x: 1, y: 1 }, 100, 0, 4).left).toBe("96.00%");
  });

  test("recipients are structured, and links point at the faucet and this wallet", () => {
    const v = buildView(input());
    expect(v.mandate.recipients).toEqual([{ address: ME, label: "this wallet" }]);
    expect(v.links).toEqual({ faucet: "https://faucet.circle.com", explorer: `https://testnet.arcscan.app/address/${ME}` });
  });
});

// ── the templates ────────────────────────────────────────────────────

const ROOT = join(import.meta.dirname, "..");

/** Every Svelte file that makes up the screens. */
export function frontendFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith(".svelte")) out.push(rel);
    }
  };
  walk("src/routes");
  walk("src/lib/ui");
  return out.sort();
}

/** The markup's {…} expressions, without the script and style blocks. */
function expressions(source: string): string[] {
  const markup = source.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  return [...markup.matchAll(/\{([^{}]*)\}/g)]
    .map((m) => m[1]!.trim())
    .filter((e) => !e.startsWith("/"));   // {/each}, {/if}: block ends, not code
}

const SUMS = /[+*/%]|(?<![=!<>])-(?![>-])|\bNumber\(|BigInt|parse(Int|Float)|toFixed|toLocale|Intl\.|Math\./;

test("no template's expressions contain arithmetic or number formatting", () => {
  const files = frontendFiles();
  expect(files.length).toBeGreaterThanOrEqual(14);
  let total = 0;
  const offenders: string[] = [];
  for (const f of files) {
    const exprs = expressions(readFileSync(join(ROOT, f), "utf8"));
    total += exprs.length;
    // Strings inside an expression may hold any character; judge only the code.
    for (const e of exprs.map((x) => x.replace(/"[^"]*"/g, '""'))) {
      if (SUMS.test(e)) offenders.push(`${f}: ${e}`);
    }
  }
  expect(total).toBeGreaterThan(150);
  expect(offenders).toEqual([]);
});

test("the checker would catch arithmetic if someone added it", () => {
  // Control for the test above: same rule, on expressions that do sums.
  const bad = ["l.used + 1", "a.fee * 2", "Number(b.now)", "b.start - b.fees"];
  expect(bad.filter((e) => SUMS.test(e))).toEqual(bad);
});

// ── every screen, rendered ───────────────────────────────────────────

/** Visible text: tags and the head removed. */
function visibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
}

/** Numbers on screen that appear nowhere in the data the backend sent. */
function untraced(text: string, data: unknown): string[] {
  const source = JSON.stringify(data);
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0]).filter((n) => !source.includes(n));
}

const REVIEW = {
  review: {
    tone: "ok" as const,
    title: "Ready to Sign",
    steps: [
      { label: "Mandate", tone: "ok" as const, text: "0.1 USDC to me is within the rules" },
      { label: "Rehearsal", tone: "ok" as const, text: "the node accepts it: 21000 gas, fee about 0.000525 USDC" },
    ],
    form: { to: ME, amount: "0.1", asset: "USDC" },
    quote: { amount: "0.1 USDC", to: "This Wallet", fee: "about 0.000525 USDC", total: "0.100525 USDC", after: "1,234.39 USDC" },
  },
};

const children = createRawSnippet(() => ({ render: () => "<p>screen</p>" }));

const SCREENS = [
  { name: "frame", component: Layout, props: { children }, expect: ["Cathedral", "Testnet Wallet", "Portfolio", "Swap", "not affiliated with or endorsed by Circle", "Arc™ is a trademark of Circle Internet Group, Inc."] },
  { name: "portfolio", component: Portfolio, props: {}, expect: ["1,234", ".5", "Send", "Receive", "Swap", "Faucet", "Explorer", "Euro Coin"] },
  { name: "operations", component: Activity, props: {}, expect: ["Approval", "unlimited", "recipient not on the allowlist", "Filter", "All Operations"] },
  { name: "send", component: Send, props: { form: REVIEW }, expect: ["Review", "Ready to Sign", "about 0.000525 USDC", "0.100525 USDC", "This Wallet"] },
  { name: "receive", component: Receive, props: {}, expect: [ME, "Copy Address"] },
  { name: "swap", component: Swap, props: {}, expect: ["Get Quote", "From", "To", "USD Coin"] },
  { name: "rules", component: Rules, props: {}, expect: ["0.9", "4.1", "39.99916", "Balanced"] },
  { name: "settings", component: Settings, props: {}, expect: ["Appearance", "Dark", "Light", "Match System", "Text Size", "Hide Amounts"] },
] as const;

test("the menu starts at Home and lists Operations just above Rules, and Settings sits by the network line", () => {
  const { body } = render(Layout as never, { props: { data: buildView(input()), children } as never });
  const menu = [...visibleText(body).matchAll(/Home|Portfolio|Send|Receive|Swap|Operations|Rules/g)].map((m) => m[0]);
  expect(menu.slice(0, 7)).toEqual(["Home", "Portfolio", "Send", "Receive", "Swap", "Operations", "Rules"]);
  expect(body).toMatch(/<a[^>]+href="\/settings"[^>]+aria-label="Settings"/);
});

for (const s of SCREENS) {
  test(`${s.name}: renders, and every number on it traces to the backend's data`, () => {
    const view = buildView(input());
    const { body } = render(s.component as never, { props: { data: view, ...s.props } as never });
    const text = visibleText(body);
    for (const e of s.expect) expect(text).toContain(e);
    expect(untraced(text, { view, ...s.props })).toEqual([]);
  });
}

test("a passed review shows the quote and Send, not the guard's workings", () => {
  const { body } = render(Send as never, { props: { data: buildView(input()), form: REVIEW } as never });
  const text = visibleText(body);
  expect(text).toContain("Balance After");
  for (const gone of ["GUARD", "Mandate", "Rehearsal", "21000 gas"]) expect(text).not.toContain(gone);
});

test("a refused review says why, in one line", () => {
  const refused = { review: { tone: "bad" as const, title: "The Wallet Would Refuse This", steps: [{ label: "Mandate", tone: "bad" as const, text: "recipient not on the allowlist" }], form: { to: STRANGER, amount: "0.1", asset: "USDC" } } };
  const { body } = render(Send as never, { props: { data: buildView(input()), form: refused } as never });
  expect(visibleText(body)).toContain("Mandate: recipient not on the allowlist");
});

test("control: a number the data never contained is reported", () => {
  const view = buildView(input());
  expect(untraced("balance 1,234.5 and 987654.321", view)).toEqual(["987654.321"]);
});

test("coins with an official logo show it; any other asset keeps its glyph", () => {
  const view = buildView(input());
  const { body } = render(Swap as never, { props: { data: view } as never });
  expect(body).toMatch(/<img[^>]+src="[^"]*usdc[^"]*\.svg"/);
  expect(body).toMatch(/<img[^>]+src="[^"]*eurc[^"]*\.svg"/);
  expect(body).not.toMatch(/class="badge glyph[^"]*"[^>]*>\$</);
});

test("send: the asset picker shows the chosen coin's logo and name, and posts it with the form", () => {
  const view = buildView(input());
  const { body } = render(Send as never, { props: { data: view, form: { review: { ...REVIEW.review, form: { ...REVIEW.review.form, asset: "EURC" } } } } as never });
  expect(body).not.toContain("<select");
  expect(body).toMatch(/<input type="hidden" name="asset" value="EURC"/);
  expect(body).toMatch(/aria-haspopup="listbox"[\s\S]*?<img[^>]+src="[^"]*eurc[^"]*\.svg"[\s\S]*?Euro Coin/);
});

test("cirBTC is a sendable asset with its own name, logo and Bitcoin's 8 decimals", () => {
  const limits = buildView(input()).mandate.limits;
  expect(limits.map((l) => l.asset)).toEqual(["USDC", "EURC", "cirBTC"]);
  expect(limits[2]).toMatchObject({ name: "Circle Wrapped Bitcoin", badge: "₿", perPayment: "0.0001", total: "0.0005", left: "0.0005" });
  const chosen = { review: { ...REVIEW.review, form: { ...REVIEW.review.form, asset: "cirBTC" } } };
  const { body } = render(Send as never, { props: { data: buildView(input()), form: chosen } as never });
  expect(body).toMatch(/<input type="hidden" name="asset" value="cirBTC"/);
});

test("Max is the least of what is held (less a fee reserve for USDC), the per-payment limit and what is left", () => {
  const big = buildView(input()).mandate.limits;
  expect(big.map((l) => [l.asset, l.available, l.max])).toEqual([
    ["USDC", "1234.5", "1"], // the per-payment limit is the least
    ["EURC", "2.5", "1"],
    ["cirBTC", "", ""], // not read: no Max
  ]);
  const small = buildView(input({ nativeWei: toWei("0.3") })).mandate.limits[0]!;
  expect(small.max).toBe("0.29"); // what is held, less 0.01 for the fee
  expect(buildView(input({ nativeWei: toWei("0.005") })).mandate.limits[0]!.max).toBe("0");
});

test("send: no limit text, typed or not; the balance panel shows what is held", () => {
  const empty = visibleText(render(Send as never, { props: { data: buildView(input()), form: null } as never }).body);
  expect(empty).toContain("Balance");
  expect(empty).toContain("1,234.5");
  expect(empty).not.toContain("per payment");
  const typed = visibleText(render(Send as never, { props: { data: buildView(input()), form: REVIEW } as never }).body);
  expect(typed).not.toContain("per payment");
  expect(typed).not.toContain("left under the rules");
});
