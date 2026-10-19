/**
 * The lines the API will draft from the chosen WIP (`plan_lines` in `app/services/invoices.py`),
 * worked out here so the review step can show amounts, write-ons and write-offs and the totals
 * before anything is saved. Descriptions, quantities and amounts follow the API's rules; what
 * only the server knows (the unbilled part of a fixed fee) is flagged, not guessed.
 */
import type { BasisPoints, Pence } from '@/types/api';

import type { GroupBy, InvoiceCreate, LineOverride, VatOption, WipItem } from '../types';
import {
  averageRate,
  hoursHundredths,
  totalsOf,
  type InvoiceTotals,
  type PricedLine,
} from './lineMaths';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MAX_DESCRIPTION = 1000;
const FALLBACK_NAME = 'Professional services';

/** "2026-10-05" → "5 Oct 2026". */
function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  const name = MONTHS[Number(month) - 1] ?? '';
  return `${Number(day)} ${name} ${year ?? ''}`;
}

function period(dates: ReadonlyArray<string>): string {
  const sorted = [...dates].sort();
  const first = sorted[0] ?? '';
  const last = sorted[sorted.length - 1] ?? first;
  return first === last ? shortDate(first) : `${shortDate(first)} to ${shortDate(last)}`;
}

function clip(text: string): string {
  const flat = text.split(/\s+/).filter(Boolean).join(' ');
  return flat.length <= MAX_DESCRIPTION ? flat : `${flat.slice(0, MAX_DESCRIPTION - 3)}...`;
}

export type PlannedKind = 'time' | 'fixed_fee' | 'disbursement' | 'expense';

export interface PlannedLine {
  /** Stable while the selection and the grouping stay the same: edits are kept by it. */
  key: string;
  kind: PlannedKind;
  description: string;
  jobId: string | null;
  /** Hours in hundredths, for time lines. */
  quantity: number | null;
  /** The average hourly rate of a time line. */
  unitAmount: Pence | null;
  /** What the line bills before any edit; null for a fixed fee, which the server sets. */
  net: Pence | null;
  /** The WIP value of the items on the line. */
  wip: Pence;
  itemIds: string[];
  /** How the API's `overrides` find this line. */
  selector: Pick<LineOverride, 'time_entry_id' | 'disbursement_id'>;
}

function byDateThenId(a: WipItem, b: WipItem): number {
  return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}

function sumOf(items: ReadonlyArray<WipItem>): { minutes: number; value: Pence } {
  return items.reduce(
    (total, item) => ({
      minutes: total.minutes + (item.minutes ?? 0),
      value: total.value + item.value,
    }),
    { minutes: 0, value: 0 },
  );
}

function timeLine(key: string, description: string, items: WipItem[]): PlannedLine {
  const { minutes, value } = sumOf(items);
  return {
    key,
    kind: 'time',
    description: clip(description),
    jobId: items[0]?.job?.id ?? null,
    quantity: hoursHundredths(minutes),
    unitAmount: averageRate(value, minutes),
    net: value,
    wip: value,
    itemIds: items.map((item) => item.id),
    selector: { time_entry_id: items[0]?.id },
  };
}

function itemLine(item: WipItem): PlannedLine {
  const text = item.supplier
    ? `${item.description ?? ''} (${item.supplier})`
    : (item.description ?? '');
  const kind: PlannedKind = item.kind === 'expense' ? 'expense' : 'disbursement';
  return {
    key: `${kind}:${item.id}`,
    kind,
    description: clip(text || (kind === 'expense' ? 'Expense' : 'Disbursement')),
    jobId: item.job?.id ?? null,
    quantity: null,
    unitAmount: null,
    net: item.value,
    wip: item.value,
    itemIds: [item.id],
    selector: { disbursement_id: item.id },
  };
}

/** What the WIP says of a chosen fixed fee: the net the line bills and the WIP it clears. */
export interface FixedFeeFigures {
  net: Pence;
  wip: Pence;
}

