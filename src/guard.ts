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
 * Here that becomes allowedRecipients (who may receive) and limits (how much
 * per payment, how much in total). There is no time-based limit. Pure
 * functions, no network, no signing, no dependencies. Fully testable offline,
 * and the same file can run in the browser.
 *
 * Money is never a JavaScript number. Amounts come in as decimal strings
 * ("0.1") and are compared as bigint wei, which is exact at any size.
 */

// USDC is the native gas token on Arc and uses 18 decimals here.
// On every other chain USDC is 6 decimals. Getting this wrong is a
// factor-of-a-trillion error, so it lives in one named place.
export const ARC_USDC_DECIMALS = 18;
export const WEI_PER_USDC = 10n ** BigInt(ARC_USDC_DECIMALS);

/** A mandate that makes no sense. A setup bug, not a refused payment. */
export class MandateError extends Error {
  name = "MandateError";
}

/** What the signer may do. Frozen: a mandate is not edited mid-run. */
export type Mandate = Readonly<{
  allowedRecipients: readonly string[];
  maxAmountUsdc: string;
  maxTotalUsdc: string;
  chainId: number;
}>;

export function makeMandate(m: {
  allowedRecipients: readonly string[];
  maxAmountUsdc: string;
  maxTotalUsdc: string;
  chainId: number;
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
  // Object.freeze is shallow, so the list is frozen separately.
  return Object.freeze({
    allowedRecipients: Object.freeze([...m.allowedRecipients]),
    maxAmountUsdc: m.maxAmountUsdc,
    maxTotalUsdc: m.maxTotalUsdc,
    chainId: m.chainId,
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
 * Decide whether one payment is permitted. Returns a Verdict.
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

/** USDC decimal string to wei bigint. Exact: no number ever touches a value. */
export function toWei(amountUsdc: string): bigint {
  if (typeof amountUsdc !== "string") {
    throw new TypeError('pass a decimal string like "0.1", not a number');
  }
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amountUsdc);
  if (m === null) {
    throw new RangeError(`not a plain decimal amount: ${JSON.stringify(amountUsdc)}`);
  }
  const [, sign, whole = "0", rawFrac = ""] = m;
  const frac = rawFrac.replace(/0+$/, "");
  if (frac.length > ARC_USDC_DECIMALS) {
    throw new RangeError(`${amountUsdc} USDC is not a whole number of wei`);
  }
  const wei = BigInt(whole) * WEI_PER_USDC + BigInt(frac.padEnd(ARC_USDC_DECIMALS, "0"));
  return sign === "-" ? -wei : wei;
}

/** wei bigint to USDC decimal string. null stays null. */
export function fromWei(wei: bigint | null): string | null {
  if (wei === null) {
    return null;
  }
  const sign = wei < 0n ? "-" : "";
  const abs = wei < 0n ? -wei : wei;
  const whole = (abs / WEI_PER_USDC).toString();
  const frac = (abs % WEI_PER_USDC)
    .toString()
    .padStart(ARC_USDC_DECIMALS, "0")
    .replace(/0+$/, "");
  return sign + whole + (frac ? `.${frac}` : "");
}
