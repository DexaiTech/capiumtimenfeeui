import { Badge } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { addDays, formatUkDateTime } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import type { ReportConfig } from '../config';
import type { MissingStatus, MissingTimesheetRow, MissingTimesheetTotals } from '../types';
import { linkTo, plural, weekOf } from '../utils/format';
import { count, minutes, named } from './cells';

const STATE: Record<MissingStatus, { label: string; tone: 'red' | 'amber' | 'grey' }> = {
  none: { label: 'Nothing started', tone: 'red' },
  open: { label: 'Open, not submitted', tone: 'amber' },
  rejected: { label: 'Returned', tone: 'grey' },
};

/** Who has not submitted a timesheet for a week, with what they logged against what was expected. */
export const missingTimesheetsReport: ReportConfig<MissingTimesheetRow, MissingTimesheetTotals> = {
  endpoint: 'missing-timesheets',
  fileName: 'missing-timesheets',
  title: 'Missing Timesheets',
  description: 'Who has not recorded or submitted time.',
  what: 'missing timesheets report',
  access: [P.reportRead],
  period: 'weeks',
  filters: ['user', 'manager', 'status'],
  rowKey: (row) => `${row.user_id}:${row.week_start}`,
  rowLabel: (row) => `${row.name}, ${weekOf(row.week_start)}`,
  columns: ({ timeZone }) => [
    {
      id: 'person',
      header: 'Person',
      hideable: false,
      sortable: true,
      sortValue: (row) => row.name,
      className: 'min-w-40',
      cell: (row) => named(row.name, row.has_login ? null : 'No login'),
    },
    {
      id: 'week',
      header: 'Week',
      sortable: true,
      sortValue: (row) => row.week_start,
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{weekOf(row.week_start)}</span>,
    },
    {
      id: 'state',
      header: 'State',
      sortable: true,
      sortValue: (row) => row.status,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <Badge tone={STATE[row.status].tone} size="sm">
          {STATE[row.status].label}
        </Badge>
      ),
    },
    {
      id: 'logged',
      header: 'Logged',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.logged_minutes,
      cell: (row) => minutes(row.logged_minutes),
    },
    {
      id: 'expected',
      header: 'Expected',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.expected_minutes,
      cell: (row) => minutes(row.expected_minutes),
    },
    {
      id: 'shortfall',
      header: 'Short by',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.shortfall_minutes,
      cell: (row) => minutes(row.shortfall_minutes),
    },
    {
      id: 'days',
      header: 'Days with nothing',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.missing_day_count,
      cell: (row) => count(row.missing_day_count),
    },
    {
      id: 'reminded',
      header: 'Last reminded',
      sortable: true,
      sortValue: (row) => row.last_reminded_at,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span className="text-text">
          {row.last_reminded_at ? formatUkDateTime(row.last_reminded_at, timeZone) : 'Never'}
        </span>
      ),
    },
  ],
  stats: (totals) => [
    {
      label: 'Timesheets missing',
      value: String(totals.timesheets),
      hint: `${plural(totals.people, 'person', 'people')}, ${plural(totals.weeks, 'week', 'weeks')}`,
      danger: totals.timesheets > 0,
    },
    {
      label: 'Nothing started',
      value: String(totals.none_count),
      hint: `${totals.open_count} open, ${totals.rejected_count} returned`,
    },
    {
      label: 'Short by',
      value: formatMinutes(totals.shortfall_minutes),
      hint: `${formatMinutes(totals.logged_minutes)} logged of ${formatMinutes(totals.expected_minutes)}`,
    },
    {
      label: 'Days with nothing',
      value: String(totals.missing_day_count),
      hint: 'Working days without an entry',
    },
  ],
  drill: (row, context) => ({
    label: 'See the time entries',
    to: linkTo(routes.org.module(context.slug, 'time', 'entries'), {
      person: row.user_id,
      from: row.week_start,
      to: addDays(row.week_start, 6),
    }),
  }),
  note: 'The same people as the dashboard lists: active staff with a capacity, employed in the week, whose timesheet is not submitted or approved.',
  emptyTitle: 'No missing timesheets',
  emptyDescription: 'Everyone has submitted a timesheet for the weeks chosen.',
};
