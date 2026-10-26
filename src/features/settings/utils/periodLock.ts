import { formatUkDate } from '@/utils/dates';

import type { LockablePeriodType, LockedPeriod, PeriodLockEvent } from '../adminTypes';

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** First and last day of a calendar month, quarter (`index` 1-4) or year. */
export function periodRange(
  type: LockablePeriodType,
  year: number,
  index: number,
): { start: string; end: string } {
  if (type === 'year') return { start: `${String(year)}-01-01`, end: `${String(year)}-12-31` };
  const first = type === 'quarter' ? index * 3 - 2 : index;
  const last = type === 'quarter' ? first + 2 : first;
  return {
    start: iso(new Date(Date.UTC(year, first - 1, 1))),
    end: iso(new Date(Date.UTC(year, last, 0))),
  };
}

/** "March 2026", "Q1 2026" or "2026". */
export function periodName(type: LockablePeriodType, year: number, index: number): string {
  if (type === 'year') return String(year);
  if (type === 'quarter') return `Q${String(index)} ${String(year)}`;
  return `${MONTHS[index - 1] ?? ''} ${String(year)}`;
}

/** Why a period cannot be locked now, or null when it can: not ended yet, or already locked. */
export function lockBlocker(
  periods: ReadonlyArray<LockedPeriod>,
  type: LockablePeriodType,
  year: number,
  index: number,
  today: string,
): string | null {
  const { start, end } = periodRange(type, year, index);
  if (end >= today) return 'not ended yet';
  const clash = periods.some((entry) => entry.start_date <= end && entry.end_date >= start);
  return clash ? 'already locked' : null;
}

/** The month that ended last before `today`: `{ year: 2026, month: 9 }` for "2026-10-18". */
export function lastEndedMonth(today: string): { year: number; month: number } {
  const [year, month] = today.split('-').map(Number);
  const previous = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 2, 1));
  return { year: previous.getUTCFullYear(), month: previous.getUTCMonth() + 1 };
}

/** What an event did, in words: "Locked March 2026", with the old single date when it has one. */
export function describeEvent(event: PeriodLockEvent): { title: string; detail: string } {
  if (event.period_label) {
    return {
      title: `${event.event_type === 'locked' ? 'Locked' : 'Unlocked'} ${event.period_label}`,
      detail: '',
    };
  }
  // Events from before periods existed: one date, before and after.
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
