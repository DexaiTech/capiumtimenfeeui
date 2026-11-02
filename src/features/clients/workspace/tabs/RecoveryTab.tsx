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
import {
  costPlusLabel,
  describeShortfall,
  invoiceParts,
  rateMix,
  rateOrderText,
  recoveryLines,
} from '@/utils/recovery';

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
  compared: boolean,
) {
  if (value === null || shortfall === null || !compared) return dash;
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

/** The job's own rate (the client job-specific rate) and mark-up, under its terms. */
function jobRates(job: JobRecovery, currency: string): string | null {
  const parts: string[] = [];
  if (job.hourly_rate !== null) {
    parts.push(`Client rate ${formatMoney(job.hourly_rate, currency)}/h`);
  }
  if (job.job_markup_bp !== null) parts.push(`mark-up ${formatBasisPoints(job.job_markup_bp)}`);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The "Invoices & Recovery" side of the client's account (`GET /clients/{id}/recovery`,
 * `wip.read`), kept apart from Invoices and Payments: for each job with billable time, what its
 * invoices bill (less the credit notes allocated to them; a draft counts) against the recovery
 * rate (the practice's order of the client job-specific, task and staff rates), each person's own
 * charge-out rate and cost plus the mark-up. Work not invoiced yet is WIP and is not compared, so
 * a fixed fee counts once it is invoiced. Cost plus needs `rate.read`.
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

  const {
    jobs,
    totals,
    show_cost: showCost,
    rate_order: rateOrder,
    credit_on_account: credit,
    client_markup_bp: clientMarkup,
    practice_markup_bp: practiceMarkup,
  } = recovery.data;
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
      cell: (job) => {
        const rates = jobRates(job, currency);
        return (
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
            {rates ? <span className="text-xs text-text-muted">{rates}</span> : null}
          </div>
        );
      },
    },
    {
      id: 'hours',
      header: 'Hours invoiced',
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
          {job.credited_value > 0 || job.draft_value > 0 ? (
            <span className="text-xs text-text-muted">{invoiceParts(job, currency)}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'recovery',
      header: 'Potential recovery',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (job) =>
        basisCell(
          job.recovery_value,
          job.recovery_shortfall,
          job.recovery_bp,
          currency,
          job.minutes > 0,
        ),
    },
    {
      id: 'staff',
      header: 'At staff rates',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (job) =>
        basisCell(
          job.staff_value,
          job.staff_shortfall,
          job.staff_recovery_bp,
          currency,
          job.minutes > 0,
        ),
    },
  ];
  if (showCost) {
    columns.push({
      id: 'cost-plus',
      header: costPlusLabel(totals.markup_bp),
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (job) =>
        basisCell(
          job.cost_plus_value,
          job.cost_plus_shortfall,
          job.cost_plus_recovery_bp,
          currency,
          job.minutes > 0,
        ),
    });
  }
  columns.push({
    id: 'wip',
    header: 'Not invoiced (WIP)',
    align: 'end',
    className: 'whitespace-nowrap',
    cell: (job) =>
      job.wip_minutes > 0 ? (
        <div className="flex flex-col items-end">
          <span className="tabular-nums text-text">{formatMoney(job.wip_value, currency)}</span>
          <span className="text-xs text-text-muted">{formatMinutes(job.wip_minutes)}</span>
        </div>
      ) : (
        dash
      ),
  });

  const mix = rateMix(totals);
  const markup =
    clientMarkup !== null
      ? `the client's mark-up of ${formatBasisPoints(clientMarkup)}`
      : `the practice's mark-up of ${formatBasisPoints(practiceMarkup)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-text">Invoices &amp; Recovery</h2>
        <p className="text-sm text-text-muted">
          What the invoices bill for the work against what it would have billed at the recovery rate
          ({rateOrderText(rateOrder)}: the first that exists), at each person’s own charge-out rate
          and at cost plus {markup} (a job’s own comes first). Work not invoiced yet is WIP: a fixed
          fee counts here once it is invoiced.
        </p>
      </div>
      <RecoveryComparison
        title="Recovery for the client"
        description={`The invoiced work: ${formatMinutes(totals.minutes)}${mix ? ` (${mix})` : ''}. Not invoiced yet: ${formatMinutes(totals.wip_minutes)}, ${formatMoney(totals.wip_value, currency)} of WIP.`}
        invoiceLabel="Invoice value"
        invoiceValue={totals.invoice_value}
        invoiceHint={invoiceParts(totals, currency)}
        lines={recoveryLines(totals)}
        currency={currency}
      />
      {credit > 0 ? (
        <p className="text-sm text-text-muted">
          <span className="font-medium text-text">
            {formatMoney(credit, currency)} credit on account
          </span>{' '}
          (payments not allocated to an invoice): it reduces no invoice until it is allocated to
          one.
        </p>
      ) : null}
      <DataTable
        caption={`Recovery by job for ${clientName}`}
        columns={columns}
        rows={jobs}
        rowKey={(job) => job.job_id ?? 'no-job'}
      />
    </div>
  );
}
