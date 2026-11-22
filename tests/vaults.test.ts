/** The Vaults screen: data from the backend, logos in the frontend, figures finished. */

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { render } from "svelte/server";
import { expect, test } from "vitest";

import { dollars, percent, vaults } from "../src/lib/server/vaults.ts";
import Vaults from "../src/routes/vaults/+page.svelte";

const LOGOS = readdirSync(join(import.meta.dirname, "../src/lib/ui/vaults")).map((f) => f.replace(/\.\w+$/, ""));

test("money and yields are worded for the screen", () => {
  expect(dollars(137_124_703)).toBe("$137M");
  expect(dollars(92_730_989)).toBe("$92.7M");
  expect(dollars(628_425)).toBe("$628K");
  expect(dollars(5_000_000)).toBe("$5M");
  expect(percent(2.1)).toBe("2.10%");
  expect(percent(0.0001)).toBe("under 0.01%");
  expect(percent(0)).toBe("0.00%");
});

test("vaults come largest first, with a total, and every protocol and curator has its logo", () => {
  const v = vaults();
  expect(v.vaults.length).toBeGreaterThanOrEqual(10);
  expect(v.vaults[0]?.name).toBe("Aave V4 Core USDC");
  expect(v.total).toMatch(/^\$\d+(\.\d)?M$/);
  expect(v.assets).toEqual(["USDC", "cirBTC", "EURC"]);
  for (const x of v.vaults) {
    expect(LOGOS, x.protocolSlug).toContain(x.protocolSlug);
    if (x.curator) expect(LOGOS, x.curatorSlug).toContain(x.curatorSlug);
    expect(x.url).toMatch(/^https:\/\//);
  }
});

test("the screen shows each vault, its curator, and says it is for reference only", () => {
  const data = { vaults: vaults() };
  const { body } = render(Vaults as never, { props: { data } as never });
  expect(body).toContain("Galaxy USDC");
  expect(body).toContain("Steakhouse Financial");
  expect(body).toContain("Run by Aave V4");
  expect(body).toContain("cannot deposit into them");
});
