/**
 * The Vaults screen: the largest vaults on Arc mainnet by deposits, with who
 * curates them and what they pay. Checked by hand (see SOURCES and CHECKED);
 * figures move constantly, so the screen always says when they were taken.
 *
 * Kept here as data, worded for the screen. The frontend picks each logo by
 * slug and decides the look.
 */

import type { Vault, Vaults } from "../contract.ts";
import { dayOf } from "./news.ts";

export type Entry = {
  name: string;
  protocol: string;
  protocolSlug: string;
  curator: string;
  curatorSlug: string;
  asset: string;
  depositsUsd: number;
  apyPct: number;
  apyNote: string;
  url: string;
};

// Read from the protocols' own data on 21 Nov 2026 at 20:28 UTC: Morpho's
// API (listed vault V2s on chain 5042) and Aave's V4 API (the Core hub's
// supply). DeFiLlama, used as a cross-check, finds no other lending or
// yield protocol on Arc with real deposits. Deposits are what is supplied;
// yields are each protocol's current figure, net of fees, with no rewards.
// Left out: Aave's Maple syrupUSDC (collateral only, no yield), Aave WETH
// (outside this wallet's assets), and unlisted or test Morpho vaults.
const CHECKED = "2026-11-21";

export const SOURCES: { name: string; url: string }[] = [
  { name: "Morpho", url: "https://app.morpho.org/arc/earn" },
  { name: "Aave", url: "https://pro.aave.com/" },
];

/** Sorted by deposits, largest first, when read. */
const ENTRIES: Entry[] = [
  {
    name: "Aave V4 Core USDC",
    protocol: "Aave V4",
    protocolSlug: "aave",
    curator: "",
    curatorSlug: "",
    asset: "USDC",
    depositsUsd: 137124703,
    apyPct: 2.1,
    apyNote: "supply rate",
    url: "https://pro.aave.com/explore/earn/5042/NTA0Mjo6MHgxNzI4OGRmYzg2MjA1MzAxMDY0NTc3Yjk4QjAyYjgxMDE3ZTZGNzlD/0x3600000000000000000000000000000000000000",
  },
  {
    name: "Galaxy USDC",
    protocol: "Morpho",
    protocolSlug: "morpho",
    curator: "Galaxy Curation",
    curatorSlug: "galaxy",
    asset: "USDC",
    depositsUsd: 92730989,
    apyPct: 1.04,
    apyNote: "after fees",
    url: "https://app.morpho.org/arc/vault/0x8E357432CC12ff425c36432F312968aEb16112AF",
  },
  {
    name: "Aave V4 Core cirBTC",
    protocol: "Aave V4",
    protocolSlug: "aave",
    curator: "",
    curatorSlug: "",
    asset: "cirBTC",
    depositsUsd: 88868331,
    apyPct: 0.0001,
    apyNote: "mostly collateral",
    url: "https://pro.aave.com/explore/earn/5042/NTA0Mjo6MHgxNzI4OGRmYzg2MjA1MzAxMDY0NTc3Yjk4QjAyYjgxMDE3ZTZGNzlD/0x171A4217b86A807A64eB94757Db6849fb4bDbAA0",
  },
  {
    name: "Keyrock Prime USDC",
    protocol: "Morpho",
    protocolSlug: "morpho",
    curator: "Keyrock",
    curatorSlug: "keyrock",
    asset: "USDC",
    depositsUsd: 75285670,
    apyPct: 2.49,
    apyNote: "after a 1% management fee",
    url: "https://app.morpho.org/arc/vault/0x5bEfAb92a5A3D60F578Cb51EEb4e4FD50a1e3123",
  },
  {
    name: "Steakhouse Prime USDC",
    protocol: "Morpho",
    protocolSlug: "morpho",
    curator: "Steakhouse Financial",
    curatorSlug: "steakhouse",
    asset: "USDC",
    depositsUsd: 5261392,
    apyPct: 3.89,
    apyNote: "after fees",
    url: "https://app.morpho.org/arc/vault/0xbeef0016cb2Fd5C352ea7CA08a9f54739DFa7298",
  },
  {
    name: "Aave V4 Core EURC",
    protocol: "Aave V4",
    protocolSlug: "aave",
    curator: "",
    curatorSlug: "",
    asset: "EURC",
    depositsUsd: 1617358,
    apyPct: 0.58,
    apyNote: "supply rate",
    url: "https://pro.aave.com/explore/earn/5042/NTA0Mjo6MHgxNzI4OGRmYzg2MjA1MzAxMDY0NTc3Yjk4QjAyYjgxMDE3ZTZGNzlD/0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1",
  },
  {
    name: "Clearstar Core USDC",
    protocol: "Morpho",
    protocolSlug: "morpho",
    curator: "Clearstar",
    curatorSlug: "clearstar",
    asset: "USDC",
    depositsUsd: 628425,
    apyPct: 6.88,
    apyNote: "after a 5% performance fee",
    url: "https://app.morpho.org/arc/vault/0xd45C268Ef9850a00D51d7c05C0aF17fdAd309060",
  },
  {
    name: "Galaxy EURC",
    protocol: "Morpho",
    protocolSlug: "morpho",
    curator: "Galaxy Curation",
    curatorSlug: "galaxy",
    asset: "EURC",
    depositsUsd: 550641,
    apyPct: 0.89,
    apyNote: "after fees",
    url: "https://app.morpho.org/arc/vault/0x389abDf4355e0cF4f19298179991705a98f21c18",
  },
  {
    name: "Steakhouse High Yield USDC",
    protocol: "Morpho",
    protocolSlug: "morpho",
    curator: "Steakhouse Financial",
    curatorSlug: "steakhouse",
    asset: "USDC",
    depositsUsd: 287468,
    apyPct: 7.26,
    apyNote: "after fees",
    url: "https://app.morpho.org/arc/vault/0xbeeff419ECc98763045E0A26490b62aDfb9103C1",
  },
  {
    name: "Gauntlet USDC Balanced",
    protocol: "Morpho",
    protocolSlug: "morpho",
    curator: "Gauntlet",
    curatorSlug: "gauntlet",
    asset: "USDC",
    depositsUsd: 240185,
    apyPct: 6.92,
    apyNote: "after fees",
    url: "https://app.morpho.org/arc/vault/0x10AF7238C6355Aa8dDB5eD60E2e9b55a72827B51",
  },
  {
    name: "Gauntlet USDC Prime",
    protocol: "Morpho",
    protocolSlug: "morpho",
    curator: "Gauntlet",
    curatorSlug: "gauntlet",
    asset: "USDC",
    depositsUsd: 95060,
    apyPct: 3.89,
    apyNote: "after fees",
    url: "https://app.morpho.org/arc/vault/0xdECcd53BE5453215821184824B519E04C7e00bC7",
  },
  {
    name: "Bitwise Premium RWA USDC",
    protocol: "Morpho",
    protocolSlug: "morpho",
    curator: "Bitwise",
    curatorSlug: "bitwise",
    asset: "USDC",
    depositsUsd: 66869,
    apyPct: 5.34,
    apyNote: "after a 0.39% management fee",
    url: "https://app.morpho.org/arc/vault/0x7610094B846657dCF166D59e42973db52c7015F9",
  },
];

