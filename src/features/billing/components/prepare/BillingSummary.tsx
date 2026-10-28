import { MoneyTone } from '@/components/ui/MoneyTone';
import { useMemo, useState } from 'react';

import {
  Button,
  ColumnVisibilityMenu,
  DataTable,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  SegmentedControl,
  sortRows,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { usePersistentColumns } from '@/hooks';
import type { Pence } from '@/types/api';
import { formatMoney } from '@/utils/money';
import { formatMinutes } from '@/utils/minutes';

import type { BillingBasis, ClientBillingSummary, JobBilling } from '../../types';
import { BASIS_HINTS, BASIS_LABELS } from '../../utils/basis';

/** A job shown at first; "Show more" adds this many each time, so 100 jobs stay short. */
const FIRST_PAGE = 5;
const NEXT_PAGE = 10;

/** Columns that start hidden: the table opens on what matters and "Show/Hide Columns" has the rest. */
const HIDDEN_BY_DEFAULT = [
  'billable',
  'non_billable',
  'billed',
  'company',
  'contract',
  'fixed',
  'other',
  'budgeted',
];

/** The terms in a few words; the full sentence is the tooltip. */
function shortTerms(job: JobBilling, money: (pence: Pence) => string): string {
  if (job.billing_basis === 'fixed') return `Fixed ${money(job.fixed_fee ?? 0)}`;
  if (job.billing_basis === 'non_billable') return 'Non-billable';
  if (job.billing_basis === 'hourly') {
    return job.hourly_rate ? `Hourly ${money(job.hourly_rate)}/h` : 'Hourly';
  }
  return '—';
}

const dash = <span className="text-text-subtle">—</span>;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-base font-semibold text-text tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-text-subtle">{hint}</dd> : null}
    </div>
  );
}

