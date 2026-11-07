import { MoneyTone } from '@/components/ui/MoneyTone';
import { PERMISSIONS as P } from '@/constants/permissions';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import type { ReportConfig } from '../config';
import type { VatSummaryRow, VatSummaryTotals } from '../types';
import { money, named } from './cells';

/** Output VAT by rate, on the invoice basis: what goes in box 1 of the VAT return. */
export const vatSummaryReport: ReportConfig<VatSummaryRow, VatSummaryTotals> = {
  endpoint: 'vat-summary',
  fileName: 'vat-summary',
  title: 'VAT Summary',
  description:
    'Output VAT by rate: invoices issued in the period less credit notes issued in it, at the rates on their lines.',
  what: 'VAT summary',
  access: [P.reportFinancial],
  period: 'range',
  defaultPreset: 'last-3-months',
  filters: ['client'],
  rowKey: (row) => row.vat_rate_id ?? `${String(row.rate_bp)}-${row.name}`,
  rowLabel: (row) => row.name,
  columns: ({ currency }) => [
    {
      id: 'rate',
      header: 'VAT rate',
      hideable: false,
      sortable: true,
      sortValue: (row) => row.rate_bp,
      className: 'min-w-40',
      cell: (row) =>
        named(row.name, `${formatBasisPoints(row.rate_bp)}${row.code ? ` · ${row.code}` : ''}`),
    },
    {
      id: 'invoiced-net',
      header: 'Invoiced (net)',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.invoiced_net,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.invoiced_net, currency),
    },
    {
      id: 'invoiced-vat',
      header: 'Invoiced VAT',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.invoiced_vat,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.invoiced_vat, currency),
    },
    {
      id: 'credited-net',
      header: 'Credit notes (net)',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.credited_net,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.credited_net}>
          {money(row.credited_net, currency, false)}
        </MoneyTone>
      ),
    },
    {
      id: 'credited-vat',
      header: 'Credited VAT',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.credited_vat,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.credited_vat}>
          {money(row.credited_vat, currency, false)}
        </MoneyTone>
      ),
    },
    {
      id: 'net',
      header: 'Net sales',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.net,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.net, currency),
    },
    {
      id: 'vat',
      header: 'Output VAT',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.vat,
      className: 'whitespace-nowrap',
      cell: (row) => <strong>{money(row.vat, currency)}</strong>,
    },
  ],
  stats: (totals, { currency }) => [
    {
      label: 'Output VAT',
      value: formatMoney(totals.vat, currency),
      hint: 'Invoiced VAT less credited VAT',
    },
    {
      label: 'Net sales',
      value: formatMoney(totals.net, currency),
      hint: 'Invoiced less credit notes, before VAT',
    },
    { label: 'Invoiced VAT', value: formatMoney(totals.invoiced_vat, currency) },
    { label: 'Credited VAT', value: formatMoney(totals.credited_vat, currency) },
  ],
  note: 'Invoice basis: by the date an invoice or credit note was issued, not when it was paid. Check against your VAT return before filing.',
  emptyTitle: 'No VAT in this period',
  emptyDescription: 'Choose other dates to see the VAT on invoices and credit notes.',
};
