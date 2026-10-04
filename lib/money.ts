/**
 * Money as integer fils (AED × 100). Every sum, product and percentage on
 * money goes through this file so nothing is ever computed in floating point.
 *
 * 1,234.56 AED is 123456. Rounding is half up to the nearest fils, applied
 * once per line; totals are sums of already-rounded lines.
 *
 * Amounts stay well inside Number.MAX_SAFE_INTEGER (about 90 trillion AED),
 * and every function checks that its inputs are whole fils.
 */

export type Fils = number;

/** Basis points: 500 = 5 %. */
export type BasisPoints = number;

export const VAT_BPS: BasisPoints = 500;

function assertFils(value: number, what = "amount"): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${what} must be a whole number of fils, got ${value}`);
}

/**
 * Divide a / b and round half up (half away from zero), on integers only.
 * Matches Postgres round(numeric) for the positive and negative amounts we use.
 */
export function divRoundHalfUp(a: number, b: number): number {
  assertFils(a, "dividend");
  assertFils(b, "divisor");
  if (b === 0) throw new RangeError("division by zero");
  const sign = Math.sign(a) * Math.sign(b);
  const n = Math.abs(a);
  const d = Math.abs(b);
  const q = Math.floor(n / d);
  const r = n - q * d;
  const rounded = 2 * r >= d ? q + 1 : q;
  return sign * rounded;
}

/**
 * Parse what someone typed ("1,234.5", "625", "AED 12.34") into fils.
 * Rejects anything with more than two decimals or that isn't a number.
 */
export function toFils(input: string): Fils {
  const cleaned = input.trim().replace(/^AED\s*/i, "").replace(/,/g, "");
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    if (/^-?\d+\.\d{3,}$/.test(cleaned)) throw new RangeError(`More than two decimals: ${input}`);
    throw new RangeError(`Not an amount: ${input}`);
  }
  const [, minus, whole, decimals = ""] = match;
  const fils = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  assertFils(fils);
  return minus ? -fils : fils;
}

/** toFils that returns null instead of throwing, for form fields. */
export function tryFils(input: string): Fils | null {
  try {
    return toFils(input);
  } catch {
    return null;
  }
}

/**
 * A numeric(…,2) value from the database (Supabase returns it as a number or
 * a string) as fils. The value already has at most two decimals, so rounding
 * to the nearest fils only removes binary representation noise.
 */
export function fromNumeric(value: number | string | null | undefined): Fils {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") return toFils(value);
  if (!Number.isFinite(value)) return 0;
  // Work from the number's shortest decimal form ("1.005"), not value × 100
  // (100.49999…), so extra decimals round half up the way a person would.
  const text = String(value);
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    const fils = Math.round(value * 100); // exponent forms like 1e-7
    assertFils(fils);
    return fils;
  }
  const [, minus, whole, decimals = ""] = match;
  let fils = Number(whole) * 100 + Number(decimals.slice(0, 2).padEnd(2, "0"));
  if (decimals.length > 2 && Number(decimals[2]) >= 5) fils += 1;
  assertFils(fils);
  return minus ? -fils : fils;
}

/** Fils as a plain decimal number of AED, for writing to numeric(…,2) columns. */
export function toNumeric(fils: Fils): number {
  assertFils(fils);
  return fils / 100;
}

/** "1,234.56" — two decimals, thousands separated. */
export function fromFils(fils: Fils): string {
  assertFils(fils);
  const negative = fils < 0;
  const abs = Math.abs(fils);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${cents}`;
}

/** "AED 1,234.56" */
export const formatAed = (fils: Fils): string => `AED ${fromFils(fils)}`;

export function add(...amounts: Fils[]): Fils {
  let total = 0;
  for (const a of amounts) {
    assertFils(a);
    total += a;
  }
  assertFils(total, "total");
  return total;
}

/** Sum a list, e.g. payments. */
export const sum = (amounts: readonly Fils[]): Fils => add(...amounts);

export function subtract(a: Fils, b: Fils): Fils {
  assertFils(a);
  assertFils(b);
  const out = a - b;
  assertFils(out, "result");
  return out;
}

/** An amount times a whole quantity (guests, units). */
export function multiply(amount: Fils, quantity: number): Fils {
  assertFils(amount);
  if (!Number.isSafeInteger(quantity)) throw new RangeError(`quantity must be a whole number, got ${quantity}`);
  const out = amount * quantity;
  assertFils(out, "result");
  return out;
}

/** A percentage of an amount, rate in basis points, rounded half up. percent(100000, 500) = 5000. */
export function percent(amount: Fils, bps: BasisPoints): Fils {
  assertFils(amount);
  assertFils(bps, "rate");
  return divRoundHalfUp(amount * bps, 10_000);
}

/**
 * The tax inside a VAT-inclusive amount: taxable = round(gross / 1.05),
 * vat = round(taxable × 5 %). The same steps as the set_visa_vat trigger.
 */
export function splitInclusive(gross: Fils, bps: BasisPoints = VAT_BPS): { taxable: Fils; vat: Fils } {
  assertFils(gross);
  const taxable = divRoundHalfUp(gross * 10_000, 10_000 + bps);
  return { taxable, vat: percent(taxable, bps) };
}

/**
 * Convert a foreign-currency amount to AED with an exchange rate held as an
 * integer with six decimals (3.672500 → 3672500). Rounded half up once.
 */
export function convertToAed(foreign: Fils, rateMicros: number): Fils {
  assertFils(foreign);
  if (!Number.isSafeInteger(rateMicros) || rateMicros <= 0) throw new RangeError(`bad exchange rate ${rateMicros}`);
  // Split to stay inside safe integers for large amounts.
  const whole = Math.floor(rateMicros / 1_000_000);
  const fraction = rateMicros - whole * 1_000_000;
  return add(multiply(foreign, whole), divRoundHalfUp(foreign * fraction, 1_000_000));
}

/**
 * For code that still holds AED as numbers (values read from numeric(…,2)
 * columns): add them in fils and hand back AED, so the sum is exact.
 */
export const addAed = (a: number, b: number): number => toNumeric(fromNumeric(a) + fromNumeric(b));

export const sumAed = (values: readonly (number | string | null | undefined)[]): number =>
  toNumeric(values.reduce<number>((total, v) => total + fromNumeric(v), 0));
