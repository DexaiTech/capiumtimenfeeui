import type { ProgressTone } from '@/components/ui';
import { addDays, daysBetween, formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';

import { AMBER_BP, RED_BP, isOpenJob } from '../constants';
import type { Assignee, JobStatus, Rag } from '../types';

/** "J00012 Year-end accounts": the label a job goes by in menus, toasts and dialogs. */
export const jobLabel = (job: { number: string; name: string }) => `${job.number} ${job.name}`;

/** The traffic light of a budget usage in basis points: green under 80%, amber, red from 100%. */
export function ragOfUsage(usageBp: number | null): Rag | null {
  if (usageBp === null) return null;
  if (usageBp >= RED_BP) return 'red';
  if (usageBp >= AMBER_BP) return 'amber';
  return 'green';
}

const TONE_OF_RAG: Record<Rag, ProgressTone> = {
  green: 'success',
  amber: 'warning',
  red: 'danger',
};

/** The colour of a usage bar; a plain one when there is no budget to compare with. */
export function usageTone(usageBp: number | null): ProgressTone {
  const rag = ragOfUsage(usageBp);
  return rag ? TONE_OF_RAG[rag] : 'primary';
}

/** 8333 → 83; the bar's value (a percentage, may exceed 100). */
export const usagePercent = (usageBp: number) => Math.round(usageBp / 100);

/** An open job that is past its due date today (completed and closed jobs are never overdue). */
export function isOverdue(dueDate: string | null, status: JobStatus, today: string): boolean {
  return dueDate !== null && isOpenJob(status) && dueDate < today;
}

/** "Due in 5 days", "Due today", "3 days overdue"; null without a due date. */
export function dueNote(dueDate: string | null, today: string): string | null {
  if (!dueDate) return null;
  const days = daysBetween(today, dueDate);
  if (days === 0) return 'Due today';
  const count = Math.abs(days);
  const unit = count === 1 ? 'day' : 'days';
  return days > 0 ? `Due in ${count} ${unit}` : `${count} ${unit} overdue`;
}

/** "01/04/2026 - 30/06/2026"; one end only reads "From …" or "Until …"; null without dates. */
export function dateSpan(from: string | null, to: string | null): string | null {
  if (from && to) return `${formatUkDate(from)} - ${formatUkDate(to)}`;
  if (from) return `From ${formatUkDate(from)}`;
  if (to) return `Until ${formatUkDate(to)}`;
  return null;
}

/** "12:30 of 40:00": time logged against an hours budget. */
export function hoursOf(logged: number, budget: number | null): string {
  return budget === null
    ? formatMinutes(logged)
    : `${formatMinutes(logged)} of ${formatMinutes(budget)}`;
}

/** The names of a task's assignees, or a dash. */
export function assigneeNames(assignees: ReadonlyArray<Assignee>): string {
  const names = assignees.map((assignee) => assignee.full_name ?? 'Former member');
  return names.length > 0 ? names.join(', ') : '—';
}

/**
 * Whether the person is one of the task's assignees: they may change its status with `job.read`
 * alone (`POST /jobs/{id}/tasks/{id}/status`); anyone else needs `job.update`.
 */
export function isAssignedTo(
  task: { assignees: ReadonlyArray<Assignee> },
  userId: string | undefined,
): boolean {
  return userId !== undefined && task.assignees.some((assignee) => assignee.user_id === userId);
}

/** The first and last day of the month a `YYYY-MM-DD` date is in. */
export function monthRange(day: string): { from: string; to: string } {
  const [year = '1970', month = '01'] = day.split('-');
  const last = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(last).padStart(2, '0')}` };
}

/** "2026-10" moved by whole months (negative goes back). */
export function shiftMonth(month: string, delta: number): string {
  const [year = '1970', mon = '01'] = month.split('-');
  return new Date(Date.UTC(Number(year), Number(mon) - 1 + delta, 1)).toISOString().slice(0, 7);
}

const monthTitle = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026-10" → "October 2026". */
export function monthLabel(month: string): string {
  const [year = '1970', mon = '01'] = month.split('-');
  return monthTitle.format(new Date(Date.UTC(Number(year), Number(mon) - 1, 1)));
}

/** Every day of a "YYYY-MM" month as `YYYY-MM-DD`. */
export function daysOfMonth(month: string): string[] {
  const { from, to } = monthRange(`${month}-01`);
  const count = daysBetween(from, to) + 1;
  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

/** The grid column (0 to 6) of a `YYYY-MM-DD` day when the week starts on `weekStart` (1 = Monday). */
export function weekColumn(day: string, weekStart: number): number {
  const isoWeekday = ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
  return (isoWeekday - weekStart + 7) % 7;
}
