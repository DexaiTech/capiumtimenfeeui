import { MoneyTone } from '@/components/ui/MoneyTone';
import { Briefcase, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import {
  buttonClasses,
  PageToolbar,
  SearchField,
  Select,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { useClientJobRates, useClientJobs, type JobFilters, type JobSort } from '../../api';
import { ToneBadge } from '../badges';
import { JOB_STATUS_LABELS } from '../constants';
import { describeJobRate } from '../jobRates';
import { JOB_STATUSES, type ClientOverview, type JobRate, type JobRow } from '../types';
import { RecordTable } from '../records/RecordTable';
import { SummaryStrip } from '../records/SummaryStrip';
import { oneOf, useUrlSearch } from '../records/urlFilters';
import { JobRatePanel, type JobRateTarget } from './JobRatePanel';

const SORT_COLUMNS = ['number', 'due_date'] as const;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...JOB_STATUSES.map((status) => ({ value: status, label: JOB_STATUS_LABELS[status].label })),
];

/** The server sorts jobs: no column selected is the API's default, newest first. */
function apiSort(column: (typeof SORT_COLUMNS)[number] | '', order: 'asc' | 'desc'): JobSort {
  if (!column) return '-created_at';
  return order === 'desc' ? `-${column}` : column;
}

export interface JobsTabProps {
  clientId: string;
  clientName: string;
  overview: ClientOverview | undefined;
}

/**
 * The client's jobs (`GET /jobs?client_id=`, `job.read`): search, status and server-side sort.
 * Each job shows its rate and where it comes from (`GET /clients/{id}/job-rates`): the task rate
 * until a custom client rate is agreed for the job, which `job.update` can set here (APT54).
 */
export function JobsTab({ clientId, clientName, overview }: JobsTabProps) {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text, setText, searched } = useUrlSearch();
  const status = oneOf(params.get('status'), JOB_STATUSES);
  const column = oneOf(params.get('sort'), SORT_COLUMNS);
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';

  const filters = useMemo<JobFilters>(
    () => ({ q: searched, status, sort: apiSort(column, order) }),
    [searched, status, column, order],
  );
  const query = useClientJobs(clientId, filters);
  const rates = useClientJobRates(clientId);
  const slug = organization.slug;
  const currency = organization.currency;
  const canEditRate = can(PERMISSIONS.jobUpdate);
  const [editing, setEditing] = useState<JobRateTarget | null>(null);
  const rateOf = useMemo(() => {
    const found = new Map<string, JobRate>();
    for (const rate of rates.data?.jobs ?? []) found.set(rate.job_id, rate);
    return found;
  }, [rates.data]);

  const columns: DataTableColumn<JobRow>[] = [
    {
      id: 'number',
      header: 'Job',
      sortable: true,
      cell: (job) => (
        <div className="flex min-w-0 flex-col">
          <Link
            to={routes.org.job(slug, job.id)}
            className="font-semibold text-brand-text hover:underline"
          >
            {job.number}
          </Link>
          <span className="max-w-64 truncate text-text-muted" title={job.name}>
            {job.name}
          </span>
        </div>
      ),
    },
    { id: 'service', header: 'Service', cell: (job) => job.service_name ?? '—' },
    {
      id: 'rate',
      header: 'Rate',
      cell: (job) => {
        const rate = rateOf.get(job.id);
        const text = describeJobRate(job, rate, currency);
        return (
          <div className="flex items-start gap-1.5">
            <div className="flex min-w-0 flex-col">
              <span className="whitespace-nowrap font-medium text-text">{text.label}</span>
              <span className="max-w-56 text-xs text-text-muted">{text.detail}</span>
            </div>
            {canEditRate && job.billing_basis === 'hourly' ? (
              <button
                type="button"
                onClick={() => setEditing({ job, rate })}
                aria-label={`Change the rate of ${job.number}`}
                title="Change the rate"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-hover hover:text-text"
              >
                <Pencil aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: (job) => <ToneBadge info={JOB_STATUS_LABELS[job.status]} />,
    },
    {
      id: 'due_date',
      header: 'Due',
      sortable: true,
      className: 'whitespace-nowrap',
      cell: (job) => formatUkDate(job.due_date) || '—',
    },
    {
      id: 'logged',
      header: 'Logged',
      align: 'end',
      className: 'whitespace-nowrap tabular-nums',
      cell: (job) =>
        job.budget_minutes
          ? `${formatMinutes(job.logged_minutes)} of ${formatMinutes(job.budget_minutes)}`
          : formatMinutes(job.logged_minutes),
    },
    {
      id: 'wip',
      header: 'WIP',
      align: 'end',
      className: 'tabular-nums',
      cell: (job) => formatMoney(job.wip_value, currency),
    },
    {
      id: 'billed',
      header: 'Billed',
      align: 'end',
      className: 'tabular-nums',
      cell: (job) => (
        <MoneyTone kind="in" value={job.billed_value}>
          {formatMoney(job.billed_value, currency)}
        </MoneyTone>
      ),
    },
  ];

  const sort: DataTableSort | null = column ? { columnId: column, direction: order } : null;
  const filtered = Boolean(searched) || status !== '';
  const clearFilters = () => {
    setText('');
    setParam({ q: null, status: null });
  };
  const counts = overview?.jobs?.by_status;

  return (
    <div className="flex flex-col gap-4">
      {overview?.jobs && counts ? (
        <SummaryStrip
          label="Job totals"
          items={[
            { label: 'Jobs', value: String(overview.jobs.total) },
            { label: 'In progress', value: String(counts.in_progress ?? 0) },
            { label: 'On hold', value: String(counts.on_hold ?? 0) },
            { label: 'Completed', value: String(counts.completed ?? 0) },
          ]}
        />
      ) : null}
      <RecordTable
        caption={`Jobs of ${clientName}`}
        columns={columns}
        rowKey={(job) => job.id}
        query={query}
        noun={['job', 'jobs']}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        filtered={filtered}
        onClearFilters={clearFilters}
        emptyIcon={<Briefcase className="size-6" />}
        emptyTitle="No jobs yet"
        emptyDescription="Jobs for this client will be listed here."
        errorTitle="Could not load the jobs"
        toolbar={
          <PageToolbar
            search={
              <SearchField
                label="Search jobs"
                placeholder="Search jobs"
                value={text}
                onChange={setText}
              />
            }
            actions={
              <>
                <Select
                  label="Status"
                  hideLabel
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={(event) => setParam({ status: event.target.value })}
                  className="w-full sm:w-44"
                />
                {can(PERMISSIONS.jobCreate) ? (
                  <Link
                    to={`${routes.org.jobs(slug)}?new=1&client_id=${clientId}`}
                    className={buttonClasses({ variant: 'primary', size: 'sm' })}
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    New job
                  </Link>
                ) : null}
              </>
            }
          />
        }
      />
      <JobRatePanel target={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
