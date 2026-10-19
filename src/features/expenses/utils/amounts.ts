/**
 * The arithmetic of an expense line, as the API does it (`docs/modules/expenses.md`, "Amounts",
 * "Mileage", "Recharge"): whole pence, rates in basis points, rounding half up. The screens use
 * it to show what a line will come to while it is typed; the API computes and checks the result
 * again, so a difference here is only ever a preview that is off by a penny.
 */

const BASIS_POINTS = 10_000n;

/** `numerator / denominator` rounded half up, for non-negative whole numbers. */
function roundHalfUp(numerator: bigint, denominator: bigint): number {
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}

/** The VAT on a VAT-exclusive amount: `net × rate`. */
export function vatOnNet(net: number, rateBp: number): number {
  return roundHalfUp(BigInt(net) * BigInt(rateBp), BASIS_POINTS);
}

/** The VAT contained in a VAT-inclusive amount: `gross × rate ÷ (1 + rate)`. */
export function vatInGross(gross: number, rateBp: number): number {
  return roundHalfUp(BigInt(gross) * BigInt(rateBp), BASIS_POINTS + BigInt(rateBp));
}

export interface Amounts {
  net: number;
  vat: number;
  gross: number;
}

export interface GivenAmounts {
  net: number | null;
  vat: number | null;
  gross: number | null;
}

/**
 * What the amounts come to: any two of net, VAT and gross give the third; only the net gives
 * the VAT of the rate; only the gross gives the VAT contained in it. Null when nothing can be
 * worked out (nothing given, only a VAT, or a gross below the net).
 */
export function resolveAmounts(given: GivenAmounts, rateBp: number | null): Amounts | null {
  const { net, vat, gross } = given;
  const rate = rateBp ?? 0;
  if (net !== null && vat !== null) return { net, vat, gross: net + vat };
  if (net !== null && gross !== null) {
    return gross >= net ? { net, vat: gross - net, gross } : null;
  }
  if (vat !== null && gross !== null) {
    return gross >= vat ? { net: gross - vat, vat, gross } : null;
  }
  if (net !== null) {
    const computed = vatOnNet(net, rate);
    return { net, vat: computed, gross: net + computed };
  }
  if (gross !== null) {
    const computed = vatInGross(gross, rate);
    return { net: gross - computed, vat: computed, gross };
  }
  return null;
}

const MILES_PATTERN = /^\d{1,6}(?:\.\d{1,2})?$/;

/** Miles as typed ("42.5", "42.50"): at most two decimals, more than 0, below a million. */
export function parseMiles(input: string): string | null {
  const text = input.trim();
  if (!MILES_PATTERN.test(text)) return null;
  const hundredths = milesInHundredths(text);
  return hundredths > 0 && hundredths < 100_000_000 ? text : null;
}

/** `"42.5"` → 4250: miles as a whole number of hundredths, so no float is involved. */
function milesInHundredths(miles: string): number {
  const [whole = '0', fraction = ''] = miles.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** The net of a mileage line: miles × the practice's pence per mile, rounded half up. */
export function mileageNet(miles: string, ratePence: number): number {
  return roundHalfUp(BigInt(milesInHundredths(miles)) * BigInt(ratePence), 100n);
}

/** What a billable line is charged to the client: the net plus the markup, rounded half up. */
export function rechargeFor(net: number, markupBp: number): number {
  return roundHalfUp(BigInt(net) * (BASIS_POINTS + BigInt(markupBp)), BASIS_POINTS);
}
