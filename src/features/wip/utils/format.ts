import { chartColorVar, type ChartColor } from '@/components/charts';
import { dayBefore } from '@/utils/dates';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { AGE_BUCKETS, AGED_DAYS, OLD_DAYS } from '../constants';
import type { PersonRef, WipAges } from '../types';

/** "J00001 Year-end accounts"; a dash when there is no job (WIP of the client as a whole). */
export function jobText(job: { number: string | null; name: string | null } | null): string {
  if (!job) return '—';
  return [job.number, job.name].filter(Boolean).join(' ') || 'Job';
}

/** The name of a person; a former member has none. */
export function personName(person: PersonRef | null): string {
  if (!person) return '—';
  return person.full_name ?? 'Former member';
}

/** Money with a plus sign for what is added, so a write-on and a write-off read at a glance. */
export function signedMoney(pence: number, currency: string): string {
  return pence > 0 ? `+${formatMoney(pence, currency)}` : formatMoney(pence, currency);
}

/** A share in basis points as a percentage; a dash when there is nothing to share. */
export function shareText(bp: number | null | undefined): string {
  return bp === null || bp === undefined ? '—' : formatBasisPoints(bp);
}

/** "1 day", "41 days". */
export function daysText(days: number): string {
  return days === 1 ? '1 day' : `${String(days)} days`;
}

/** How worried to be about an item of this age: the last two ageing buckets. */
export function ageTone(days: number | null | undefined): 'red' | 'amber' | 'grey' {
  if (days === null || days === undefined) return 'grey';
  if (days > OLD_DAYS) return 'red';
  if (days > AGED_DAYS) return 'amber';
  return 'grey';
}

export interface AgeSegment {
  key: keyof WipAges;
  label: string;
  color: ChartColor;
  cssColor: string;
  value: number;
  /** 0 to 100 of the bar. */
  percent: number;
}

/** The ageing buckets of a row as the segments of a stacked bar; empty without WIP. */
export function ageSegments(ages: WipAges): AgeSegment[] {
  const total = AGE_BUCKETS.reduce((sum, bucket) => sum + Math.max(0, ages[bucket.key]), 0);
  if (total <= 0) return [];
  return AGE_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    color: bucket.color,
    cssColor: chartColorVar(bucket.color),
    value: ages[bucket.key],
    percent: (Math.max(0, ages[bucket.key]) / total) * 100,
  }));
}

/** The last day of the month before the one `today` is in. */
export function lastMonthEnd(today: string): string {
  return dayBefore(`${today.slice(0, 7)}-01`);
}

/** A `YYYY-MM-DD` value from the address, or null. */
export const isoDate = (value: string | null): string | null =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