function columnsFor(
  basis: BillingBasis,
  showCost: boolean,
  money: (pence: Pence) => string,
): DataTableColumn<JobBilling>[] {
  const minutes = (minutesOf: (job: JobBilling) => number) => ({
    align: 'end' as const,
    className: 'whitespace-nowrap tabular-nums',
    sortValue: minutesOf,
  });
  const amount = (valueOf: (job: JobBilling) => Pence | null) => ({
    align: 'end' as const,
    className: 'whitespace-nowrap tabular-nums',
    sortValue: (job: JobBilling) => valueOf(job),
  });
  const cell = (value: Pence | null) => (value === null ? dash : money(value));
  const columns: DataTableColumn<JobBilling>[] = [
    {
      id: 'job',
      header: 'Job',
      hideable: false,
      sortable: true,
      sortValue: (job) => job.number ?? job.name,
      className: 'min-w-48',
      cell: (job) => (
        <div className="flex flex-col">
          <span className="font-medium text-text">{job.name}</span>
          <span className="text-xs text-text-muted">{job.number ?? 'No job'}</span>
        </div>
      ),
    },
    {
      id: 'terms',
      header: 'Contract terms',
      className: 'whitespace-nowrap',
      cell: (job) => (
        <span className="text-text-muted" title={job.terms}>
          {shortTerms(job, money)}
        </span>
      ),
    },
    {
      id: 'logged',
      header: 'Hours logged',
      sortable: true,
      ...minutes((job) => job.breakdown.logged_minutes),
      cell: (job) => formatMinutes(job.breakdown.logged_minutes),
    },
    {
      id: 'billable',
      header: 'Billable',
      sortable: true,
      ...minutes((job) => job.breakdown.billable_minutes),
      cell: (job) => formatMinutes(job.breakdown.billable_minutes),
    },
    {
      id: 'non_billable',
      header: 'Non-billable',
      sortable: true,
      ...minutes((job) => job.breakdown.non_billable_minutes),
      cell: (job) => formatMinutes(job.breakdown.non_billable_minutes),
    },
    {
      id: 'billed',
      header: 'Already billed',
      sortable: true,
      ...minutes((job) => job.breakdown.billed_minutes),
      cell: (job) => formatMinutes(job.breakdown.billed_minutes),
    },
    {
      id: 'ready',
      header: 'Ready to bill',
      sortable: true,
      ...minutes((job) => job.breakdown.ready_minutes),
      cell: (job) => (
        <div className="flex flex-col items-end">
          <span>{formatMinutes(job.breakdown.ready_minutes)}</span>
          {job.breakdown.awaiting_approval_minutes > 0 ? (
            <span className="text-xs text-text-subtle">
              +{formatMinutes(job.breakdown.awaiting_approval_minutes)} awaiting approval
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'would_bill',
      header: `Would bill (${BASIS_LABELS[basis].toLowerCase()})`,
      hideable: false,
      sortable: true,
      ...amount((job) => job.breakdown.basis_values[basis]),
      cell: (job) => (
        <span className="font-semibold text-text">{cell(job.breakdown.basis_values[basis])}</span>
      ),
    },
    {
      id: 'company',
      header: 'Time at company rates',
      sortable: true,
      ...amount((job) => job.breakdown.company_time_value),
      cell: (job) => money(job.breakdown.company_time_value),
    },
    {
      id: 'contract',
      header: 'Time at contract rates',
      sortable: true,
      ...amount((job) => job.breakdown.contract_time_value),
      cell: (job) => money(job.breakdown.contract_time_value),
    },
    {
      id: 'fixed',
      header: 'Fixed fee (billed)',
      sortable: true,
      ...amount((job) => job.breakdown.fixed_fee),
      cell: (job) =>
        job.breakdown.fixed_fee === null ? (
          dash
        ) : (
          <div className="flex flex-col items-end">
            <span>{money(job.breakdown.fixed_fee)}</span>
            <span className="text-xs text-text-subtle">
              {money(job.breakdown.fixed_fee_billed)} billed
            </span>
          </div>
        ),
    },
    {
      id: 'other',
      header: 'Other costs',
      sortable: true,
      ...amount((job) => job.breakdown.other_costs),
      cell: (job) => (
        <MoneyTone kind="out" value={job.breakdown.other_costs}>
          {money(job.breakdown.other_costs)}
        </MoneyTone>
      ),
    },
  ];
  if (showCost) {
    columns.push({
      id: 'actual',
      header: 'Actual cost',
      sortable: true,
      ...amount((job) => job.breakdown.actual_cost),
      cell: (job) => cell(job.breakdown.actual_cost),
    });
  }
  columns.push(
    {
      id: 'budgeted',
      header: 'Budgeted cost',
      sortable: true,
      ...amount((job) => job.breakdown.budgeted_cost),
      cell: (job) => cell(job.breakdown.budgeted_cost),
    },
    {
      id: 'agreed',
      header: 'Agreed price',
      sortable: true,
      ...amount((job) => job.breakdown.agreed_price),
      cell: (job) => cell(job.breakdown.agreed_price),
    },
  );
  return columns;
}

export interface BillingSummaryProps {
  summary: ClientBillingSummary;
  basis: BillingBasis;
  onBasisChange: (basis: BillingBasis) => void;
}

/**
 * The client's jobs with their contract terms and the hours spent on them, whatever can be billed
 * now, and the choice of what the invoice is valued on: the contract, the job or the team.
 *
 * Built for a client with many jobs: totals first, then one row per job (sortable, searchable,
 * five at a time), with the detailed figures behind "Show/Hide Columns".
 */
export function BillingSummary({ summary, basis, onBasisChange }: BillingSummaryProps) {
  const { organization } = useOrg();
  const money = (pence: Pence) => formatMoney(pence, organization.currency);
  const [search, setSearch] = useState('');
  const [readyOnly, setReadyOnly] = useState(false);
  const [shown, setShown] = useState(FIRST_PAGE);
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: 'ready', direction: 'desc' });
  const [hidden, setHidden] = usePersistentColumns('prepare-summary', HIDDEN_BY_DEFAULT);

  const totals = summary.totals;
  const values = totals.basis_values;
  const options = (Object.keys(BASIS_LABELS) as BillingBasis[])
    .filter((key) => values[key] !== null)
    .map((key) => ({ value: key, label: `${BASIS_LABELS[key]} ${money(values[key] ?? 0)}` }));

  const columns = useMemo(
    () => columnsFor(basis, summary.show_cost, money),
    // `money` is rebuilt from the currency each render; the currency is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [basis, summary.show_cost, organization.currency],
  );

  const needle = search.trim().toLowerCase();
  const matching = summary.jobs.filter(
    (job) =>
      (!readyOnly || job.breakdown.ready_minutes > 0 || job.breakdown.other_costs > 0) &&
      (!needle ||
        job.name.toLowerCase().includes(needle) ||
        (job.number ?? '').toLowerCase().includes(needle)),
  );
  const rows = sortRows(matching, columns, sort);
  const visible = rows.slice(0, shown);
  const filtered = needle !== '' || readyOnly;
  const many = summary.jobs.length > FIRST_PAGE;

  return (
    <section aria-label="Billing summary" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text">
            Jobs, hours and contract terms
            <span className="ml-2 text-xs font-normal text-text-muted">
              {summary.jobs.length} {summary.jobs.length === 1 ? 'job' : 'jobs'}
            </span>
          </h2>
          <SegmentedControl
            label="Value the invoice on"
            options={options}
            value={basis}
            onChange={onBasisChange}
          />
        </div>
        <p className="text-xs text-text-muted">{BASIS_HINTS[basis]}</p>
      </div>

      <dl
        aria-label="Totals for the client"
        className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-card sm:grid-cols-5"
      >
        <Stat label="Hours logged" value={formatMinutes(totals.logged_minutes)} />
        <Stat
          label="Ready to bill"
          value={formatMinutes(totals.ready_minutes)}
          hint={
            totals.awaiting_approval_minutes > 0
              ? `+${formatMinutes(totals.awaiting_approval_minutes)} awaiting approval`
              : undefined
          }
        />
        <Stat
          label={`Would bill (${BASIS_LABELS[basis].toLowerCase()})`}
          value={money(values[basis] ?? 0)}
        />
        <Stat
          label="Actual cost"
          value={summary.show_cost && totals.actual_cost !== null ? money(totals.actual_cost) : '—'}
        />
        <Stat
          label="Agreed price"
          value={totals.agreed_price === null ? '—' : money(totals.agreed_price)}
        />
      </dl>

      {summary.jobs.length === 0 ? (
        <p className="text-sm text-text-muted">No time has been logged for this client yet.</p>
      ) : (
        <DataTable
          caption="Jobs of the client"
          columns={columns}
          rows={visible}
          rowKey={(job) => job.job_id ?? 'no-job'}
          hiddenColumns={hidden}
          sort={sort}
          onSortChange={setSort}
          toolbar={
            <PageToolbar
              start={
                many ? (
                  <SearchField
                    label="Search jobs"
                    placeholder="Search jobs"
                    value={search}
                    onChange={(value) => {
                      setSearch(value);
                      setShown(FIRST_PAGE);
                    }}
                  />
                ) : undefined
              }
              actions={
                <>
                  <Button
                    size="sm"
                    aria-pressed={readyOnly}
                    onClick={() => {
                      setReadyOnly((value) => !value);
                      setShown(FIRST_PAGE);
                    }}
                  >
                    Work ready to bill only
                  </Button>
                  <ColumnVisibilityMenu
                    columns={columns.map((column) => ({
                      id: column.id,
                      label: column.header,
                      locked: column.hideable === false,
                    }))}
                    hidden={hidden}
                    onChange={setHidden}
                  />
                </>
              }
            />
          }
          empty={
            <EmptyState
              title="No job matches"
              description="Try another search, or show every job."
              action={
                <Button
                  onClick={() => {
                    setSearch('');
                    setReadyOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
          footer={
            filtered || many ? (
              <div className="border-t border-row-border px-4 py-2">
                <Pagination
                  hasMore={visible.length < rows.length}
                  onLoadMore={() => setShown((count) => count + NEXT_PAGE)}
                  count={visible.length}
                  itemLabel={['job', 'jobs']}
                  loadMoreLabel={`Show ${Math.min(NEXT_PAGE, rows.length - visible.length)} more`}
                  endLabel={`All ${rows.length} ${rows.length === 1 ? 'job' : 'jobs'} shown`}
                />
              </div>
            ) : null
          }
        />
      )}
    </section>
  );
}