/** The lines of the draft the API makes for `items`, in its order: fixed fees, time, then the rest. */
export function planLines(
  items: ReadonlyArray<WipItem>,
  groupBy: GroupBy,
  /** The figures of each chosen fixed fee by job id, when the WIP says (else the line is unpriced). */
  fixedFees: ReadonlyMap<string, FixedFeeFigures> = new Map(),
): PlannedLine[] {
  const time = items.filter((item) => item.kind === 'time').sort(byDateThenId);
  const fixed = new Map<string, WipItem[]>();
  const hourly: WipItem[] = [];
  for (const item of time) {
    if (item.job?.billing_basis === 'fixed') {
      fixed.set(item.job.id, [...(fixed.get(item.job.id) ?? []), item]);
    } else {
      hourly.push(item);
    }
  }

  const lines: PlannedLine[] = [];
  for (const [jobId, entries] of fixed) {
    const job = entries[0]?.job;
    const { value } = sumOf(entries);
    const fee = fixedFees.get(jobId);
    lines.push({
      key: `fixed:${jobId}`,
      kind: 'fixed_fee',
      description: clip(`${job?.name ?? FALLBACK_NAME} (fixed fee)`),
      jobId,
      quantity: 100,
      unitAmount: fee?.net ?? null,
      net: fee?.net ?? null,
      wip: fee?.wip ?? value,
      itemIds: entries.map((entry) => entry.id),
      selector: { time_entry_id: entries[0]?.id },
    });
  }

  if (groupBy === 'job') {
    const byJob = new Map<string, WipItem[]>();
    for (const item of hourly) {
      const key = item.job?.id ?? 'none';
      byJob.set(key, [...(byJob.get(key) ?? []), item]);
    }
    for (const [key, entries] of byJob) {
      const name = entries[0]?.job?.name ?? FALLBACK_NAME;
      lines.push(
        timeLine(`job:${key}`, `${name} (${period(entries.map((entry) => entry.date))})`, entries),
      );
    }
  } else if (groupBy === 'entry') {
    for (const item of hourly) {
      const label = item.description || item.job?.name || FALLBACK_NAME;
      lines.push(timeLine(`entry:${item.id}`, `${shortDate(item.date)}: ${label}`, [item]));
    }
  } else if (hourly.length > 0) {
    lines.push(
      timeLine('single', `${FALLBACK_NAME} (${period(hourly.map((entry) => entry.date))})`, hourly),
    );
  }

  const others = items.filter((item) => item.kind !== 'time').sort(byDateThenId);
  for (const item of others) lines.push(itemLine(item));
  return lines;
}

/** What the person changed on one line of the review. */
export interface LineEdit {
  /** Pence to bill; undefined keeps the WIP value. */
  net?: Pence;
  description?: string;
  /** A VAT code chosen for the line; undefined: the default one applies. */
  vatRateId?: string;
}

export type LineEdits = Readonly<Record<string, LineEdit | undefined>>;

export interface PreviewLine extends PlannedLine {
  /** The edited description. */
  text: string;
  /** What the line bills now: the edit, else the WIP value; null for a fixed fee not yet priced. */
  billed: Pence | null;
  vatRateId: string | null;
  vatBp: BasisPoints;
  /** Billed minus WIP; null when the line has no amount yet. */
  adjustment: Pence | null;
}

export interface VatDefaults {
  options: ReadonlyArray<VatOption>;
  /** The client's default VAT code, else the practice's; null: no VAT is charged. */
  defaultId: string | null;
}

/** The rate of a chosen VAT code, else of the default one, else 0. */
export function vatRateOf(vat: VatDefaults, vatRateId: string | null): BasisPoints {
  const id = vatRateId ?? vat.defaultId;
  return vat.options.find((option) => option.id === id)?.rate_bp ?? 0;
}

export function previewLines(
  planned: ReadonlyArray<PlannedLine>,
  edits: LineEdits,
  vat: VatDefaults,
): PreviewLine[] {
  return planned.map((line) => {
    const edit = edits[line.key];
    const billed = edit?.net ?? line.net;
    const vatRateId = edit?.vatRateId ?? null;
    return {
      ...line,
      text: edit?.description ?? line.description,
      billed,
      vatRateId,
      vatBp: vatRateOf(vat, vatRateId),
      adjustment: billed === null ? null : billed - line.wip,
    };
  });
}

export interface PreviewTotals extends InvoiceTotals {
  /** Lines whose amount only the server knows (a fixed fee not priced here). */
  unpriced: number;
}

export function previewTotals(lines: ReadonlyArray<PreviewLine>): PreviewTotals {
  const priced: PricedLine[] = lines
    .filter((line): line is PreviewLine & { billed: Pence } => line.billed !== null)
    .map((line) => ({ net: line.billed, vatBp: line.vatBp, wip: line.wip }));
  return { ...totalsOf(priced), unpriced: lines.length - priced.length };
}

/** The WIP ids the draft request carries. */
export function selectionOf(
  items: ReadonlyArray<WipItem>,
): Pick<InvoiceCreate, 'time_entry_ids' | 'disbursement_ids'> {
  return {
    time_entry_ids: items.filter((item) => item.kind === 'time').map((item) => item.id),
    disbursement_ids: items
      .filter((item) => item.kind === 'disbursement' || item.kind === 'expense')
      .map((item) => item.id),
  };
}

/** The `overrides` of the draft request: only the lines the person changed, and only what changed. */
export function overridesOf(planned: ReadonlyArray<PlannedLine>, edits: LineEdits): LineOverride[] {
  const overrides: LineOverride[] = [];
  for (const line of planned) {
    const edit = edits[line.key];
    if (!edit) continue;
    const override: LineOverride = { ...line.selector };
    if (edit.net !== undefined && edit.net !== line.net) override.net_amount = edit.net;
    if (edit.description !== undefined && edit.description !== line.description) {
      override.description = edit.description;
    }
    if (edit.vatRateId !== undefined) override.vat_rate_id = edit.vatRateId;
    if (Object.keys(override).length > Object.keys(line.selector).length) overrides.push(override);
  }
  return overrides;
}
