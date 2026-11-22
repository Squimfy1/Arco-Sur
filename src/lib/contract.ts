/**
 * The contract between the backend and the frontend: the shape of the data
 * the server hands to the screens. Types only, no code.
 *
 *   backend   src/lib/server/   reads the chain and the log, fills these types
 *   contract  this file         what crosses over
 *   frontend  src/lib/ui/, src/routes/*.svelte   decides how it all looks
 *
 * Everything here is data: finished strings for amounts and dates, and
 * meanings rather than looks. A Tone says "this is fine" or "this is wrong",
 * never "green" or "red". An icon kind says "money went out", never which
 * glyph to draw. So the whole look can be replaced without touching the
 * backend, and the backend can change without touching the look, as long as
 * this file holds. tests/decoupling.test.ts checks both directions.
 */

/** How a value should read: fine, needs a look, wrong, or simply recorded. */
export type Tone = "ok" | "warn" | "bad" | "quiet";

export type Holding = {
  asset: string;
  name: string;
  badge: string;          // the character that stands for the asset: $, €
  amount: string;
  /** The same amount cut (never rounded up) to two decimals, for small places. */
  short: string;
  decimals: string;
  source: string;
};

export type Limit = {
  asset: string;
  name: string;           // the issuer's name for it: "USD Coin"
  badge: string;
  perPayment: string;
  /** The monthly limit, as shown ("5"). */
  total: string;
  /** The same limit as plain digits, for the Settings field ("5"). */
  monthly: string;
  /** Sent out this month, and what is left of the month's limit. */
  used: string;
  left: string;
  usedPercent: string;   // "0".."100": how much of the month's limit is used
  /** What the wallet holds of it, plain digits ("79.995"); "" if not read. For the Swap screen's Max. */
  available: string;
  /** The most one payment may send now: the least of what is held (less a fee reserve
   * for USDC), the per-payment limit and what is left. Plain digits; "" if not read. */
  max: string;
};

/** What an operation did, as a meaning. The frontend picks the picture. */
export type Direction = "out" | "in" | "self" | "approve" | "swap" | "refused";

export type ActivityRow = {
  line: string;
  when: string;
  day: string;            // 2026-11-20, for grouping
  time: string;           // 14:03:12
  nonce: string;
  status: string;
  tone: Tone;
  kind: string;
  icon: Direction;
  amount: string;
  asset: string;
  to: string;
  toShort: string;
  toLabel: string;        // "this wallet", or ""
  fee: string;
  detail: string;
  txUrl: string | null;
  problems: string[];
};

/** Operations under one date heading, newest day first. */
export type Day = { label: string; rows: ActivityRow[] };

/**
 * The native balance over time, as the chain recorded it, in one series per
 * time range (1D, 1W, 1M, 1Y, All). x and y are fractions from 0 to 1: x
 * across the range's time, y up its balance range. The frontend scales them
 * to whatever chart it draws; the labels carry the actual amounts and times.
 * A point's balance holds from its time until the next point's.
 */
export type HistoryPoint = { x: number; y: number; balance: string; when: string };

export type HistoryMark = { balance: string; x: number; y: number };

export type HistoryRange = {
  id: string;             // "1D", "1W", "1M", "1Y", "All"
  points: HistoryPoint[];
  high: HistoryMark;
  low: HistoryMark;
  from: string;
  to: string;
  change: string;         // "+40.00 USDC", "−<0.01 USDC" or "No change"
  tone: Tone;
};

export type History = { ranges: HistoryRange[] };

export type Accounting = {
  address: string;
  startBlock: string;
  start: string;
  fees: string;
  outflow: string;
  expected: string;
  now: string;
  unexplained: string;
  tone: Tone;
  verdict: string;
};

export type SenderView = {
  address: string;
  label: string;          // checksummed, with "this wallet" when it is
  chainNonce: string;
  gaps: string;
  gapsTone: Tone;
  duplicates: string;
  feesPaid: string;
  accounting: Accounting | null;
};

export type View = {
  readAt: string;
  network: string;
  /** The network without its name, for beside Arc's logo: "testnet". */
  chain: string;
  block: string;
  wallet: { address: string; short: string; url: string };
  verdict: { tone: Tone; label: string; counts: string };
  /**
   * The headline balance. whole + fraction is exact; short is the same
   * amount cut (never rounded up) to two decimals, for a big display.
   */
  total: { whole: string; fraction: string; short: string; asset: string };
  history: History | null;
  holdings: Holding[];
  holdingsCheck: { tone: Tone; text: string };
  mandate: { recipients: { address: string; label: string }[]; spenders: string; limits: Limit[] };
  activity: ActivityRow[];
  days: Day[];
  stats: { operations: string; matched: string; refused: string; feesPaid: string };
  senders: SenderView[];
  orphans: string[];
  links: { faucet: string; explorer: string };
};

// --- the Send screen's review --------------------------------------------

export type ReviewForm = { to: string; amount: string; asset: string };

export type ReviewStep = { label: string; tone: Tone; text: string };

export type Review = {
  tone: Tone;
  title: string;
  steps: ReviewStep[];
  form: ReviewForm;
  /** Only when it passed: what sending it would cost, and leave. */
  quote?: SendQuote;
};

