/**
 * One vault's page, read live from the protocol that runs it: Morpho's API
 * for Morpho vaults, Aave's V4 API for the Aave Core hub. Both are public
 * and need no key (checked 21 Nov 2026; queries recorded in
 * scratch/vault-api/queries.md when they were worked out).
 *
 * Two halves, kept apart so the wording can be tested on saved answers:
 *   fetching  morphoRaw / aaveRaw ask the APIs (and are cached for minutes)
 *   wording   fromMorpho / fromAave turn an answer into a VaultDetail, every
 *             figure finished, as the screen shows it
 *
 * If an API cannot be reached, the page still opens with the list's own
 * figures and says so.
 */

import type { Series, SeriesPoint, SeriesRange, Vault, VaultDetail, VaultMarket, VaultStat } from "../contract.ts";
import { type Entry, ENTRY_LIST, dollars, percent, slugOf, vaults } from "./vaults.ts";

const MORPHO = "https://api.morpho.org/graphql";
const AAVE = "https://api.aave.com/graphql";
const CHAIN = 5042; // Arc mainnet
const AAVE_HUB = "0x17288dfc86205301064577b98B02b81017e6F79C"; // the Core hub
const MAIN_SPOKE = "0xB843bdC3a87A05E77E07Df9FE48928b3A34b134d"; // where a deposit goes
const FRESH_MS = 5 * 60_000;

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

// --- numbers ---------------------------------------------------------------------

