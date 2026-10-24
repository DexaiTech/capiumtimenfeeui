import { addDays, formatUkDate } from '@/utils/dates';

import type { Frequency } from '../types';

export interface JobPeriod {
  periodStart: string;
  /** Inclusive last day of the period; null for a one-off engagement. */
  periodEnd: string | null;
  /** The day the job is created: the period start less the lead days. */
  createOn: string;
}

export interface NextJobInput {
  frequency: Frequency;
  /** `YYYY-MM-DD`; periods are counted from it. */
  startDate: string;
  endDate?: string | null;
  leadDays: number;
  /** `YYYY-MM-DD`: periods that ended before it are never created. */
  today: string;
}

const STEP_MONTHS: Record<Exclude<Frequency, 'one_off'>, number> = {
  monthly: 1,
  quarterly: 3,
  annually: 12,
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parse(iso: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `anchor` plus whole months, the day clamped to the end of a shorter month (31 Jan + 1 = 28 Feb). */
export function addMonths(anchor: string, months: number): string {
  const parts = parse(anchor);
  if (!parts) return '';
  const [year, month, day] = parts;
  const target = month - 1 + months;
  const lastDay = new Date(Date.UTC(year, target + 1, 0)).getUTCDate();
  return format(new Date(Date.UTC(year, target, Math.min(day, lastDay))));
}

/**
 * The period a job would be created for next, by the rule the API applies (the API decides):
 * periods are anchored on the start date, the first one that has not ended yet counts, and none
 * starts after the end date. A one-off engagement has the single period of its start date.
 * Null when the dates do not allow a job.
 */
export function nextJobPeriod(input: NextJobInput): JobPeriod | null {
  const { frequency, startDate, endDate, leadDays, today } = input;
  if (!parse(startDate) || !parse(today)) return null;
  const lead = Number.isFinite(leadDays) ? Math.max(0, Math.floor(leadDays)) : 0;
  const within = (periodStart: string) => !endDate || periodStart <= endDate;

  if (frequency === 'one_off') {
    if (!within(startDate)) return null;
    return { periodStart: startDate, periodEnd: null, createOn: addDays(startDate, -lead) };
  }
  const step = STEP_MONTHS[frequency];
  // Bounded: 12 periods a year is plenty for any start date within a few decades.
  for (let index = 0; index < 1200; index += 1) {
    const periodStart = addMonths(startDate, index * step);
    if (!within(periodStart)) return null;
    const periodEnd = addDays(addMonths(startDate, (index + 1) * step), -1);
    if (periodEnd >= today) {
      return { periodStart, periodEnd, createOn: addDays(periodStart, -lead) };
    }
  }
  return null;
}

/** "Oct 2026" for a month, "Oct-Dec 2026" for a quarter, "Apr 2026 - Mar 2027" for a year. */
export function periodLabel(frequency: Frequency, period: JobPeriod): string {
  const start = parse(period.periodStart);
  if (!start) return '';
  const first = `${MONTHS[start[1] - 1]} ${start[0]}`;
  const end = period.periodEnd ? parse(period.periodEnd) : null;
  if (frequency === 'one_off' || frequency === 'monthly' || !end) return first;
  const last = `${MONTHS[end[1] - 1]} ${end[0]}`;
  if (frequency === 'quarterly' && end[0] === start[0]) {
    return `${MONTHS[start[1] - 1]}-${MONTHS[end[1] - 1]} ${start[0]}`;
  }
  return `${first} - ${last}`;
}

/** The hint under the automation switch, or null while the form has no usable start date. */
export function nextJobHint(input: NextJobInput): string | null {
  if (input.frequency === 'one_off') {
    return parse(input.startDate) ? 'One job, for the start date.' : null;
  }
  const period = nextJobPeriod(input);
  if (!period) return null;
  return `Next job: ${periodLabel(input.frequency, period)}, created on ${formatUkDate(period.createOn)}`;
}
