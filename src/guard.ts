/**
 * The mandate. What this account is permitted to do.
 *
 * The pattern is taken from dHedge/Chamber's V2-Public contracts, which hold
 * ~$23.5M behind it: the money sits somewhere whose own rules decide which
 * outbound calls are legal. The signer is not trusted; the boundary is.
 *
 * dHedge splits this two ways and both are needed:
 *
 *   assetGuards    - what may be HELD
 *   contractGuards - what may be CALLED
 *
 * Here that becomes allowedRecipients (who may receive), limits (how much
 * per payment, how much in total, per asset) and allowedSpenders (who may be
 * given an approval). There is no time-based limit. Pure functions, no
 * network, no signing, no dependencies. Fully testable offline, and the same
 * file can run in the browser.
 *
 * Money is never a JavaScript number. Amounts come in as decimal strings
 * ("0.1") and are compared as bigint base units, which is exact at any size.
 *
 * A token transfer is a contract call: its `value` is 0 and the amount lives
 * in the calldata. checkIntent judges the DECODED call (see intent.ts), never
 * the value field, or a transfer of a billion tokens would pass as "0".
 */

// USDC is the native gas token on Arc and uses 18 decimals here.
// On every other chain USDC is 6 decimals. Getting this wrong is a
// factor-of-a-trillion error, so it lives in one named place.
export const ARC_USDC_DECIMALS = 18;
export const WEI_PER_USDC = 10n ** BigInt(ARC_USDC_DECIMALS);

// The same USDC, seen through its ERC-20 contract: 6 decimals. Moving it there
// moves the native balance too, so it counts against the same USDC limits.
export const ARC_USDC_TOKEN = "0x3600000000000000000000000000000000000000";
export const ARC_USDC_TOKEN_DECIMALS = 6;

// An approval at or above this is "take everything, forever". Wallets and
// DEXes default to 2^256 - 1; it is always refused.
export const UNBOUNDED_APPROVAL = 2n ** 255n;

/** A mandate that makes no sense. A setup bug, not a refused payment. */
export class MandateError extends Error {
  name = "MandateError";
}

/** Limits for one ERC-20 token other than USDC. */
export type TokenRule = Readonly<{
  address: string;
  symbol: string;
  decimals: number;
  maxAmount: string;
  maxTotal: string;
}>;

/** What the signer may do. Frozen: a mandate is not edited mid-run. */
export type Mandate = Readonly<{
  allowedRecipients: readonly string[];
  maxAmountUsdc: string;
  maxTotalUsdc: string;
  chainId: number;
  tokens: readonly TokenRule[];
  allowedSpenders: readonly string[];
}>;

export function makeMandate(m: {
  allowedRecipients: readonly string[];
  maxAmountUsdc: string;
  maxTotalUsdc: string;
  chainId: number;
  tokens?: readonly TokenRule[];
  allowedSpenders?: readonly string[];
}): Mandate {
  const maxAmount = toWei(m.maxAmountUsdc);
  const maxTotal = toWei(m.maxTotalUsdc);
  if (maxAmount <= 0n) {
    throw new MandateError("maxAmountUsdc must be positive");
  }
  if (maxTotal < maxAmount) {
    throw new MandateError("maxTotalUsdc cannot be below maxAmountUsdc");
  }
  if (m.allowedRecipients.length === 0) {
    throw new MandateError("a mandate with no allowed recipients permits nothing");
  }
  for (const t of m.tokens ?? []) {
    const address = normalise(t.address);
    if (address === null) {
      throw new MandateError(`token ${t.symbol} has a malformed address: ${t.address}`);
    }
    if (address === ARC_USDC_TOKEN) {
      throw new MandateError("USDC is governed by maxAmountUsdc/maxTotalUsdc, not a token rule");
    }
    if (!Number.isInteger(t.decimals) || t.decimals < 0 || t.decimals > 36) {
      throw new MandateError(`token ${t.symbol} has impossible decimals: ${t.decimals}`);
    }
    if (toUnits(t.maxAmount, t.decimals) <= 0n) {
      throw new MandateError(`token ${t.symbol}: maxAmount must be positive`);
    }
    if (toUnits(t.maxTotal, t.decimals) < toUnits(t.maxAmount, t.decimals)) {
      throw new MandateError(`token ${t.symbol}: maxTotal cannot be below maxAmount`);
    }
  }
  for (const s of m.allowedSpenders ?? []) {
    if (normalise(s) === null) {
      throw new MandateError(`malformed spender address: ${s}`);
    }
  }
  // Object.freeze is shallow, so every list and rule is frozen separately.
  return Object.freeze({
    allowedRecipients: Object.freeze([...m.allowedRecipients]),
    maxAmountUsdc: m.maxAmountUsdc,
    maxTotalUsdc: m.maxTotalUsdc,
    chainId: m.chainId,
    tokens: Object.freeze((m.tokens ?? []).map((t) => Object.freeze({ ...t }))),
    allowedSpenders: Object.freeze([...(m.allowedSpenders ?? [])]),
  });
}

