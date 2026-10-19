import { formatUkDate } from '@/utils/dates';

import type { PeriodLockEvent } from '../adminTypes';

/** The last day of the month before the one holding `today`: "2026-09-30" for "2026-10-18". */
export function lastMonthEnd(today: string): string {
  const [year, month] = today.split('-').map(Number);
  const day = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 0));
  return day.toISOString().slice(0, 10);
}

/** What an event did, in words: "Locked through 31/03/2026", with where the lock was before. */
export function describeEvent(event: PeriodLockEvent): { title: string; detail: string } {
  const was = event.previous_locked_through
    ? `Was locked through ${formatUkDate(event.previous_locked_through)}`
    : 'Nothing was locked before';
  if (event.event_type === 'locked') {
    return { title: `Locked through ${formatUkDate(event.locked_through)}`, detail: was };
  }
  return {
    title: event.locked_through
      ? `Reopened to ${formatUkDate(event.locked_through)}`
      : 'Lock removed',
    detail: event.previous_locked_through ? was : '',
  };
}