/** "Galaxy USDC" as "galaxy-usdc": the vault's page address. */
export const slugOf = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Every vault as the list holds it, for its own page. */
export const ENTRY_LIST: readonly Entry[] = ENTRIES;

/** "$12.4M", "$842K", "$1.2B". */
export function dollars(usd: number): string {
  const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, suffix] of units) {
    if (usd >= size) {
      const value = usd / size;
      return `$${value >= 100 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, "")}${suffix}`;
    }
  }
  return `$${Math.round(usd)}`;
}

/** "5.12%"; a rate too small to show at two places reads "under 0.01%". */
export const percent = (pct: number): string => (pct > 0 && pct < 0.005 ? "under 0.01%" : `${pct.toFixed(2)}%`);

export function vaults(entries: readonly Entry[] = ENTRIES): Vaults {
  const sorted = [...entries].sort((a, b) => b.depositsUsd - a.depositsUsd);
  const list: Vault[] = sorted.map((e) => ({
    slug: slugOf(e.name),
    name: e.name,
    protocol: e.protocol,
    protocolSlug: e.protocolSlug,
    curator: e.curator,
    curatorSlug: e.curatorSlug,
    asset: e.asset,
    deposits: dollars(e.depositsUsd),
    apy: percent(e.apyPct),
    apyNote: e.apyNote,
    url: e.url,
  }));
  return {
    vaults: list,
    assets: [...new Set(sorted.map((e) => e.asset))],
    asOf: dayOf(CHECKED),
    total: dollars(sorted.reduce((sum, e) => sum + e.depositsUsd, 0)),
    sources: SOURCES,
  };
}
