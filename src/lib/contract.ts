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
  decimals: string;
  source: string;
};

export type Limit = {
  asset: string;
  badge: string;
  perPayment: string;
  total: string;
  used: string;
  left: string;
  usedPercent: string;   // "0".."100": how much of the total is used
};

/** What an operation did, as a meaning. The frontend picks the picture. */
export type Direction = "out" | "in" | "self" | "approve" | "refused";

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
 * The native balance over time. x and y are fractions from 0 to 1: x across
 * the block span, y up the balance range. The frontend scales them to
 * whatever chart it draws; the labels carry the actual amounts.
 */
export type History = {
  points: { x: number; y: number; block: string; balance: string }[];
  high: string;
  low: string;
  from: string;
  to: string;
};

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
  block: string;
  wallet: { address: string; short: string; url: string };
  verdict: { tone: Tone; label: string; counts: string };
  /** The headline balance, split so whole units and decimals can be set apart. */
  total: { whole: string; fraction: string; asset: string };
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
};
