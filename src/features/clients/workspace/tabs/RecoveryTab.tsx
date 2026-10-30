import { Target } from 'lucide-react';
import { Link } from 'react-router';

import { RecoveryComparison } from '@/components/common/RecoveryComparison';
import { DataTable, EmptyState, Skeleton, type DataTableColumn } from '@/components/ui';
import { MoneyTone } from '@/components/ui/MoneyTone';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import type { BasisPoints, Pence } from '@/types/api';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints, formatMoney } from '@/utils/money';
import { describeShortfall, recoveryLines } from '@/utils/recovery';

import { useClientRecovery } from '../../api';
import { LoadError } from '../records/RecordTable';
import type { JobRecovery } from '../types';

export interface RecoveryTabProps {
  clientId: string;
  clientName: string;
}

const dash = <span className="text-text-subtle">—</span>;

/** A basis's value with the revenue it leaves on the table (red) or over-recovers (green). */
function basisCell(
  value: Pence | null,
  shortfall: Pence | null,
  recoveryBp: BasisPoints | null,
  currency: string,
) {
  if (value === null || shortfall === null) return dash;
  return (
    <div className="flex flex-col items-end">
      <span className="tabular-nums text-text">{formatMoney(value, currency)}</span>
      <MoneyTone kind="out" value={shortfall} className="text-xs">
        {describeShortfall(shortfall, currency)}
      </MoneyTone>
      {recoveryBp !== null ? (
        <span className="text-xs text-text-muted">{formatBasisPoints(recoveryBp)} recovered</span>
      ) : null}
    </div>
  );
}

/**
 * The "Invoices & Recovery" side of the client's account (`GET /clients/{id}/recovery`,
 * `wip.read`): for each job with billable time, what it was invoiced at (or will be, on its terms)
 * against the task rate, each person's own charge-out rate and cost plus the practice's mark-up,
 * so the practice sees where it leaves revenue on the table. Cost plus needs `rate.read`.
 */
export function RecoveryTab({ clientId, clientName }: RecoveryTabProps) {
  const { organization } = useOrg();
  const recovery = useClientRecovery(clientId);
  const currency = organization.currency;

  if (recovery.isPending) {
    return (
      <div role="status" aria-label="Loading the recovery" className="flex flex-col gap-3">
        <Skeleton shape="rect" className="h-24 w-full" />
        <Skeleton shape="rect" className="h-64 w-full" />
      </div>
    );
  }
  if (recovery.isError) {
    return (
      <LoadError
        title="Could not load the recovery"
        error={recovery.error}
        onRetry={() => void recovery.refetch()}
        retrying={recovery.isRefetching}
      />
    );
  }

  const { jobs, totals, markup_bp: markupBp, show_cost: showCost } = recovery.data;
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface shadow-card">
        <EmptyState
          icon={<Target className="size-6" />}
          title="No billable work yet"
          description={`How the invoices of ${clientName} recover the value of the work will show here once time is logged.`}
        />
      </div>
    );
  }

  const columns: DataTableColumn<JobRecovery>[] = [
    {
      id: 'job',
      header: 'Job',
      cell: (job) => (
        <div className="flex min-w-0 flex-col">
          {job.job_id ? (
            <Link
              to={routes.org.job(organization.slug, job.job_id)}
              className="font-semibold text-brand-text hover:underline"
            >
              {job.number}
              <span className="ml-1.5 font-normal text-text-muted">{job.name}</span>
            </Link>
          ) : (
            <span className="text-text-muted">{job.name}</span>
          )}
          <span className="text-xs text-text-muted">{job.terms}</span>
        </div>
      ),
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      className: 'tabular-nums',
      cell: (job) => formatMinutes(job.minutes),
    },
    {
      id: 'invoice',
      header: 'Invoice value',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (job) => (
        <div className="flex flex-col items-end">
          <span className="font-semibold tabular-nums text-text">
            {formatMoney(job.invoice_value, currency)}
          </span>
          {job.to_bill_value > 0 ? (
            <span className="text-xs text-text-muted">
              {formatMoney(job.to_bill_value, currency)} still to bill
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'task',
      header: 'At task rate',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (job) => basisCell(job.task_value, job.task_shortfall, job.task_recovery_bp, currency),
    },
    {
      id: 'staff',
      header: 'At staff rates',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (job) =>
        basisCell(job.staff_value, job.staff_shortfall, job.staff_recovery_bp, currency),
    },
  ];
  if (showCost) {
    columns.push({
      id: 'cost-plus',
      header: `Cost plus ${formatBasisPoints(markupBp)}`,
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (job) =>
        basisCell(
          job.cost_plus_value,
          job.cost_plus_shortfall,
          job.cost_plus_recovery_bp,
          currency,
        ),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-text">Invoices &amp; Recovery</h2>
        <p className="text-sm text-text-muted">
          What the work was invoiced at against what it would have billed at the task rate (the
          rate of the job or service), at each person’s own charge-out rate and at cost plus the
          practice’s mark-up. Revenue left on the table shows where to bill or staff differently.
        </p>
      </div>
      <RecoveryComparison
        title="Recovery for the client"
        description={`All the billable work: ${formatMinutes(totals.minutes)}.`}
        invoiceLabel="Invoice value"
        invoiceValue={totals.invoice_value}
        invoiceHint={`${formatMoney(totals.invoiced_value, currency)} invoiced, ${formatMoney(totals.to_bill_value, currency)} still to bill`}
        lines={recoveryLines(totals, markupBp)}
        currency={currency}
      />
      <DataTable
        caption={`Recovery by job for ${clientName}`}
        columns={columns}
        rows={jobs}
        rowKey={(job) => job.job_id ?? 'no-job'}
      />
    </div>
  );
}