// --- the Home screen's news ------------------------------------------------

/** One piece of news from a company in Arc's ecosystem. */
export type NewsItem = {
  company: string;
  /** Names the company's logo file in the frontend; the backend knows no images. */
  slug: string;
  /** The ecosystem category Arc lists the company under. */
  topic: string;
  /** "Product Launch", "Partnership", "Integration", "Funding" or "News". */
  kind: string;
  headline: string;
  /** Two sentences. */
  summary: string;
  /** A few words for the moving ticker. */
  ticker: string;
  /** The day it happened, as shown ("12 Nov 2026"). */
  date: string;
  source: string;
};

export type News = { topics: string[]; kinds: string[]; items: NewsItem[]; asOf: string; ecosystem: string };

// --- a send or swap in progress ---------------------------------------------

/**
 * What the progress window shows, one event at a time, as the backend does
 * each step. "plan" names the steps first; each "step" marks one done; a
 * "fail" stops at one; "done" ends it. Every text is finished.
 */
export type Progress =
  | { type: "plan"; title: string; steps: { id: string; label: string }[] }
  | { type: "step"; id: string; detail: string; link: string | null }
  | { type: "fail"; id: string; reason: string }
  | { type: "done"; ok: boolean; status: string; summary: string; link: string | null };

/** The Swap screen's quote, before anything is signed. */
export type SwapQuoteView = {
  from: string;
  to: string;
  pay: string;
  receive: string;
  /** The estimate alone, for the "To" field. */
  estimate: string;
  atLeast: string;
  fee: string;
  rate: string;
  expires: string;
};

/** The Send screen's quote, under a passed review. */
export type SendQuote = { amount: string; to: string; fee: string; total: string; after: string };

// --- the statement: Operations, exported ------------------------------------

/** One operation on the statement. Every field finished, as printed. */
export type StatementRow = {
  date: string;        // "20 Nov 2026"
  time: string;        // "18:32:04"
  kind: string;        // "Payment"
  detail: string;      // a refusal's reason, a swap's minimum; "" if none
  amount: string;      // "0.1"
  asset: string;
  counterparty: string;
  nonce: string;
  fee: string;         // in USDC; "" when nothing was paid
  status: string;      // "Matched"
  tone: Tone;
  tx: string;          // the short hash; "" for a refusal
  txUrl: string | null;
};

/** A dated record of the wallet's operations, for keeping or handing over. */
export type Statement = {
  title: string;
  wallet: string;
  network: string;
  generated: string;
  /** Which operations it covers: "All operations", or the filters used. */
  covers: string;
  summary: { label: string; value: string }[];
  rows: StatementRow[];
  copyright: string;
  notice: string;
  /** For file names: "2026-11-21". */
  fileDate: string;
};

/** Which operations to put on a statement; "" means any. */
export type StatementFilter = { day: string; kind: string; status: string };

// --- the Vaults screen -------------------------------------------------------

/** One vault on Arc mainnet. Every figure finished, as shown. */
export type Vault = {
  /** Its page: /vaults/<slug>. */
  slug: string;
  name: string;
  protocol: string;
  /** Names the protocol's logo file in the frontend. */
  protocolSlug: string;
  /** Who manages its risk; "" when the protocol runs it itself. */
  curator: string;
  curatorSlug: string;
  asset: string;
  /** "$12.4M" */
  deposits: string;
  /** "5.12%" */
  apy: string;
  /** What the yield includes, or "". */
  apyNote: string;
  url: string;
};

export type Vaults = {
  vaults: Vault[];
  /** The assets that have at least one vault, for the filter. */
  assets: string[];
  /** "21 Nov 2026" */
  asOf: string;
  total: string;
  sources: { name: string; url: string }[];
};

// --- one vault's page ----------------------------------------------------------

/** One day on a vault's chart: where it sits (0..1) and what it reads. */
export type SeriesPoint = { x: number; y: number; value: string; when: string };

export type SeriesRange = { id: string; points: SeriesPoint[]; high: SeriesPoint; low: SeriesPoint; from: string; to: string };

/** A chart the page can switch to: yield over time, or deposits over time. */
export type Series = { id: string; label: string; ranges: SeriesRange[] };

export type VaultStat = { label: string; value: string; note: string };

/** One place the vault's money goes (a market, an inner vault, or idle). */
export type VaultMarket = { name: string; share: string; amount: string; utilization: string; apy: string; safety: string };

export type VaultRole = { label: string; value: string; note: string };

/**
 * The "How It Works" diagram: the deposit, the vault, where it lends, and the
 * interest coming back, with one numbered step explaining each.
 */
export type VaultFlow = {
  deposit: string;
  vault: string;
  vaultNote: string;
  branches: { title: string; note: string }[];
  back: string;
  /** Four steps, in order: deposit, allocate, borrow, interest returns. */
  steps: { title: string; text: string }[];
};

export type VaultDetail = {
  vault: Vault;
  description: string;
  address: string;
  /** "" when the live figures were read; otherwise why they could not be. */
  problem: string;
  /** "Read from Morpho at 20:41" */
  read: string;
  stats: VaultStat[];
  series: Series[];
  marketsTitle: string;
  markets: VaultMarket[];
  roles: VaultRole[];
  flow: VaultFlow;
};
