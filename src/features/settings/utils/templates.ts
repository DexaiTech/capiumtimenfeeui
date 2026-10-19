import type { SelectOption } from '@/components/ui';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import type { InvoiceLayout } from '../billingTypes';

export const TEMPLATE_NAME_MAX = 80;
export const FOOTER_MAX = 1000;

export const LAYOUTS = [
  'standard',
  'detailed',
  'summary',
] as const satisfies ReadonlyArray<InvoiceLayout>;

export const LAYOUT_LABEL: Record<InvoiceLayout, string> = {
  standard: 'Standard',
  detailed: 'Detailed',
  summary: 'Summary',
};

export const LAYOUT_HINT: Record<InvoiceLayout, string> = {
  standard: 'The invoice lines as they were prepared, one line for each service billed.',
  detailed: 'Every time entry is listed with its date, person, hours and rate.',
  summary: 'One line for each job, without the entries behind it.',
};

export const LAYOUT_OPTIONS: ReadonlyArray<SelectOption<InvoiceLayout>> = [
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed (every time entry)' },
  { value: 'summary', label: 'Summary (one line per job)' },
];

/** The VAT rate of the sample invoice, in basis points. */
export const SAMPLE_VAT_BP = 2000;

/** The table of the sample invoice: the headings, the rows (the last cell is the net amount). */
export interface SampleInvoice {
  head: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<string>>;
  /** Net of every row, in pence. */
  net: number;
}

const TIME_ENTRIES = [
  { date: '01/09/2026', what: 'A. Lovelace · Preparing the accounts', minutes: 150, rate: 9500 },
  { date: '02/09/2026', what: 'A. Lovelace · Preparing the accounts', minutes: 180, rate: 9500 },
  { date: '03/09/2026', what: 'C. Babbage · Review of the accounts', minutes: 90, rate: 12000 },
  { date: '08/09/2026', what: 'C. Babbage · Partner review', minutes: 30, rate: 12000 },
  { date: '10/09/2026', what: 'A. Lovelace · VAT return', minutes: 90, rate: 9500 },
] as const;

const SERVICE_LINES = [
  { what: 'Year-end accounts 2026', quantity: 1, unit: 120_000 },
  { what: 'VAT return, quarter to 30/09/2026', quantity: 1, unit: 15_000 },
  { what: 'Payroll, monthly', quantity: 3, unit: 8000 },
] as const;

const JOB_LINES = [
  { what: 'J00012 · Year-end accounts 2026', net: 120_000 },
  { what: 'J00019 · VAT returns', net: 15_000 },
  { what: 'J00023 · Payroll', net: 24_000 },
] as const;

/** Made-up lines for each layout, so the preview shows what the layout changes. */
export function sampleInvoice(layout: InvoiceLayout, currency = 'GBP'): SampleInvoice {
  const money = (pence: number) => formatMoney(pence, currency);
  if (layout === 'detailed') {
    const nets = TIME_ENTRIES.map((entry) => Math.round((entry.minutes * entry.rate) / 60));
    return {
      head: ['Date', 'Description', 'Time', 'Net'],
      rows: TIME_ENTRIES.map((entry, index) => [
        entry.date,
        entry.what,
        formatMinutes(entry.minutes),
        money(nets[index] ?? 0),
      ]),
      net: nets.reduce((sum, value) => sum + value, 0),
    };
  }
  if (layout === 'summary') {
    return {
      head: ['Job', 'Net'],
      rows: JOB_LINES.map((line) => [line.what, money(line.net)]),
      net: JOB_LINES.reduce((sum, line) => sum + line.net, 0),
    };
  }
  return {
    head: ['Description', 'Qty', 'Net'],
    rows: SERVICE_LINES.map((line) => [
      line.what,
      String(line.quantity),
      money(line.quantity * line.unit),
    ]),
    net: SERVICE_LINES.reduce((sum, line) => sum + line.quantity * line.unit, 0),
  };
}
