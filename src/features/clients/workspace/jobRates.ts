import { routes } from '@/constants/routes';
import { formatMoney } from '@/utils/money';

import type { JobRate, JobRow } from './types';

/** How the Jobs tab describes a job's rate: the headline and where it comes from. */
export interface JobRateText {
  label: string;
  detail: string;
}

const perHour = (pence: number, currency: string) => `${formatMoney(pence, currency)}/h`;

/** "Task rate £100.00/h", or the range when grades or people differ. */
export function taskRateText(rate: JobRate['task_rate'], currency: string): string {
  if (!rate) return 'Task rate';
  return rate.low === rate.high
    ? `Task rate ${perHour(rate.low, currency)}`
    : `Task rate ${formatMoney(rate.low, currency)}–${perHour(rate.high, currency)}`;
}

function people(count: number | null): string {
  if (!count) return '';
  return count === 1
    ? ' · 1 person has their own client rate'
    : ` · ${count} people have their own client rate`;
}

/**
 * The rate of a job (APT54). With the rates of `GET /clients/{id}/job-rates` it says exactly what
 * the job's time is billed at; while they load (or for a job they do not list) it falls back to
 * the job's own terms.
 */
export function describeJobRate(
  job: Pick<JobRow, 'billing_basis' | 'fixed_fee' | 'hourly_rate' | 'service_name'>,
  rate: JobRate | undefined,
  currency: string,
): JobRateText {
  const source =
    rate?.source ??
    (job.billing_basis === 'fixed'
      ? 'fixed_fee'
      : job.billing_basis === 'non_billable'
        ? 'non_billable'
        : job.hourly_rate !== null
          ? 'job'
          : 'task');
  const extra = people(rate?.person_rules ?? null);
  switch (source) {
    case 'fixed_fee':
      return job.fixed_fee !== null
        ? {
            label: `Fixed fee ${formatMoney(job.fixed_fee, currency)}`,
            detail: 'Billed as a fixed fee',
          }
        : { label: 'Fixed fee', detail: 'No fee set yet' };
    case 'non_billable':
      return { label: 'Non-billable', detail: 'Its time is not billed' };
    case 'client_rule': {
      const rule = rate?.client_rule;
      const scope =
        rule?.level === 'client' ? 'for all work' : `for ${job.service_name ?? 'this service'}`;
      return {
        label: rule ? `Client rate ${perHour(rule.rate, currency)}` : 'Client rate',
        detail: `Agreed with the client ${scope}${extra}`,
      };
    }
    case 'job':
      return {
        label: `Client rate ${perHour(job.hourly_rate ?? 0, currency)}`,
        detail: `Agreed for this job${extra}`,
      };
    case 'task':
      return {
        label: taskRateText(rate?.task_rate ?? null, currency),
        detail:
          rate?.task_rate && rate.task_rate.low !== rate.task_rate.high
            ? `The service's rates, by grade or person${extra}`
            : `The service's rate${extra}`,
      };
    case 'staff':
      return {
        label: 'Staff rates',
        detail: `${job.service_name ? 'No task rate for the service' : 'No service'}: each person's charge-out rate${extra}`,
      };
  }
}

/** Where to re-price the job's unbilled time: the re-rate page with the job chosen. */
export function rerateLink(slug: string, job: Pick<JobRow, 'id' | 'number' | 'name'>): string {
  const query = new URLSearchParams({ job_id: job.id, job: `${job.number} ${job.name}` });
  return `${routes.org.module(slug, 'team', 're-rate')}?${query.toString()}`;
}
