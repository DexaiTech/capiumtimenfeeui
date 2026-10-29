import type { SelectOption } from '@/components/ui';
import { formatUkDate } from '@/utils/dates';

import type {
  LockablePeriodType,
  LockGranularity,
  LockPeriodRow,
  PeriodLockEvent,
  PeriodLockSettings,
} from '../adminTypes';

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

export const MONTH_OPTIONS: SelectOption[] = MONTHS.map((name, n) => ({
  value: String(n + 1),
  label: name,
}));

export const GRANULARITY_OPTIONS: ReadonlyArray<{ value: LockGranularity; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

export const GRANULARITY_HELP: Record<LockGranularity, string> = {
  weekly: 'Lock each week on its own: 52 or 53 weeks a year, shown together in one list.',
  monthly: 'Lock each of the 12 months of the accounting year on its own.',
  quarterly: 'Lock each of the 4 quarters of the accounting year on its own.',
  annually: 'Lock a whole accounting year at once.',
};

/** The kind of lock each way of locking makes. */
export const GRANULARITY_PERIOD: Record<LockGranularity, LockablePeriodType> = {
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  annually: 'year',
};

/** "1 January", "6 April": the day an accounting year starts. */
export function yearStartLabel(settings: PeriodLockSettings): string {
  return `${String(settings.financial_year_start_day)} ${MONTHS[settings.financial_year_start_month - 1] ?? ''}`;
}

/** "Week 3" for a week, the label of the period ("March 2026", "Q1 2026") for the rest. */
export function rowName(row: LockPeriodRow): string {
  return row.period_type === 'week' ? `Week ${String(row.period)}` : row.label;
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
