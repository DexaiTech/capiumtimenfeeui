import { Card } from '@/components/ui';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import type { Job } from '../types';
import { UsageBar } from './StatusBadges';

interface Stat {
  label: string;
  value: string;
  hint: string;
  /** Budget usage in basis points; the bar is left out without a budget. */
  usageBp?: number | null;
  barLabel?: string;
}

/** The four figures of a job: time, its value, work in progress and what was billed. */
export function JobSummaryCards({ job, currency }: { job: Job; currency: string }) {
  const stats: Stat[] = [
    {
      label: 'Time logged',
      value: formatMinutes(job.logged_minutes),
      hint:
        job.budget_minutes === null
          ? `${formatMinutes(job.billable_minutes)} billable, no hours budget`
          : `of ${formatMinutes(job.budget_minutes)} budgeted`,
      usageBp: job.budget_minutes_used_bp,
      barLabel: `Hours budget of ${job.number}`,
    },
    {
      label: 'Time value',
      value: formatMoney(job.time_value, currency),
      hint:
        job.budget_fee === null
          ? 'Billable time at charge-out rates'
          : `of ${formatMoney(job.budget_fee, currency)} budgeted`,
      usageBp: job.budget_fee_used_bp,
      barLabel: `Fee budget of ${job.number}`,
    },
    {
      label: 'Work in progress',
      value: formatMoney(job.wip_value, currency),
      hint: 'Billable time not yet billed',
    },
    {
      label: 'Billed',
      value: formatMoney(job.billed_value, currency),
      hint:
        job.written_off_value > 0
          ? `${formatMoney(job.written_off_value, currency)} written off`
          : 'On issued invoices',
    },
  ];

  return (
    <dl aria-label="Figures of the job" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} padding="sm" className="flex flex-col gap-1">
          <dt className="text-xs text-text-muted">{stat.label}</dt>
          <dd className="text-xl font-semibold text-text tabular-nums">{stat.value}</dd>
          <p className="text-2xs text-text-subtle">{stat.hint}</p>
          {stat.usageBp !== undefined && stat.usageBp !== null ? (
            <UsageBar label={stat.barLabel ?? stat.label} usageBp={stat.usageBp} />
          ) : null}
        </Card>
      ))}
    </dl>
  );
}
