import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import type { ReportConfig } from '../config';
import type { RecoveryRow, RecoveryTotals } from '../types';
import { linkTo } from '../utils/format';
import { money, named, percent } from './cells';

/** How much of the work done was billed: write-ups and write-downs on billing, and write-offs. */
export const recoveryReport: ReportConfig<RecoveryRow, RecoveryTotals> = {
  endpoint: 'recoverability',
  fileName: 'recovery',
  title: 'Recovery',
  description: 'How much of the work done was billed.',
  what: 'recovery report',
  access: [P.reportFinancial],
  period: 'range',
  defaultPreset: 'this-year',
  groups: [
    { value: 'client', label: 'Client' },
    { value: 'job', label: 'Job' },
    { value: 'person', label: 'Person' },
  ],
  filters: ['client', 'job', 'user', 'partner', 'manager', 'service'],
  rowKey: (row) => row.key ?? `none-${row.name}`,
  rowLabel: (row) => row.name,
  columns: ({ currency, group }) => [
    {
      id: 'name',
      header: group === 'job' ? 'Job' : group === 'person' ? 'Person' : 'Client',
      hideable: false,
      sortable: true,
      sortValue: (row) => row.name,
      className: 'min-w-44 max-w-80',
      cell: (row) => named(row.name, [row.code, row.client_name].filter(Boolean).join(' · ')),
    },
    {
      id: 'wip',
      header: 'Work in progress cleared',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.wip_value,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.wip_value, currency),
    },
    {
      id: 'billed',
      header: 'Billed',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.billed_value,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.billed_value, currency),
    },
    {
      id: 'adjustment',
      header: 'Write-on / down',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.billing_adjustment,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.billing_adjustment, currency, false),
    },
    {
      id: 'written-off',
      header: 'Written off',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.written_off_value,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.written_off_value, currency, false),
    },
    {
      id: 'recovery',
      header: 'Recovery',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.recovery_bp,
      className: 'whitespace-nowrap',
      cell: (row) => percent(row.recovery_bp),
    },
  ],
  stats: (totals, { currency }) => [
    {
      label: 'Recovery',
      value: formatBasisPoints(totals.recovery_bp),
      hint: 'Billed over the work cleared',
      danger: (totals.recovery_bp ?? 10_000) < 10_000,
    },
    { label: 'Work cleared', value: formatMoney(totals.wip_value, currency) },
    { label: 'Billed', value: formatMoney(totals.billed_value, currency) },
    {
      label: 'Written off',
      value: formatMoney(totals.written_off_value, currency),
      hint: `${formatMoney(totals.billing_adjustment, currency)} written on or down on billing`,
      danger: totals.written_off_value > 0,
    },
  ],
  drill: (row, context, period) =>
    row.client_id
      ? {
          label: 'See the invoices',
          to: linkTo(routes.org.module(context.slug, 'billing', 'invoices'), {
            client: row.client_id,
            from: period.from,
            to: period.to,
          }),
        }
      : null,
  note: 'Work cleared is the work in progress taken off by invoices and write-offs in the dates; billed is what those invoices charged for it.',
  emptyTitle: 'Nothing was billed or written off',
  emptyDescription: 'Choose other dates to see how the work done was recovered.',
};
