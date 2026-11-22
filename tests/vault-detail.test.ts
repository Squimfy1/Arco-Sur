/**
 * A vault's page, worded from the protocols' real answers (Morpho's API for
 * Galaxy USDC, Aave's V4 API for the Core hub, saved 21 Nov 2026), and the
 * page drawing it, diagram included.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "svelte/server";
import { expect, test } from "vitest";

import { type AaveHistory, type AaveHub, type MorphoVault, fromAave, fromMorpho, series, vaultDetail } from "../src/lib/server/vault-detail.ts";
import { vaults } from "../src/lib/server/vaults.ts";
import VaultFlow from "../src/lib/ui/VaultFlow.svelte";
import VaultPage from "../src/routes/vaults/[slug]/+page.svelte";

const fixture = <T>(name: string): T => JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", name), "utf8"));
const NOW = new Date(2026, 10, 21, 21, 50);
const vault = (slug: string) => vaults().vaults.find((v) => v.slug === slug)!;

test("a Morpho vault: key figures, where its money goes, who controls it, how it works", () => {
  const d = fromMorpho(vault("galaxy-usdc"), fixture<MorphoVault>("morpho-galaxy-usdc.json"), NOW);
  expect(d.stats.map((s) => [s.label, s.value])).toEqual([
    ["Total Deposits", "$92.7M"],
    ["Yield Now", "1.04%"],
    ["Liquidity", "$78.8M"],
    ["Not Lent Out", "72.98%"],
    ["Fees", "None"],
    ["Opened", "12 Jun 2026"],
  ]);
  expect(d.markets[0]).toMatchObject({ name: "USDC lent against cirBTC", share: "27.02%", safety: "liquidated at 86% loan to value" });
  expect(d.markets.at(-1)).toMatchObject({ name: "Idle, not lent", share: "72.98%" });
  expect(d.roles.find((r) => r.label === "Timelock")?.value).toBe("7 days");
  expect(d.flow).toMatchObject({ deposit: "Your USDC", vault: "Galaxy USDC", vaultNote: "Galaxy Curation chooses the markets" });
  expect(d.flow.branches.map((b) => b.title)).toEqual(["Borrowers posting cirBTC", "Kept idle"]);
  expect(d.flow.steps.map((s) => s.title)).toEqual(["You deposit", "Galaxy Curation allocates", "Borrowers borrow", "Interest comes back"]);
  expect(d.flow.steps[1]?.text).toContain("lends the vault through a single market");
  expect(d.flow.steps[1]?.text).toContain("keeps 72.98% idle for withdrawals");
  expect(d.flow.steps[1]?.text).toContain("waits 7 days");
  expect(d.series.map((s) => s.id)).toEqual(["apy", "deposits"]);
  expect(d.read).toBe("Read from Morpho at 21:50");
});

test("an Aave reserve: hub figures, what backs the borrowing, and its markets as branches", () => {
  const d = fromAave(vault("aave-v4-core-usdc"), "USDC", fixture<AaveHub>("aave-core-hub.json"), fixture<AaveHistory>("aave-core-usdc-history.json"), NOW);
  expect(d.stats.find((s) => s.label === "Total Deposits")?.value).toBe("$137M");
  expect(d.stats.find((s) => s.label === "Yield Now")?.value).toBe("2.10%");
  expect(d.stats.find((s) => s.label === "Deposit Cap")?.value).toBe("$200M");
  expect(d.markets.find((m) => m.name === "cirBTC posted as collateral")?.safety).toBe("borrow up to 78% of its value");
  expect(d.flow.branches.map((b) => b.title)).toEqual(["Maple SyrupUSDC market", "Main market", "Forex market"]);
  expect(d.flow.branches[1]?.note).toContain("against cirBTC (78%), WETH (83%)");
  // Four numbered steps, the markets named in the same order as the branches.
  expect(d.flow.steps.map((s) => s.title)).toEqual(["You deposit", "The hub lends", "Borrowers borrow", "Interest comes back"]);
  expect(d.flow.steps[1]?.text).toContain("(Maple SyrupUSDC, Main, Forex)");
});

test("charts: one range per tab, laid out 0..1, labels finished, and early dust trimmed", () => {
  const day = 86_400;
  const raw = Array.from({ length: 40 }, (_, k) => ({ t: 1_790_000_000 + k * day, v: k < 3 ? 1 : 1000 + k }));
  const s = series("deposits", "Deposits", raw, (v) => `$${v}`, { trimStart: true })!;
  expect(s.ranges.map((r) => r.id)).toEqual(["1W", "1M", "All"]);
  const all = s.ranges.at(-1)!;
  expect(all.points[0]?.value).toBe("$1003");
  expect(all.points[0]?.x).toBe(0);
  expect(all.points.at(-1)?.x).toBe(1);
  expect(all.low.y).toBe(0);
  expect(all.high.y).toBe(1);
});

test("if the protocol cannot be reached, the page still opens with the list's figures and says so", async () => {
  const down = async () => {
    throw new Error("network down");
  };
  const d = await vaultDetail("gauntlet-usdc-prime", down, NOW)!;
  expect(d.problem).toContain("Could not reach Morpho just now (network down)");
  expect(d.stats[0]?.value).toBe(vault("gauntlet-usdc-prime").deposits);
  expect(vaultDetail("no-such-vault")).toBeNull();
});

test("the diagram draws the deposit, the vault, every branch and the interest coming back", () => {
  const d = fromMorpho(vault("galaxy-usdc"), fixture<MorphoVault>("morpho-galaxy-usdc.json"), NOW);
  const { body } = render(VaultFlow as never, { props: { flow: d.flow } as never });
  for (const text of ["Your USDC", "Galaxy USDC", "Borrowers posting cirBTC", "Kept idle", "Interest comes back to depositors"]) expect(body).toContain(text);
  const page = render(VaultPage as never, { props: { data: { detail: d } } as never }).body;
  for (const text of ["How It Works", "Where the Money Goes", "Who Controls It", "Open on Morpho"]) expect(page).toContain(text);
});
