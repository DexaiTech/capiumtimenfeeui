/** The reminder days the API takes: before the due date down to 90 days, after it up to 365. */
export const REMINDER_BEFORE_MAX = 90;
export const REMINDER_AFTER_MAX = 365;
export const REMINDER_STEPS_MAX = 12;

/** "3 days before the due date", "On the due date", "7 days after the due date". */
export function describeReminderDay(day: number): string {
  if (day === 0) return 'On the due date';
  const count = Math.abs(day);
  const unit = count === 1 ? 'day' : 'days';
  return `${String(count)} ${unit} ${day < 0 ? 'before' : 'after'} the due date`;
}

/** The sorted, distinct days: what the form holds and the API stores. */
export function normaliseDays(days: ReadonlyArray<number>): number[] {
  return [...new Set(days)].sort((a, b) => a - b);
}