const num = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN);
/** A fraction as a percentage; a rate too small to show at two places reads "under 0.01%", not "0.00%". */
const pct = (fraction: unknown): string => {
  const p = num(fraction) * 100;
  return p > 0 && p < 0.005 ? "under 0.01%" : percent(p);
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (seconds: number): string => {
  const d = new Date(seconds * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const clock = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "7 days", "1 day", "12 hours", "none". */
function waitOf(seconds: number): string {
  if (seconds <= 0) return "none";
  if (seconds % 86_400 === 0) return `${seconds / 86_400} day${seconds === 86_400 ? "" : "s"}`;
  return `${Math.round(seconds / 3600)} hours`;
}

// --- charts --------------------------------------------------------------------

const RANGES: { id: string; days: number | null }[] = [
  { id: "1W", days: 7 },
  { id: "1M", days: 30 },
  { id: "3M", days: 90 },
  { id: "All", days: null },
];

/**
 * A chart from daily points (seconds, value), oldest first: one range per
 * tab, each laid out on its own 0..1 scale, every label finished by `show`.
 */
export function series(
  id: string,
  label: string,
  raw: { t: number; v: number }[],
  show: (v: number) => string,
  { trimStart = false }: { trimStart?: boolean } = {},
): Series | null {
  let pts = raw.filter((p) => Number.isFinite(p.v)).sort((a, b) => a.t - b.t);
  // A vault's first days often hold a few test dollars; start the chart where real money arrives.
  if (trimStart) {
    const peak = Math.max(...pts.map((p) => p.v));
    const first = pts.findIndex((p) => p.v >= peak * 0.005);
    if (first > 0) pts = pts.slice(first);
  }
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1]!.t;
  const ranges: SeriesRange[] = [];
  for (const r of RANGES) {
    const from = r.days === null ? pts[0]!.t : last - r.days * 86_400;
    const inRange = pts.filter((p) => p.t >= from);
    if (inRange.length < 2) continue;
    // Skip a tab that would show the same days as a longer one before it.
    if (r.days !== null && inRange.length === pts.length && RANGES.some((o) => o.days === null)) continue;
    const t0 = inRange[0]!.t;
    const span = Math.max(1, last - t0);
    const vs = inRange.map((p) => p.v);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const height = hi - lo || Math.abs(hi) || 1;
    const points: SeriesPoint[] = inRange.map((p) => ({
      x: (p.t - t0) / span,
      y: hi === lo ? 0.5 : (p.v - lo) / height,
      value: show(p.v),
      when: day(p.t),
    }));
    const pick = (v: number) => points[vs.indexOf(v)]!;
    ranges.push({ id: r.id, points, high: pick(hi), low: pick(lo), from: day(t0), to: day(last) });
  }
  return ranges.length === 0 ? null : { id, label, ranges };
}

// --- Morpho ------------------------------------------------------------------------

const MORPHO_QUERY = `query Vault($address: String!, $chainId: Int!) {
  vaultV2ByAddress(address: $address, chainId: $chainId) {
    address name creationTimestamp
    asset { symbol decimals }
    metadata { description }
    totalAssets totalAssetsUsd idleAssetsUsd liquidityUsd
    netApy
    apy7d: avgNetApy(lookback: SEVEN_DAYS)
    apy30d: avgNetApy(lookback: THIRTY_DAYS)
    performanceFee managementFee
    owner { address } curator { address }
    curators { items { name } }
    allocators { allocator { address } }
    sentinels { sentinel { address } }
    timelocks { duration }
    adapters(first: 10) {
      items {
        __typename assetsUsd
        ... on MorphoMarketV1Adapter {
          positions(first: 30) {
            items {
              state { supplyAssetsUsd }
              market {
                lltv
                loanAsset { symbol }
                collateralAsset { symbol }
                state { utilization netSupplyApy }
              }
            }
          }
        }
        ... on MetaMorphoAdapter { metaMorpho { name } }
        ... on MorphoVaultV2Adapter { innerVault { name } }
      }
    }
    historicalState {
      totalAssetsUsd { x y }
      avgNetApy { x y }
    }
  }
}`;

type Point = { x: number; y: number };
type MorphoPosition = {
  state: { supplyAssetsUsd: number };
  market: { lltv: string; loanAsset: { symbol: string }; collateralAsset: { symbol: string } | null; state: { utilization: number; netSupplyApy: number } };
};
export type MorphoVault = {
  address: string;
  name: string;
  creationTimestamp: number;
  asset: { symbol: string; decimals: number };
  metadata: { description: string | null } | null;
  totalAssets: number;
  totalAssetsUsd: number;
  idleAssetsUsd: number;
  liquidityUsd: number;
  netApy: number;
  apy7d: number | null;
  apy30d: number | null;
  performanceFee: number;
  managementFee: number;
  owner: { address: string } | null;
  curator: { address: string } | null;
  curators: { items: { name: string }[] };
  allocators: { allocator: { address: string } }[];
  sentinels: { sentinel: { address: string } }[];
  timelocks: { duration: number }[];
  adapters: {
    items: ({ __typename: string; assetsUsd: number } & {
      positions?: { items: MorphoPosition[] };
      metaMorpho?: { name: string };
      innerVault?: { name: string };
    })[];
  };
  historicalState: { totalAssetsUsd: Point[]; avgNetApy: Point[] };
};

/** A Morpho vault's API answer, worded for its page. */
export function fromMorpho(vault: Vault, m: MorphoVault, now: Date): VaultDetail {
  const total = m.totalAssetsUsd || 1;
  const asset = m.asset.symbol;
  const fees = [
    m.performanceFee > 0 ? `${pct(m.performanceFee)} of interest` : "",
    m.managementFee > 0 ? `${pct(m.managementFee)} a year` : "",
  ].filter(Boolean);
  const longestWait = Math.max(0, ...m.timelocks.map((t) => t.duration));

  const stats: VaultStat[] = [
    { label: "Total Deposits", value: dollars(m.totalAssetsUsd), note: `in ${asset}` },
    { label: "Yield Now", value: pct(m.netApy), note: `7 day average ${pct(m.apy7d ?? m.netApy)}, 30 day ${pct(m.apy30d ?? m.netApy)}` },
    { label: "Liquidity", value: dollars(m.liquidityUsd), note: "can be withdrawn right now" },
    { label: "Not Lent Out", value: pct(m.idleAssetsUsd / total), note: "waiting in the vault, earning nothing" },
    { label: "Fees", value: fees.length === 0 ? "None" : fees.join(", "), note: fees.length === 0 ? "the curator takes no cut" : "taken by the curator" },
    { label: "Opened", value: day(m.creationTimestamp), note: `on Arc mainnet` },
  ];

  // Every place the money is, largest first: markets lent into directly,
  // and other vaults it lends through.
  const placed: { usd: number; row: VaultMarket }[] = [];
  for (const a of m.adapters.items) {
    for (const p of a.positions?.items ?? []) {
      if (p.state.supplyAssetsUsd < 1) continue;
      const collateral = p.market.collateralAsset?.symbol ?? "nothing";
      placed.push({
        usd: p.state.supplyAssetsUsd,
        row: {
          name: `${p.market.loanAsset.symbol} lent against ${collateral}`,
          share: pct(p.state.supplyAssetsUsd / total),
          amount: dollars(p.state.supplyAssetsUsd),
          utilization: pct(p.market.state.utilization),
          apy: pct(p.market.state.netSupplyApy),
          safety: `liquidated at ${pct(num(p.market.lltv) / 1e18).replace(".00%", "%")} loan to value`,
        },
      });
    }
    const inner = a.metaMorpho?.name ?? a.innerVault?.name;
    if (inner && a.assetsUsd >= 1) {
      placed.push({
        usd: a.assetsUsd,
        row: { name: `Into the ${inner} vault`, share: pct(a.assetsUsd / total), amount: dollars(a.assetsUsd), utilization: "", apy: "", safety: "managed by that vault" },
      });
    }
  }
  const markets: VaultMarket[] = placed.sort((x, y) => y.usd - x.usd).map((x) => x.row);
  if (m.idleAssetsUsd >= 1) {
    markets.push({ name: "Idle, not lent", share: pct(m.idleAssetsUsd / total), amount: dollars(m.idleAssetsUsd), utilization: "", apy: "0.00%", safety: "withdrawable at once" });
  }

  const curatorName = m.curators.items[0]?.name ?? vault.curator ?? "The curator";
  const lent = markets.filter((x) => x.name !== "Idle, not lent");
  const collaterals = [
    ...new Set(
      m.adapters.items.flatMap((a) =>
        (a.positions?.items ?? []).filter((p) => p.state.supplyAssetsUsd >= 1).map((p) => p.market.collateralAsset?.symbol).filter((x): x is string => !!x),
      ),
    ),
  ];
  const branches = [
    ...lent.slice(0, 4).map((x) => ({
      title: x.name.replace(`${asset} lent against `, "Borrowers posting "),
      note: `${x.share} of the vault${x.apy ? `, earning ${x.apy}` : ""}`,
    })),
    ...(m.idleAssetsUsd >= 1 ? [{ title: "Kept idle", note: `${pct(m.idleAssetsUsd / total)}, ready for withdrawals` }] : []),
  ];

  return {
    vault,
    description: m.metadata?.description ?? "",
    address: m.address,
    problem: "",
    read: `Read from Morpho at ${clock(now)}`,
    stats,
    series: [
      series("apy", "Yield", m.historicalState.avgNetApy.map((p) => ({ t: p.x, v: p.y })), (v) => percent(v * 100)),
      series("deposits", "Deposits", m.historicalState.totalAssetsUsd.map((p) => ({ t: p.x, v: p.y })), dollars, { trimStart: true }),
    ].filter((s): s is Series => s !== null),
    marketsTitle: "Where the Money Goes",
    markets,
    roles: [
      { label: "Curator", value: curatorName, note: m.curator ? `decides where deposits are lent, ${short(m.curator.address)}` : "decides where deposits are lent" },
      { label: "Owner", value: m.owner ? short(m.owner.address) : "none", note: "can change the curator and fees" },
      { label: "Allocators", value: String(m.allocators.length), note: "may move money between the markets the curator allows" },
      { label: "Guardians", value: String(m.sentinels.length), note: "may pause or cut risk in an emergency" },
      { label: "Timelock", value: waitOf(longestWait), note: "the longest a risky change must wait before it applies" },
    ],
    flow: {
      deposit: `Your ${asset}`,
      vault: vault.name,
      vaultNote: `${curatorName} chooses the markets`,
      branches,
      back: `Interest comes back to depositors: ${pct(m.netApy)} now${fees.length ? ", after fees" : ""}`,
      steps: [
        {
          title: "You deposit",
          text: `You put ${asset} into the vault and receive vault shares in return. Your shares are your claim on the vault.`,
        },
        {
          title: `${curatorName} allocates`,
          text:
            (lent.length === 1 ? "The curator lends the vault through a single market" : `The curator splits the vault across ${lent.length} markets`) +
            ", within limits it has set" +
            (m.idleAssetsUsd >= 1 ? `, and keeps ${pct(m.idleAssetsUsd / total)} idle for withdrawals` : "") +
            `. A riskier change waits ${waitOf(longestWait)} before it applies, so depositors can leave first.`,
        },
        {
          title: "Borrowers borrow",
          text:
            `Borrowers lock up collateral worth more than they take${collaterals.length ? ` (${collaterals.join(", ")})` : ""} and pay interest. ` +
            "If their collateral falls to the market's limit, it is sold to repay the loan, so lenders are paid back first.",
        },
        {
          title: "Interest comes back",
          text:
            `The interest flows back into the vault${fees.length ? `, less ${fees.join(" and ")}` : ""}, so each share is worth more: ${pct(m.netApy)} a year right now. ` +
            `You can withdraw up to ${dollars(m.liquidityUsd)} today.`,
        },
      ],
    },
  };
}

// --- Aave --------------------------------------------------------------------------

const AAVE_QUERY = `query Hub($hub: HubInput!) {
  hubAssets(request: { query: { hubInput: $hub } }) {
    id
    underlying { info { symbol } }
    summary {
      supplied { exchange { value } }
      borrowed { exchange { value } }
      availableLiquidity { exchange { value } }
      supplyApy { value } borrowApy { value } utilizationRate { value }
      trailing7d: trailingSupplyApy(window: LAST_WEEK, includeRewards: true) { value }
      trailing30d: trailingSupplyApy(window: LAST_MONTH, includeRewards: true) { value }
    }
    settings { liquidityFee { value } }
  }
  hub(request: { query: { hubInput: $hub } }) {
    exposure { asset { underlying { info { symbol } } } share { value } totalCollateral(currency: USD) { value } }
  }
  reserves(request: { query: { hub: $hub }, filter: ALL }) {
    id
    spoke { name address }
    asset { underlying { info { symbol } } }
    summary { borrowed { exchange { value } } }
    settings { collateral borrowable collateralFactor { value } supplyCap { exchange { value } } }
    oracle { description provider { name } }
  }
}`;

const AAVE_HISTORY = `query History($reserve: ReserveId!, $hubAsset: HubAssetId!) {
  supplyApy: supplyApyHistory(request: { reserve: $reserve, window: LAST_THREE_MONTHS, includeRewards: true }) { date avgRate { value } }
  hubAssetSummary: hubSummaryHistory(request: { query: { hubAssetId: $hubAsset }, currency: USD, window: LAST_THREE_MONTHS }) { date deposits { value } }
}`;

type V = { value: string };
export type AaveHub = {
  hubAssets: {
    id: string;
    underlying: { info: { symbol: string } };
    summary: {
      supplied: { exchange: V };
      borrowed: { exchange: V };
      availableLiquidity: { exchange: V };
      supplyApy: V;
      borrowApy: V;
      utilizationRate: V;
      trailing7d: V | null;
      trailing30d: V | null;
    };
    settings: { liquidityFee: V };
  }[];
  hub: { exposure: { asset: { underlying: { info: { symbol: string } } }; share: V; totalCollateral: V }[] };
  reserves: {
    id: string;
    spoke: { name: string; address: string };
    asset: { underlying: { info: { symbol: string } } };
    summary: { borrowed: { exchange: V } };
    settings: { collateral: boolean; borrowable: boolean; collateralFactor: V; supplyCap: { exchange: V } };
    oracle: { description: string; provider: { name: string } } | null;
  }[];
};
export type AaveHistory = {
  supplyApy: { date: string; avgRate: V }[];
  hubAssetSummary: { date: string; deposits: V }[];
};

const seconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);

/** The Aave Core hub's answer for one asset, worded for its page. */
export function fromAave(vault: Vault, asset: string, h: AaveHub, history: AaveHistory | null, now: Date): VaultDetail {
  const a = h.hubAssets.find((x) => x.underlying.info.symbol === asset);
  if (!a) throw new Error(`Aave's hub has no ${asset}`);
  const s = a.summary;
  const main = h.reserves.find((r) => r.spoke.address.toLowerCase() === MAIN_SPOKE.toLowerCase() && r.asset.underlying.info.symbol === asset);
  const cap = num(main?.settings.supplyCap.exchange.value);

  const stats: VaultStat[] = [
    { label: "Total Deposits", value: dollars(num(s.supplied.exchange.value)), note: "across the whole hub" },
    { label: "Yield Now", value: pct(s.supplyApy.value), note: `7 day average ${pct(s.trailing7d?.value ?? s.supplyApy.value)}, 30 day ${pct(s.trailing30d?.value ?? s.supplyApy.value)}` },
    { label: "Borrowed", value: dollars(num(s.borrowed.exchange.value)), note: `${pct(s.utilizationRate.value)} of deposits are lent out` },
    { label: "Liquidity", value: dollars(num(s.availableLiquidity.exchange.value)), note: "can be withdrawn right now" },
    { label: "Borrow Rate", value: pct(s.borrowApy.value), note: "what borrowers pay; depositors earn less" },
    {
      label: "Deposit Cap",
      value: cap > 0 ? dollars(cap) : "none",
      note: cap > 0 ? `${pct(num(s.supplied.exchange.value) / cap)} filled on the Main market` : "",
    },
  ];

  // Who borrows this asset, and against what: each market (spoke) where it
  // can be borrowed, with the collateral that market accepts.
  // Largest borrowing first, the same order in the steps and the diagram.
  const lending = h.reserves
    .filter((r) => r.asset.underlying.info.symbol === asset && r.settings.borrowable)
    .sort((x, y) => num(y.summary.borrowed.exchange.value) - num(x.summary.borrowed.exchange.value));
  const collateralIn = (spoke: string) =>
    h.reserves
      .filter((r) => r.spoke.name === spoke && r.settings.collateral && r.asset.underlying.info.symbol !== asset)
      .map((r) => `${r.asset.underlying.info.symbol} (${pct(r.settings.collateralFactor.value).replace(".00%", "%")})`);
  const borrowedTotal = num(s.borrowed.exchange.value) || 1;

  const markets: VaultMarket[] = h.hub.exposure
    .filter((e) => num(e.share.value) > 0.0005)
    .map((e) => {
      const symbol = e.asset.underlying.info.symbol;
      const factor = h.reserves.find((r) => r.asset.underlying.info.symbol === symbol && r.settings.collateral)?.settings.collateralFactor.value;
      return {
        name: `${symbol} posted as collateral`,
        share: pct(e.share.value),
        amount: dollars(num(e.totalCollateral.value)),
        utilization: "",
        apy: "",
        safety: factor === undefined ? "" : `borrow up to ${pct(factor).replace(".00%", "%")} of its value`,
      };
    });

  const oracle = main?.oracle;
  return {
    vault,
    description: `Aave V4's Core hub on Arc: one shared pool of ${asset} that every depositor supplies and every borrower draws from. Borrowers post collateral in the hub's markets and pay interest, most of which goes to depositors.`,
    address: AAVE_HUB,
    problem: "",
    read: `Read from Aave at ${clock(now)}`,
    stats,
    series: history
      ? [
          series("apy", "Yield", history.supplyApy.map((p) => ({ t: seconds(p.date), v: num(p.avgRate.value) })), (v) => percent(v * 100)),
          series(
            "deposits",
            "Deposits",
            history.hubAssetSummary.filter((p) => num(p.deposits.value) > 0).map((p) => ({ t: seconds(p.date), v: num(p.deposits.value) })),
            dollars,
            { trimStart: true },
          ),
        ].filter((x): x is Series => x !== null)
      : [],
    marketsTitle: "What Backs the Borrowing",
    markets,
    roles: [
      { label: "Run By", value: "Aave governance", note: "no curator: the protocol sets the rules for every market" },
      { label: "Kept by Aave", value: pct(a.settings.liquidityFee.value), note: "of the interest borrowers pay" },
      { label: "Price Source", value: oracle ? `${oracle.provider.name}, ${oracle.description}` : "not given", note: "used to value collateral" },
      { label: "Markets", value: String(lending.length), note: `markets where ${asset} can be borrowed` },
    ],
    flow: {
      deposit: `Your ${asset}`,
      vault: `Aave V4 Core hub`,
      vaultNote: "one shared pool, run by Aave",
      branches: lending.map((r) => {
          const against = collateralIn(r.spoke.name);
          return {
            title: `${r.spoke.name} market`,
            note: `${pct(num(r.summary.borrowed.exchange.value) / borrowedTotal)} of the borrowing${against.length ? `, against ${against.join(", ")}` : ""}`,
          };
        }),
      back: `Interest comes back to depositors: ${pct(s.supplyApy.value)} now, after Aave's share`,
      steps: [
        {
          title: "You deposit",
          text: `You supply ${asset} to Aave's Core hub: one pool on Arc that every depositor shares and every borrower draws from.`,
        },
        {
          title: "The hub lends",
          text: `The hub lends the pool out through ${lending.length === 1 ? "a single market" : `${lending.length} markets`} (${lending.map((r) => r.spoke.name).join(", ")}). Aave governance sets each market's limits; there is no curator.`,
        },
        {
          title: "Borrowers borrow",
          text:
            `Borrowers lock up collateral and may borrow up to a share of its value (shown in brackets). ` +
            "If the collateral falls too far, it is sold to repay the loan, so depositors are paid back first.",
        },
        {
          title: "Interest comes back",
          text:
            `Borrowers pay ${pct(s.borrowApy.value)} a year. Aave keeps ${pct(a.settings.liquidityFee.value)} of that, and depositors share the rest: ${pct(s.supplyApy.value)} a year right now. ` +
            `${dollars(num(s.availableLiquidity.exchange.value))} can be withdrawn today.`,
        },
      ],
    },
  };
}

// --- fetching ------------------------------------------------------------------------

async function ask<T>(url: string, query: string, variables: Record<string, unknown>, fetcher: Fetcher): Promise<T> {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (Cathedral wallet)" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
  if (!response.ok || !body?.data) throw new Error(body?.errors?.[0]?.message ?? `HTTP ${response.status}`);
  return body.data;
}

const morphoAddress = (e: Entry) => e.url.match(/0x[0-9a-fA-F]{40}/)?.[0] ?? "";

async function read(e: Entry, vault: Vault, fetcher: Fetcher, now: Date): Promise<VaultDetail> {
  if (e.protocolSlug === "morpho") {
    const data = await ask<{ vaultV2ByAddress: MorphoVault }>(MORPHO, MORPHO_QUERY, { address: morphoAddress(e), chainId: CHAIN }, fetcher);
    return fromMorpho(vault, data.vaultV2ByAddress, now);
  }
  const hub = await ask<AaveHub>(AAVE, AAVE_QUERY, { hub: { address: AAVE_HUB, chainId: CHAIN } }, fetcher);
  const asset = hub.hubAssets.find((x) => x.underlying.info.symbol === e.asset);
  const reserve = hub.reserves.find((r) => r.spoke.address.toLowerCase() === MAIN_SPOKE.toLowerCase() && r.asset.underlying.info.symbol === e.asset);
  const history =
    asset && reserve ? await ask<AaveHistory>(AAVE, AAVE_HISTORY, { reserve: reserve.id, hubAsset: asset.id }, fetcher).catch(() => null) : null;
  return fromAave(vault, e.asset, hub, history, now);
}

/** When the protocol cannot be reached: the list's own figures, and why. */
function offline(vault: Vault, reason: string): VaultDetail {
  return {
    vault,
    description: "",
    address: "",
    problem: `Could not reach ${vault.protocol} just now (${reason}). These are the figures from the Vaults list.`,
    read: "",
    stats: [
      { label: "Total Deposits", value: vault.deposits, note: "" },
      { label: "Yield", value: vault.apy, note: vault.apyNote },
    ],
    series: [],
    marketsTitle: "",
    markets: [],
    roles: [],
    flow: {
      deposit: `Your ${vault.asset}`,
      vault: vault.name,
      vaultNote: vault.curator ? `${vault.curator} chooses the markets` : `run by ${vault.protocol}`,
      branches: [],
      back: `Interest comes back to depositors: ${vault.apy}`,
      steps: [
        { title: "You deposit", text: `You put ${vault.asset} into the vault.` },
        { title: vault.curator ? `${vault.curator} allocates` : `${vault.protocol} lends`, text: "The money is lent out to borrowers." },
        { title: "Borrowers borrow", text: "Borrowers lock up collateral worth more than they take, and pay interest." },
        { title: "Interest comes back", text: `The interest flows back to depositors: ${vault.apy} a year at last reading.` },
      ],
    },
  };
}

const cache = new Map<string, { at: number; detail: Promise<VaultDetail> }>();

/** A vault's page by its slug, or null if there is no such vault. Fresh for five minutes. */
export function vaultDetail(slug: string, fetcher: Fetcher = fetch, now = new Date()): Promise<VaultDetail> | null {
  const entry = ENTRY_LIST.find((e) => slugOf(e.name) === slug);
  const vault = vaults().vaults.find((v) => v.slug === slug);
  if (!entry || !vault) return null;
  const known = cache.get(slug);
  if (known && now.getTime() - known.at < FRESH_MS) return known.detail;
  const detail = read(entry, vault, fetcher, now).catch((e: unknown) => {
    cache.delete(slug);
    return offline(vault, (e as Error).message);
  });
  cache.set(slug, { at: now.getTime(), detail });
  return detail;
}
