import { routes, safeNextPath } from '@/constants/routes';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { PERIOD_NOUN } from '../constants';
import type {
  ActionKind,
  ApprovalItem,
  CardComparison,
  CardUnit,
  DashboardPeriod,
  MyAction,
} from '../types';

/** A figure the way its card shows it: h:mm, £1,234.56 or a plain count. */
export function formatValue(value: number, unit: CardUnit): string {
  if (unit === 'money') return formatMoney(value);
  if (unit === 'minutes') return formatMinutes(value);
  return new Intl.NumberFormat('en-GB').format(value);
}

const percent = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 3681 → "36.8%"; the sign is carried by the arrow and a hidden word, not by the number. */
export function formatBp(bp: number): string {
  return `${percent.format(Math.abs(bp) / 100)}%`;
}

export interface ChangeText {
  direction: 'up' | 'down' | 'flat';
  /** "36.8%", or the amount itself when there was nothing to take a percentage of. */
  text: string;
}

export function describeChange(comparison: CardComparison, unit: CardUnit): ChangeText {
  if (comparison.change === 0) return { direction: 'flat', text: 'No change' };
  const direction = comparison.change > 0 ? 'up' : 'down';
  const text =
    comparison.change_bp === null
      ? formatValue(Math.abs(comparison.change), unit)
      : formatBp(comparison.change_bp);
  return { direction, text };
}

/** What the comparison is against: "vs last week", "since the start of the month". */
export function comparisonLabel(basis: CardComparison['basis'], period: DashboardPeriod): string {
  const noun = PERIOD_NOUN[period];
  return basis === 'previous_period' ? `vs last ${noun}` : `since the start of the ${noun}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${new Intl.NumberFormat('en-GB').format(count)} ${count === 1 ? singular : plural}`;
}

/** Days until a due date (negative: overdue) in words; null without a date. */
export function dueText(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) return `${pluralize(-days, 'day')} overdue`;
  if (days === 0) return 'Due today';
  return `Due in ${pluralize(days, 'day')}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** "2026-10-12" → "Mon 12", from the date itself (no time zone shift). */
export function weekdayAndDay(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return '';
  return `${WEEKDAYS[day.getUTCDay()] ?? ''} ${String(day.getUTCDate())}`;
}

const monthYear = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026-10-01" → "Oct 2026". */
export function monthLabel(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(day.getTime()) ? '' : monthYear.format(day);
}

/** "12/10/2026 - 18/10/2026". */
export function dateRange(from: string, to: string): string {
  return `${formatUkDate(from)} - ${formatUkDate(to)}`;
}

/**
 * The page a link of the API leads to: a path inside the practice, below `/{slug}`. Anything else
 * (an absolute address, `//host`) leads nowhere, so the API can never send a person off site.
 */
export function practicePath(slug: string, link: string | null | undefined): string | null {
  const safe = safeNextPath(link);
  return safe ? `${routes.org.home(slug)}${safe}` : null;
}

const TIMESHEET_KINDS: ReadonlyArray<ActionKind> = [
  'timesheet_returned',
  'timesheet_to_submit',
  'timesheet_missing',
  'timesheet_approvals',
];
const DUE_KINDS: ReadonlyArray<ActionKind> = ['job_overdue', 'job_due_soon', 'task_overdue'];
const BUDGET_KINDS: ReadonlyArray<ActionKind> = ['budget_exceeded', 'budget_warning'];

/** The small print under an action: the budget used, the week, the due date, the amount. */
export function actionDetails(action: MyAction): string[] {
  const details: string[] = [];
  if (BUDGET_KINDS.includes(action.kind) && action.usage_bp !== null) {
    details.push(`Budget used ${formatBp(action.usage_bp)}`);
  }
  if (DUE_KINDS.includes(action.kind)) {
    const due = dueText(action.days_until_due);
    if (due) details.push(action.date ? `${due} (${formatUkDate(action.date)})` : due);
  } else if (action.date && TIMESHEET_KINDS.includes(action.kind)) {
    details.push(
      action.count > 1
        ? `Oldest: week of ${formatUkDate(action.date)}`
        : `Week of ${formatUkDate(action.date)}`,
    );
  } else if (action.date && !BUDGET_KINDS.includes(action.kind)) {
    details.push(`Oldest: ${formatUkDate(action.date)}`);
  }
  if (action.amount !== null) details.push(`${formatMoney(action.amount)} in total`);
  return details;
}

/** "Week of 05/10/2026, 2:30" for a timesheet; "Train to Leeds, £12.00, 10/09/2026" for a claim. */
export function approvalDetails(item: ApprovalItem): string {
  if (item.kind === 'timesheet') {
    return [`Week of ${formatUkDate(item.date)}`, formatMinutes(item.minutes)]
      .filter(Boolean)
      .join(', ');
  }
  return [
    item.subject,
    item.amount === null ? null : formatMoney(item.amount),
    formatUkDate(item.date),
  ]
    .filter(Boolean)
    .join(', ');
}
