/**
 * Invoice arithmetic, mirroring the API (`app/utils/money.py`): integer pence, rounding half away
 * from zero, VAT rounded per line. Used where the screen shows figures before the server has
 * calculated them (the draft being prepared, a line being edited).
 */
import type { BasisPoints, Pence } from '@/types/api';

import type { VatSummaryRow } from '../types';

/** `numerator / denominator` rounded half away from zero, through BigInt (no float, no overflow). */
function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const top = numerator < 0n ? -numerator : numerator;
  const bottom = denominator < 0n ? -denominator : denominator;
  const quotient = (2n * top + bottom) / (2n * bottom);
  return negative ? -quotient : quotient;
}

/** VAT on a net amount at a rate in basis points (2000 = 20%), rounded per line. */
export function vatOn(net: Pence, rateBp: BasisPoints): Pence {
  return Number(divideHalfUp(BigInt(net) * BigInt(rateBp), 10_000n));
}

/** A decimal quantity as typed ("1.5", "2") in hundredths, or null when it is not a quantity. */
export function parseQuantity(text: string): number | null {
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const hundredths = Number(`${match[1] ?? '0'}${(match[2] ?? '').padEnd(2, '0')}`);
  return hundredths > 0 ? hundredths : null;
}

/** Hundredths as the API writes a quantity: 150 → "1.50". */
export function formatQuantity(hundredths: number): string {
  const whole = Math.trunc(hundredths / 100);
  return `${whole}.${String(hundredths % 100).padStart(2, '0')}`;
}

/** `round(quantity x unit amount)`; the quantity is in hundredths. */
export function lineNet(quantityHundredths: number, unitAmount: Pence): Pence {
  return Number(divideHalfUp(BigInt(quantityHundredths) * BigInt(unitAmount), 100n));
}

/** The unit amount that makes `quantity x unit` read as `net` (what the API stores after an override). */
export function unitFor(net: Pence, quantityHundredths: number): Pence {
  return quantityHundredths === 100
    ? net
    : Number(divideHalfUp(BigInt(net) * 100n, BigInt(quantityHundredths)));
}

/** Minutes as hours to two decimal places, in hundredths of an hour, rounded half up. */
export function hoursHundredths(minutes: number): number {
  return Number(divideHalfUp(BigInt(minutes) * 100n, 60n));
}

/** The average hourly rate of `value` pence earned in `minutes`. */
export function averageRate(value: Pence, minutes: number): Pence {
  return minutes === 0 ? 0 : Number(divideHalfUp(BigInt(value) * 60n, BigInt(minutes)));
}

export interface PricedLine {
  /** What the invoice bills for the line. */
  net: Pence;
  vatBp: BasisPoints;
  /** The WIP value the line clears; null for a line that bills no WIP. */
  wip: Pence | null;
}

export interface InvoiceTotals {
  net: Pence;
  vat: Pence;
  gross: Pence;
  /** Total WIP value cleared by the lines. */
  wip: Pence;
  /** Billed minus WIP on the lines that bill WIP: negative is a write-off, positive a write-on. */
  adjustment: Pence;
}

export function totalsOf(lines: ReadonlyArray<PricedLine>): InvoiceTotals {
  let net = 0;
  let vat = 0;
  let wip = 0;
  let adjustment = 0;
  for (const line of lines) {
    net += line.net;
    vat += vatOn(line.net, line.vatBp);
    if (line.wip !== null) {
      wip += line.wip;
      adjustment += line.net - line.wip;
    }
  }
  return { net, vat, gross: net + vat, wip, adjustment };
}

/** VAT by rate, highest rate first, as the invoice prints it. */
export function vatSummaryOf(lines: ReadonlyArray<PricedLine>): VatSummaryRow[] {
  const byRate = new Map<number, VatSummaryRow>();
  for (const line of lines) {
    const row = byRate.get(line.vatBp) ?? { vat_rate_bp: line.vatBp, net: 0, vat: 0 };
    row.net += line.net;
    row.vat += vatOn(line.net, line.vatBp);
    byRate.set(line.vatBp, row);
  }
  return [...byRate.values()].sort((a, b) => b.vat_rate_bp - a.vat_rate_bp);
}

/** Sums pence without ever leaving integers. */
export function sumPence(values: ReadonlyArray<Pence>): Pence {
  return values.reduce((total, value) => total + value, 0);
}
