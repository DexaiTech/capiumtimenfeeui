import { Link } from 'react-router';

import { Badge, type DataTableColumn, type DataTableSort } from '@/components/ui';
import { routes } from '@/constants/routes';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import type { Job, JobSort } from '../types';
import { isOverdue } from '../utils/format';
import { JobStatusBadge, UsageBar } from './StatusBadges';

/** The columns the API can sort by (`GET /jobs`, `sort`), and the key each one sorts on. */
const KEY_OF_COLUMN: Record<string, 'number' | 'due_date' | 'created_at'> = {
  job: 'number',
  due: 'due_date',
  created: 'created_at',
};
const COLUMN_OF_KEY = { number: 'job', due_date: 'due', created_at: 'created' } as const;

/** The table's sort state for the API's `sort` (a leading `-` is descending). */
export function tableSort(sort: JobSort): DataTableSort {
  const descending = sort.startsWith('-');
  const key = (descending ? sort.slice(1) : sort) as keyof typeof COLUMN_OF_KEY;
  return { columnId: COLUMN_OF_KEY[key], direction: descending ? 'desc' : 'asc' };
}

/** The API's sort for a header the person clicked; null for a column that does not sort. */
export function sortOfColumn(next: DataTableSort): JobSort | null {
  const key = KEY_OF_COLUMN[next.columnId];
  return key ? `${next.direction === 'desc' ? '-' : ''}${key}` : null;
}

export interface JobColumnsOptions {
  slug: string;
  currency: string;
  /** Today in the practice time zone, for the overdue mark. */
  today: string;
  managerName: (userId: string | null) => string | null;
}

/** The worse of the hours and the fee usage of a job; null without any budget. */
export function jobUsageBp(job: Job): number | null {
  const values = [job.budget_minutes_used_bp, job.budget_fee_used_bp].filter(
    (value): value is number => value !== null,
  );
  return values.length > 0 ? Math.max(...values) : null;
}

/** The columns of the job list. */
export function jobColumns({
  slug,
  currency,
  today,
  managerName,
}: JobColumnsOptions): DataTableColumn<Job>[] {
  return [
    {
      id: 'job',
      header: 'Job',
      hideable: false,
      sortable: true,
      className: 'min-w-56 max-w-96',
      cell: (job) => (
        <Link
          to={routes.org.job(slug, job.id)}
          className="flex min-w-0 flex-col hover:text-brand-text"
          title={`${job.number} ${job.name}`}
        >
          <span className="truncate font-semibold text-text">{job.name}</span>
          <span className="text-xs text-text-muted">{job.number}</span>
        </Link>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-40',
      cell: (job) => <span className="text-text">{job.client_name}</span>,
    },
    {
      id: 'service',
      header: 'Service',
      className: 'min-w-36',
      cell: (job) => <span className="text-text">{job.service_name ?? '—'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-36',
      cell: (job) => <JobStatusBadge status={job.status} />,
    },
    {
      id: 'manager',
      header: 'Manager',
      className: 'min-w-36',
      cell: (job) => <span className="text-text">{managerName(job.manager_user_id) ?? '—'}</span>,
    },
    {
      id: 'due',
      header: 'Due',
      sortable: true,
      className: 'w-40 whitespace-nowrap',
      cell: (job) =>
        job.due_date ? (
          <span className="inline-flex items-center gap-2 text-text">
            {formatUkDate(job.due_date)}
            {isOverdue(job.due_date, job.status, today) ? (
              <Badge tone="red" size="sm">
                Overdue
              </Badge>
            ) : null}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'budget',
      header: 'Budget used',
      className: 'w-44',
      cell: (job) => <UsageBar label={`Budget used on ${job.number}`} usageBp={jobUsageBp(job)} />,
    },
    {
      id: 'wip',
      header: 'WIP',
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (job) => (
        <span className="text-text tabular-nums">{formatMoney(job.wip_value, currency)}</span>
      ),
    },
    {
      id: 'created',
      header: 'Created',
      sortable: true,
      className: 'w-28 whitespace-nowrap',
      cell: (job) => <span className="text-text">{formatUkDate(job.created_at)}</span>,
    },
  ];
}
