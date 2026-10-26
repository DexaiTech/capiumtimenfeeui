import { Card, SegmentedControl } from '@/components/ui';
import { useOrg } from '@/features/organizations';
import type { Pence } from '@/types/api';
import { formatMoney } from '@/utils/money';
import { formatMinutes } from '@/utils/minutes';

import type { Breakdown, BillingBasis, ClientBillingSummary, JobBilling } from '../../types';
import { BASIS_HINTS, BASIS_LABELS } from '../../utils/basis';

interface FigureProps {
  label: string;
  value: string;
  hint?: string;
}

function Figure({ label, value, hint }: FigureProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-text tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-text-subtle">{hint}</dd> : null}
    </div>
  );
}

function BreakdownGrid({
  figures,
  showCost,
  money,
}: {
  figures: Breakdown;
  showCost: boolean;
  money: (pence: Pence) => string;
}) {
  const hasBudget =
    figures.budgeted_cost !== null || figures.agreed_price !== null || figures.actual_cost !== null;
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        <Figure label="Hours logged" value={formatMinutes(figures.logged_minutes)} />
        <Figure label="Billable" value={formatMinutes(figures.billable_minutes)} />
        <Figure label="Non-billable" value={formatMinutes(figures.non_billable_minutes)} />
        <Figure label="Already billed" value={formatMinutes(figures.billed_minutes)} />
        <Figure
          label="Ready to bill"
          value={formatMinutes(figures.ready_minutes)}
          hint={
            figures.awaiting_approval_minutes > 0
              ? `${formatMinutes(figures.awaiting_approval_minutes)} awaiting approval`
              : undefined
          }
        />
      </dl>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Figure label="Time at company rates" value={money(figures.company_time_value)} />
        <Figure label="Time at contract rates" value={money(figures.contract_time_value)} />
        <Figure
          label="Fixed fee"
          value={figures.fixed_fee === null ? '—' : money(figures.fixed_fee)}
          hint={
            figures.fixed_fee === null ? undefined : `${money(figures.fixed_fee_billed)} billed`
          }
        />
        <Figure label="Other costs" value={money(figures.other_costs)} />
      </dl>
      {hasBudget ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Figure
            label="Actual cost"
            value={showCost && figures.actual_cost !== null ? money(figures.actual_cost) : '—'}
            hint="The people who did the work"
          />
          <Figure
            label="Budgeted cost"
            value={figures.budgeted_cost === null ? '—' : money(figures.budgeted_cost)}
            hint="Expected for the service"
          />
          <Figure
            label="Agreed price"
            value={figures.agreed_price === null ? '—' : money(figures.agreed_price)}
            hint="Agreed with the client"
          />
        </dl>
      ) : null}
    </div>
  );
}

function JobCard({
  job,
  showCost,
  money,
}: {
  job: JobBilling;
  showCost: boolean;
  money: (pence: Pence) => string;
}) {
  return (
    <Card padding="lg" role="group" aria-label={`${job.number ?? ''} ${job.name}`.trim()}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">
          {job.number ? `${job.number} ` : ''}
          {job.name}
        </h3>
        <span className="text-xs text-text-muted">{job.terms}</span>
      </div>
      <BreakdownGrid figures={job.breakdown} showCost={showCost} money={money} />
    </Card>
  );
}

export interface BillingSummaryProps {
  summary: ClientBillingSummary;
  basis: BillingBasis;
  onBasisChange: (basis: BillingBasis) => void;
}

/**
 * The client's jobs with their contract terms and the hours spent on them, whatever can be billed
 * now, and the choice of what the invoice is valued on: the contract, the job or the team.
 */
export function BillingSummary({ summary, basis, onBasisChange }: BillingSummaryProps) {
  const { organization } = useOrg();
  const money = (pence: Pence) => formatMoney(pence, organization.currency);
  const values = summary.totals.basis_values;
  const options = (Object.keys(BASIS_LABELS) as BillingBasis[])
    .filter((key) => values[key] !== null)
    .map((key) => ({
      value: key,
      label: `${BASIS_LABELS[key]} ${money(values[key] ?? 0)}`,
    }));

  return (
    <section aria-label="Billing summary" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text">Jobs, hours and contract terms</h2>
          <SegmentedControl
            label="Value the invoice on"
            options={options}
            value={basis}
            onChange={onBasisChange}
          />
        </div>
        <p className="text-xs text-text-muted">{BASIS_HINTS[basis]}</p>
      </div>
      {summary.jobs.length === 0 ? (
        <p className="text-sm text-text-muted">No time has been logged for this client yet.</p>
      ) : (
        <>
          {summary.jobs.map((job) => (
            <JobCard
              key={job.job_id ?? 'no-job'}
              job={job}
              showCost={summary.show_cost}
              money={money}
            />
          ))}
          {summary.jobs.length > 1 ? (
            <Card padding="lg" role="group" aria-label="Total for the client">
              <h3 className="mb-3 text-sm font-semibold text-text">All jobs</h3>
              <BreakdownGrid figures={summary.totals} showCost={summary.show_cost} money={money} />
            </Card>
          ) : null}
        </>
      )}
    </section>
  );
}