/** Binary. Allowed or not, with the reason stated. */
export type Verdict = Readonly<{ allowed: boolean; reason: string }>;

const allow = (reason: string): Verdict => Object.freeze({ allowed: true, reason });
const refuse = (reason: string): Verdict => Object.freeze({ allowed: false, reason });

/** Lowercase an address for comparison. Never use for display. */
export function normalise(address: unknown): string | null {
  if (typeof address !== "string") {
    return null;
  }
  const a = address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(a)) {
    return null;
  }
  return a;
}

/**
 * Decide whether one native USDC payment is permitted. Returns a Verdict.
 *
 * Every rejection names its own reason. An unparseable input is rejected,
 * never coerced into something that looks valid. `to` and `amountUsdc` are
 * typed `unknown` on purpose: they may come from a form or a file, and the
 * guard checks them at runtime instead of trusting the type.
 */
export function check(
  mandate: Mandate,
  {
    to,
    amountUsdc,
    chainId,
    alreadySentUsdc = "0",
  }: { to: unknown; amountUsdc: unknown; chainId: number; alreadySentUsdc?: string },
): Verdict {
  const dest = normalise(to);
  if (dest === null) {
    return refuse(`malformed recipient address: ${JSON.stringify(to)}`);
  }

  if (chainId !== mandate.chainId) {
    return refuse(
      `wrong chain: transaction is for ${chainId}, ` +
        `mandate permits ${mandate.chainId}`,
    );
  }

  if (typeof amountUsdc !== "string") {
    return refuse('amount must be a decimal string like "0.1", not a number');
  }

  let amount: bigint;
  try {
    amount = toWei(amountUsdc);
  } catch {
    return refuse(`amount is not a valid USDC amount: ${JSON.stringify(amountUsdc)}`);
  }

  if (amount <= 0n) {
    return refuse(`amount must be positive, got ${amountUsdc}`);
  }

  const allowed = new Set(mandate.allowedRecipients.map(normalise));
  if (!allowed.has(dest)) {
    return refuse(`recipient not on the allowlist: ${dest}`);
  }

  if (amount > toWei(mandate.maxAmountUsdc)) {
    return refuse(
      `amount ${amountUsdc} exceeds per-payment limit ` +
        `${mandate.maxAmountUsdc}`,
    );
  }

  const running = toWei(alreadySentUsdc) + amount;
  if (running > toWei(mandate.maxTotalUsdc)) {
    return refuse(
      `cumulative ${fromWei(running)} would exceed total limit ` +
        `${mandate.maxTotalUsdc}`,
    );
  }

  return allow("within mandate");
}

// --- any transaction: judged on what it decodes to --------------------------

/** What a transaction actually does, decoded from its bytes by intent.ts. */
export type Intent =
  | { kind: "native"; to: string; amount: bigint }                    // amount in wei
  | { kind: "transfer"; token: string; to: string; amount: bigint }   // token base units
  | { kind: "approve"; token: string; spender: string; amount: bigint }
  | { kind: "unknown"; reason: string };

/** Totals already sent, per asset symbol, as decimal strings. */
export type Spent = Readonly<Record<string, string>>;

/**
 * Decide whether one transaction is permitted, from its decoded intent.
 *
 * `decimals` is the token's decimals as read from the chain. For tokens it is
 * compared with the mandate's own figure, so a wrong decimals value anywhere
 * is refused instead of silently scaling an amount by a trillion.
 */
