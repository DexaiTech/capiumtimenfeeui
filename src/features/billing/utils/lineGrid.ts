/**
 * The figures of an invoice's line grid as it is typed (Create invoice, a draft): each row's net
 * and VAT the way the API works them out (`lineMaths`), and the totals.
 */
import type { BasisPoints, Pence } from '@/types/api';
import { parsePounds } from '@/utils/money';

import type { BadgeTone } from '@/components/ui';

import type { GridLineValues } from '../schemas/forms';
import type { ServiceOption } from '../types';
import { lineNet, parseQuantity, totalsOf, type PricedLine } from './lineMaths';
import { vatRateOf, type PreviewTotals, type VatDefaults } from './prepare';

/** What the grid shows of a row besides what is typed in it. */
export interface LineGridMeta {
  /** The kind of line, as a badge (Time, Fixed fee, Fees in advance, …). */
  label?: { text: string; tone: BadgeTone };
  /** More about the line, after the badge ("billed from 2 WIP items"). */
  note?: string;
  /** A row of work: the work's quantity and unit price, shown as they are. */
  quantity?: string | null;
  unitAmount?: Pence | null;
  /** A row of work: what the work is worth; billing more writes on, less writes off. */
  wip?: Pence;
  /** A row of work in Create invoice: what it bills when the amount is left empty (null: a fixed fee the API prices). */
  net?: Pence | null;
  /** The line's service, by name (a saved line keeps its service). */
  serviceName?: string | null;
  /** The VAT code of the work's service: applies after the client's own. */
  serviceVatRateId?: string | null;
  /** The VAT code a saved line has, and its rate (kept when the code is archived). */
  savedVat?: { id: string; rate_bp: BasisPoints } | null;
}

export type LineGridMetas = ReadonlyMap<string, LineGridMeta>;

/** What the first row of fees in advance reads until a service or the person words it. */
export const FIRST_DESCRIPTION = 'Fees in advance';

/** A row typed in: quantity 1, the rest empty. */
export const newGridLine = (description = ''): GridLineValues => ({
  key: '',
  wip: false,
  description,
  quantity: '1',
  unit_amount: '',
  net_amount: '',
  vat_rate_id: '',
  service_id: '',
});

export interface PricedGridLine {
  /** Null while it does not add up yet, or for a fixed fee the API prices. */
  net: Pence | null;
  vatBp: BasisPoints;
}

/** One row: net = quantity x unit price (or the amount billed for work), VAT at its code's rate. */
export function priceGridLine(
  line: GridLineValues,
  meta: LineGridMeta | undefined,
  vat: VatDefaults,
  services: ReadonlyArray<ServiceOption>,
): PricedGridLine {
  let net: Pence | null;
  if (line.wip) {
    net = line.net_amount.trim() === '' ? (meta?.net ?? null) : parsePounds(line.net_amount);
  } else {
    const quantity = parseQuantity(line.quantity);
    const unit = parsePounds(line.unit_amount);
    net = quantity === null || unit === null ? null : lineNet(quantity, unit);
  }
  const chosen = line.vat_rate_id || null;
  const vatBp =
    meta?.savedVat && chosen === meta.savedVat.id
      ? meta.savedVat.rate_bp
      : vatRateOf(
          vat,
          chosen,
          meta?.serviceVatRateId ??
            services.find((service) => service.id === line.service_id)?.vat_rate_id ??
            null,
        );
  return { net, vatBp };
}

/** The totals of the rows that add up; `unpriced` counts the others. */
export function gridTotals(
  lines: ReadonlyArray<GridLineValues>,
  metas: LineGridMetas,
  vat: VatDefaults,
  services: ReadonlyArray<ServiceOption>,
): PreviewTotals {
  const priced: PricedLine[] = [];
  for (const line of lines) {
    const meta = metas.get(line.key);
    const { net, vatBp } = priceGridLine(line, meta, vat, services);
    if (net !== null) priced.push({ net, vatBp, wip: line.wip ? (meta?.wip ?? null) : null });
  }
  return { ...totalsOf(priced), unpriced: lines.length - priced.length };
}
