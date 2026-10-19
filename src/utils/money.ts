/**
 * Money is an integer number of minor units (pence) in the practice currency, never a float
 * (`docs/domain.md`, "Conventions"). These helpers convert between pence and what people read
 * and type, through strings, so no binary floating point ever touches an amount.
 */

const LOCALE = 'en-GB';

const formatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string): Intl.NumberFormat {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency });
    formatters.set(currency, formatter);
  }
  return formatter;
}

/** The number of minor-unit digits of a currency: 2 for GBP, 0 for JPY. */
export function minorDigits(currency = 'GBP'): number {
  return currencyFormatter(currency).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Pence as an exact decimal string of the major unit: 123456 → "1234.56", -5 → "-0.05".
 * Integer string arithmetic only.
 */
export function penceToDecimalString(pence: number, currency = 'GBP'): string {
  if (!Number.isSafeInteger(pence)) throw new RangeError(`Not a whole number of pence: ${pence}`);
  const digits = minorDigits(currency);
  const negative = pence < 0;
  const absolute = String(Math.abs(pence)).padStart(digits + 1, '0');
  const major = digits === 0 ? absolute : absolute.slice(0, -digits);
  const minor = digits === 0 ? '' : `.${absolute.slice(-digits)}`;
  return `${negative ? '-' : ''}${major}${minor}`;
}

/** 123456 → "£1,234.56"; -5 → "-£0.05". `null` and `undefined` give an empty string. */
export function formatMoney(pence: number | null | undefined, currency = 'GBP'): string {
  if (pence === null || pence === undefined) return '';
  // Intl formats a decimal string exactly (no conversion to a binary float).
  return currencyFormatter(currency).format(
    penceToDecimalString(pence, currency) as Intl.StringNumericLiteral,
  );
}

const POUNDS_PATTERN = /^(-)?(\d*)(?:\.(\d*))?$/;

/**
 * Parses what a person typed as an amount in pounds into whole pence:
 * "1,234.5" → 123450, "£12" → 1200, ".5" → 50, "-3.25" → -325.
 * Thousands separators, a leading currency symbol and spaces are ignored. More decimals than
 * the currency has, or anything that is not a number, gives `null`.
 */
export function parsePounds(input: string, currency = 'GBP'): number | null {
  const digits = minorDigits(currency);
  const cleaned = input
    .trim()
    .replace(/[\s,]/g, '')
    .replace(/^(-?)[£$€]/, '$1');
  const match = POUNDS_PATTERN.exec(cleaned);
  if (!match) return null;
  const [, sign, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') return null;
  if (fraction.length > digits) return null;
  const pence = Number(`${whole || '0'}${fraction.padEnd(digits, '0')}`);
  if (!Number.isSafeInteger(pence)) return null;
  return sign && pence !== 0 ? -pence : pence;
}

/**
 * Pence as the text of an amount input: 123450 → "1234.50" (no symbol, no separators, so it
 * parses back with `parsePounds`).
 */
export function penceToPoundsInput(pence: number | null | undefined, currency = 'GBP'): string {
  if (pence === null || pence === undefined) return '';
  return penceToDecimalString(pence, currency);
}

/** The symbol of a currency in the practice locale: "£" for GBP. */
export function currencySymbol(currency = 'GBP'): string {
  return (
    currencyFormatter(currency)
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  );
}

/** Basis points as a percentage: 2000 → "20%", 1750 → "17.5%". */
export function formatBasisPoints(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return '—';
  const whole = Math.trunc(bp / 100);
  const rest = Math.abs(bp % 100);
  if (rest === 0) return `${whole}%`;
  const fraction = String(rest).padStart(2, '0').replace(/0$/, '');
  return `${bp < 0 && whole === 0 ? '-' : ''}${whole}.${fraction}%`;
}