export function checkIntent(
  mandate: Mandate,
  intent: Intent,
  { chainId, decimals, alreadySent = {} }: { chainId: number; decimals?: number; alreadySent?: Spent },
): Verdict {
  if (intent.kind === "unknown") {
    return refuse(`not a payment this guard understands: ${intent.reason}`);
  }

  if (intent.kind === "native") {
    return check(mandate, {
      to: intent.to,
      amountUsdc: fromWei(intent.amount),
      chainId,
      alreadySentUsdc: alreadySent.USDC ?? "0",
    });
  }

  if (chainId !== mandate.chainId) {
    return refuse(`wrong chain: transaction is for ${chainId}, mandate permits ${mandate.chainId}`);
  }
  const token = normalise(intent.token);
  if (token === null) {
    return refuse(`malformed token address: ${JSON.stringify(intent.token)}`);
  }
  const rule = mandate.tokens.find((t) => normalise(t.address) === token);
  if (token !== ARC_USDC_TOKEN && rule === undefined) {
    return refuse(`token not in the mandate: ${token}`);
  }
  if (decimals === undefined || !Number.isInteger(decimals)) {
    return refuse("token decimals were not read from the chain");
  }

  // USDC's token view: same money, same limits as the native balance.
  if (token === ARC_USDC_TOKEN || rule === undefined) {
    if (decimals !== ARC_USDC_TOKEN_DECIMALS) {
      return refuse(`USDC token reports ${decimals} decimals, expected ${ARC_USDC_TOKEN_DECIMALS}`);
    }
    if (intent.kind === "approve") {
      // Compared at 18 decimals, like every other USDC amount and total.
      const scale = 10n ** BigInt(ARC_USDC_DECIMALS - ARC_USDC_TOKEN_DECIMALS);
      return checkApprove(
        mandate,
        { spender: intent.spender, amount: intent.amount * scale },
        {
          symbol: "USDC",
          decimals: ARC_USDC_DECIMALS,
          maxAmount: mandate.maxAmountUsdc,
          maxTotal: mandate.maxTotalUsdc,
        },
        alreadySent,
      );
    }
    return check(mandate, {
      to: intent.to,
      amountUsdc: fromUnits(intent.amount, decimals),
      chainId,
      alreadySentUsdc: alreadySent.USDC ?? "0",
    });
  }

  if (decimals !== rule.decimals) {
    return refuse(
      `decimals mismatch for ${rule.symbol}: mandate says ${rule.decimals}, chain says ${decimals}`,
    );
  }

  if (intent.kind === "approve") {
    return checkApprove(mandate, intent, rule, alreadySent);
  }

  const dest = normalise(intent.to);
  if (dest === null) {
    return refuse(`malformed recipient address: ${JSON.stringify(intent.to)}`);
  }
  if (intent.amount <= 0n) {
    return refuse(`amount must be positive, got ${fromUnits(intent.amount, decimals)} ${rule.symbol}`);
  }
  if (!new Set(mandate.allowedRecipients.map(normalise)).has(dest)) {
    return refuse(`recipient not on the allowlist: ${dest}`);
  }
  if (intent.amount > toUnits(rule.maxAmount, decimals)) {
    return refuse(
      `amount ${fromUnits(intent.amount, decimals)} ${rule.symbol} exceeds per-payment limit ${rule.maxAmount}`,
    );
  }
  const running = toUnits(alreadySent[rule.symbol] ?? "0", decimals) + intent.amount;
  if (running > toUnits(rule.maxTotal, decimals)) {
    return refuse(
      `cumulative ${fromUnits(running, decimals)} ${rule.symbol} would exceed total limit ${rule.maxTotal}`,
    );
  }
  return allow("within mandate");
}

/**
 * An approval lets someone else take your tokens later, without asking you
 * again. So: never unbounded, only to a listed spender, never more than one
 * payment's worth, and it counts against the total as if already spent.
 */
function checkApprove(
  mandate: Mandate,
  intent: { spender: string; amount: bigint },
  limit: { symbol: string; decimals: number; maxAmount: string; maxTotal: string },
  alreadySent: Spent,
): Verdict {
  const spender = normalise(intent.spender);
  if (intent.amount >= UNBOUNDED_APPROVAL) {
    return refuse(
      `unbounded approval of ${limit.symbol} to ${spender ?? intent.spender}: ` +
        "a standing permission to take everything",
    );
  }
  if (spender === null) {
    return refuse(`malformed spender address: ${JSON.stringify(intent.spender)}`);
  }
  if (!new Set(mandate.allowedSpenders.map(normalise)).has(spender)) {
    return refuse(`spender not allowed: ${spender}`);
  }
  if (intent.amount > toUnits(limit.maxAmount, limit.decimals)) {
    return refuse(
      `approval of ${fromUnits(intent.amount, limit.decimals)} ${limit.symbol} ` +
        `exceeds the per-payment limit ${limit.maxAmount}`,
    );
  }
  const running = toUnits(alreadySent[limit.symbol] ?? "0", limit.decimals) + intent.amount;
  if (running > toUnits(limit.maxTotal, limit.decimals)) {
    return refuse(`approval would take ${limit.symbol} past its total limit ${limit.maxTotal}`);
  }
  return allow("within mandate");
}

// --- units ---------------------------------------------------------------------

/** Decimal string to base units. Exact: no number ever touches a value. */
export function toUnits(amount: string, decimals: number): bigint {
  if (typeof amount !== "string") {
    throw new TypeError('pass a decimal string like "0.1", not a number');
  }
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
  if (m === null) {
    throw new RangeError(`not a plain decimal amount: ${JSON.stringify(amount)}`);
  }
  const [, sign, whole = "0", rawFrac = ""] = m;
  const frac = rawFrac.replace(/0+$/, "");
  if (frac.length > decimals) {
    throw new RangeError(`${amount} has more than ${decimals} decimal places: not a whole number of base units`);
  }
  const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
  return sign === "-" ? -units : units;
}

/** Base units to decimal string. null stays null. */
export function fromUnits(units: bigint | null, decimals: number): string | null {
  if (units === null) {
    return null;
  }
  const scale = 10n ** BigInt(decimals);
  const sign = units < 0n ? "-" : "";
  const abs = units < 0n ? -units : units;
  const whole = (abs / scale).toString();
  const frac = decimals === 0
    ? ""
    : (abs % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return sign + whole + (frac ? `.${frac}` : "");
}

/** USDC decimal string to wei bigint (18 decimals on Arc). */
export function toWei(amountUsdc: string): bigint {
  return toUnits(amountUsdc, ARC_USDC_DECIMALS);
}

/** wei bigint to USDC decimal string. null stays null. */
export function fromWei(wei: bigint | null): string | null {
  return fromUnits(wei, ARC_USDC_DECIMALS);
}
