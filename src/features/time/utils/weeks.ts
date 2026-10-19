import { addDays, formatUkDate } from '@/utils/dates';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAYS_LONG = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
const MONTHS = [
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

function parts(date: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(date);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** True for a real `YYYY-MM-DD` calendar date. */
export function isIsoDate(value: string | null | undefined): value is string {
  if (!value) return false;
  const found = parts(value);
  if (!found) return false;
  const date = new Date(Date.UTC(found.year, found.month - 1, found.day));
  return (
    date.getUTCFullYear() === found.year &&
    date.getUTCMonth() === found.month - 1 &&
    date.getUTCDate() === found.day
  );
}

/** ISO weekday of a `YYYY-MM-DD` date: 1 (Monday) to 7 (Sunday). */
export function isoWeekday(date: string): number {
  const found = parts(date);
  if (!found) return 1;
  const day = new Date(Date.UTC(found.year, found.month - 1, found.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The first day of the week that holds `date`, for a practice whose week starts on `firstDay`. */
export function weekStartOf(date: string, firstDay: number): string {
  return addDays(date, -((isoWeekday(date) - firstDay + 7) % 7));
}

/** The seven dates of the week that starts on `weekStart`. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** "Mon" or "Monday". */
export function weekdayName(date: string, style: 'short' | 'long' = 'short'): string {
  const names = style === 'short' ? WEEKDAYS_SHORT : WEEKDAYS_LONG;
  return names[isoWeekday(date) - 1] ?? '';
}

/** "Mon 12/10": the header of a day column. */
export function formatDayHeader(date: string): string {
  const found = parts(date);
  if (!found) return date;
  return `${weekdayName(date)} ${String(found.day).padStart(2, '0')}/${String(found.month).padStart(2, '0')}`;
}

/** "Monday 12/10/2026". */
export function formatLongDay(date: string): string {
  return `${weekdayName(date, 'long')} ${formatUkDate(date)}`;
}

/** "12/10/2026 – 18/10/2026". */
export function formatWeekRange(weekStart: string): string {
  return `${formatUkDate(weekStart)} – ${formatUkDate(addDays(weekStart, 6))}`;
}

/** The first day of the month that holds `date`. */
export function monthStart(date: string): string {
  const found = parts(date);
  if (!found) return date;
  return `${String(found.year).padStart(4, '0')}-${String(found.month).padStart(2, '0')}-01`;
}

/** The last day of the month that holds `date`. */
export function monthEnd(date: string): string {
  const found = parts(date);
  if (!found) return date;
  const last = new Date(Date.UTC(found.year, found.month, 0)).getUTCDate();
  return `${String(found.year).padStart(4, '0')}-${String(found.month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/** The first day of the month `months` away from the one holding `date` (negative goes back). */
export function addMonths(date: string, months: number): string {
  const found = parts(date);
  if (!found) return date;
  return new Date(Date.UTC(found.year, found.month - 1 + months, 1)).toISOString().slice(0, 10);
}

/** "October 2026". */
export function monthLabel(date: string): string {
  const found = parts(date);
  return found ? `${MONTHS[found.month - 1] ?? ''} ${found.year}` : date;
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** The weeks (seven dates each) that cover the month of `date`: what a month calendar draws. */
export function calendarWeeks(date: string, firstDay: number): string[][] {
  const first = weekStartOf(monthStart(date), firstDay);
  const last = monthEnd(date);
  const weeks: string[][] = [];
  for (let start = first; start <= last; start = addDays(start, 7)) weeks.push(weekDates(start));
  return weeks;
}
