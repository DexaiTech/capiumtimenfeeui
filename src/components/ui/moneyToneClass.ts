/**
 * What an amount means: `in` is money received or earned (green), `out` is money owed, spent or
 * lost (red), `auto` follows the sign (a positive adjustment green, a negative one red).
 */
export type MoneyKind = 'in' | 'out' | 'auto';

/** The text colour class of an amount, or '' when it has none. */
export function moneyToneClass(kind: MoneyKind, value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '';
  if (kind === 'in') return value > 0 ? 'text-success' : 'text-danger';
  if (kind === 'out') return value > 0 ? 'text-danger' : 'text-success';
  return value > 0 ? 'text-success' : 'text-danger';
}
