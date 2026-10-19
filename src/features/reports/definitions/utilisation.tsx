import { BarChart } from '@/components/charts';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints } from '@/utils/money';

import type { ReportConfig } from '../config';
import type { UtilisationRow, UtilisationTotals } from '../types';
import { linkTo, plural } from '../utils/format';
import { minutes, named, percent, variance } from './cells';

const signed = (bp: number | null) =>
  bp === null ? '—' : `${bp > 0 ? '+' : ''}${formatBasisPoints(bp)}`;

/** Chargeable hours against capacity and target, person by person. */
export const utilisationReport: ReportConfig<UtilisationRow, UtilisationTotals> = {
  endpoint: 'utilisation',
  fileName: 'utilisation',
  title: 'Utilisation',
  description: 'Chargeable hours against capacity and target.',
  what: 'utilisation',
  access: [P.reportRead],
  period: 'range',
  filters: ['user', 'manager'],
  rowKey: (row) => row.user_id,
  rowLabel: (row) => row.full_name,
  columns: () => [
    {
      id: 'person',
      header: 'Person',
      hideable: false,
      sortable: true,
      sortValue: (row) => row.full_name,
      className: 'min-w-40',
      cell: (row) => named(row.full_name, row.status === 'active' ? null : row.status),
    },
    {
      id: 'capacity',
      header: 'Capacity',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.capacity_minutes,
      cell: (row) => minutes(row.capacity_minutes),
    },
    {
      id: 'total',
      header: 'Recorded',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.total_minutes,
      cell: (row) => minutes(row.total_minutes),
    },
    {
      id: 'chargeable',
      header: 'Chargeable',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.chargeable_minutes,
      cell: (row) => minutes(row.chargeable_minutes),
    },
    {
      id: 'non-chargeable',
      header: 'Non-chargeable',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.non_chargeable_minutes,
      cell: (row) => minutes(row.non_chargeable_minutes),
    },
    {
      id: 'utilisation',
      header: 'Utilisation',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.utilisation_bp,
      cell: (row) => percent(row.utilisation_bp),
    },
    {
      id: 'target',
      header: 'Target',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.target_bp,
      cell: (row) => percent(row.target_bp),
    },
    {
      id: 'variance',
      header: 'Against target',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.variance_bp,
      cell: (row) => variance(row.variance_bp),
    },
  ],
  stats: (totals) => [
    {
      label: 'Capacity',
      value: formatMinutes(totals.capacity_minutes),
      hint: plural(totals.working_days, 'working day', 'working days'),
    },
    {
      label: 'Chargeable',
      value: formatMinutes(totals.chargeable_minutes),
      hint: `${formatMinutes(totals.total_minutes)} recorded in all`,
    },
    {
      label: 'Utilisation',
      value: formatBasisPoints(totals.utilisation_bp),
      hint: `Chargeable time over capacity. Target ${formatBasisPoints(totals.target_bp)}`,
    },
    {
      label: 'Against target',
      value: signed(totals.variance_bp),
      hint: 'Utilisation less the target',
      danger: (totals.variance_bp ?? 0) < 0,
    },
  ],
  chart: ({ rows }) => (
    <BarChart
      title="Utilisation against target"
      description="Chargeable time as a share of capacity, with each person's target."
      data={rows.map((row) => ({
        name: row.full_name,
        utilisation: row.utilisation_bp ?? 0,
        target: row.target_bp ?? 0,
      }))}
      xKey="name"
      series={[
        { key: 'utilisation', label: 'Utilisation', color: 'primary' },
        { key: 'target', label: 'Target', color: 'muted' },
      ]}
      horizontal
      legend
      yFormatter={(value) => formatBasisPoints(value)}
      tableColumns={[
        { key: 'name', label: 'Person', align: 'start' },
        { key: 'utilisation', label: 'Utilisation', align: 'end' },
        { key: 'target', label: 'Target', align: 'end' },
      ]}
      emptyTitle="No capacity in these dates"
      aspect={16 / Math.max(5, Math.min(12, rows.length + 3))}
    />
  ),
  drill: (row, context, period) => ({
    label: 'See the time entries',
    to: linkTo(routes.org.module(context.slug, 'time', 'entries'), {
      person: row.user_id,
      from: period.from,
      to: period.to,
    }),
  }),
  emptyTitle: 'No one to report on',
  emptyDescription: 'Staff with a weekly capacity appear here for the dates chosen.',
};
