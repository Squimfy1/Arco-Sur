/**
 * The look and the backend never reach into each other.
 *
 *   backend   src/lib/server/        data only: no colour, size, class, CSS
 *   contract  src/lib/contract.ts    types only: no code at all
 *   frontend  src/lib/ui/, routes'   never imports backend code; every
 *             .svelte files          colour comes from theme.css
 *
 * So the whole look can be swapped by editing the frontend alone, and the
 * backend can change freely as long as the contract holds. Each rule has a
 * control showing it would catch a break.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");

function files(dir: string, keep: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })) {
    if (e.isFile() && keep(e.name)) out.push(join(e.parentPath, e.name).slice(ROOT.length + 1));
  }
  return out.sort();
}

/** Comments removed, so prose about colours does not count as using them. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const BACKEND = files("src/lib/server", (n) => n.endsWith(".ts"));
// Route files named *.server.ts are backend glue: they run on the server.
const FRONTEND = [
  ...files("src/lib/ui", (n) => n.endsWith(".ts") || n.endsWith(".svelte")),
  ...files("src/routes", (n) => n.endsWith(".svelte")),
];

// ── backend: data only ───────────────────────────────────────────────

const STYLING = /\boklch\(|\brgba?\(|\bhsla?\(|#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b|\d(px|rem|em|vh|vw)\b|class=|className|\.css\b|\.svelte\b|<svg|\bstyle\b/;

test("the backend contains no colours, sizes, classes, markup or CSS", () => {
  expect(BACKEND.length).toBeGreaterThanOrEqual(14);
  const offenders = BACKEND.flatMap((f) =>
    code(read(f)).split("\n").filter((line) => STYLING.test(line)).map((line) => `${f}: ${line.trim()}`),
  );
  expect(offenders).toEqual([]);
});

test("control: the styling check catches a colour, a size and a class", () => {
  const bad = ['tone: "oklch(0.5 0.1 150)"', "width: 12px", 'cls: "#ff0000"', '`<span class="x">`'];
  expect(bad.filter((l) => STYLING.test(l))).toEqual(bad);
  expect(['to: "0xCbEB3dcd"', "toWei(\"40\")", "remembering(chain)"].filter((l) => STYLING.test(l))).toEqual([]);
});

// ── contract: types only ─────────────────────────────────────────────

test("the contract is types and nothing else", () => {
  const statements = code(read("src/lib/contract.ts"))
    .split("\n")
    .filter((l) => /^\S/.test(l) && !/^[}\]|;]/.test(l));
  expect(statements.length).toBeGreaterThan(5);
  expect(statements.filter((l) => !l.startsWith("export type "))).toEqual([]);
});

// ── frontend: no backend code ────────────────────────────────────────

const SERVER_IMPORT = /from\s+["'][^"']*(\/server\/|#lib\/server|\.server(\.ts)?["'])|import\s*\(\s*["'][^"']*server/;

test("no frontend file imports backend code", () => {
  expect(FRONTEND.length).toBeGreaterThanOrEqual(15);
  const offenders = FRONTEND.filter((f) => SERVER_IMPORT.test(read(f)));
  expect(offenders).toEqual([]);
});

test("control: the import check catches every way of reaching the backend", () => {
  const bad = [
    'import { group } from "#lib/server/view.ts";',
    'import { group } from "../server/view.ts";',
    'import { load } from "./+page.server.ts";',
    'const m = await import("#lib/server/arc.ts");',
  ];
  expect(bad.filter((l) => SERVER_IMPORT.test(l))).toEqual(bad);
  expect(SERVER_IMPORT.test('import type { View } from "../contract.ts";')).toBe(false);
});

test("the frontend's types come from the contract, not from backend modules", () => {
  const typeImports = FRONTEND.flatMap((f) =>
    [...read(f).matchAll(/import type \{[^}]*\} from ["']([^"']+)["']/g)].map((m) => m[1]!),
  );
  expect(typeImports.length).toBeGreaterThan(5);
  expect(typeImports.filter((p) => !p.endsWith("contract.ts") && p !== "./$types")).toEqual([]);
});

// ── frontend: every colour from the theme ────────────────────────────

const RAW_COLOUR = /\boklch\(|\brgba?\(|\bhsla?\(|#[0-9a-fA-F]{3,8}\b|:\s*(white|black|red|green|blue)\b/;

test("components use the theme's variables, never a raw colour", () => {
  const components = FRONTEND.filter((f) => f.endsWith(".svelte"));
  const offenders = components.flatMap((f) =>
    code(read(f)).split("\n").filter((l) => RAW_COLOUR.test(l)).map((l) => `${f}: ${l.trim()}`),
  );
  expect(offenders).toEqual([]);
  // And the theme does define them: the one place to change the look.
  expect(read("src/lib/ui/theme.css").match(/^\s*--[\w-]+:/gm)!.length).toBeGreaterThan(40);
});

test("control: the colour check catches a hard-coded colour", () => {
  const bad = ["color: white;", "background: #141317;", "fill: oklch(0.8 0.1 290);"];
  expect(bad.filter((l) => RAW_COLOUR.test(l))).toEqual(bad);
  expect(RAW_COLOUR.test("color: var(--ink);")).toBe(false);
});
