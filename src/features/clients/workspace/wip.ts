import type { Pence } from '@/types/api';
import { daysBetween } from '@/utils/dates';

import type { AgeingKey } from './constants';
import type { WipItem, WipJobRef } from './types';

/**
 * The WIP bucket of an item by its age in days on `today` (both `YYYY-MM-DD`): up to 30 days,
 * 31–60, 61–90 and older — the same cut-offs as the API's WIP summary. A future date counts as new.
 */
export function ageingBucket(date: string, today: string): AgeingKey {
  const age = daysBetween(date, today);
  if (age <= 30) return '0_30';
  if (age <= 60) return '31_60';
  if (age <= 90) return '61_90';
  return '90_plus';
}

/** The value of the items in each ageing bucket. */
export function ageingOf(items: ReadonlyArray<WipItem>, today: string): Record<AgeingKey, Pence> {
  const buckets: Record<AgeingKey, Pence> = { '0_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 };
  for (const item of items) buckets[ageingBucket(item.date, today)] += item.value;
  return buckets;
}

export interface JobWip {
  /** The job's id; `none` for items with no job (an expense recorded against the client). */
  key: string;
  job: WipJobRef | null;
  items: number;
  minutes: number;
  value: Pence;
}

/** The WIP per job, the biggest first; items without a job are one row at the end. */
export function groupByJob(items: ReadonlyArray<WipItem>): JobWip[] {
  const groups = new Map<string, JobWip>();
  for (const item of items) {
    const key = item.job?.id ?? 'none';
    const group = groups.get(key) ?? { key, job: item.job, items: 0, minutes: 0, value: 0 };
    group.items += 1;
    group.minutes += item.minutes ?? 0;
    group.value += item.value;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === 'none') return 1;
    if (b.key === 'none') return -1;
    return b.value - a.value;
  });
}
