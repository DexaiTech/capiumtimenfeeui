import type {
  LockPeriodRow,
  LockablePeriodType,
  LockedPeriod,
  LockYearSummary,
  PeriodLock,
  PeriodLockCalendar,
  PeriodLockSettings,
} from '../adminTypes';
import { GRANULARITY_PERIOD, MONTHS } from '../utils/periodLock';

/**
 * The periods of an accounting year as the API lists them (`GET /period-locks/calendar`), for
 * the page tests: weeks begin on a Monday and belong to the year they begin in.
 */

const DAY = 86_400_000;
const utc = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day);
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const uk = (time: number) => iso(time).split('-').reverse().join('/');
const addMonths = (time: number, months: number) => {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate());
};

export function accountingYearOf(day: string, settings: PeriodLockSettings): number {
  const [year = 0, month = 0, date = 0] = day.split('-').map(Number);
  const starts = [settings.financial_year_start_month, settings.financial_year_start_day] as const;
  return month > starts[0] || (month === starts[0] && date >= starts[1]) ? year : year - 1;
}

const yearLabel = (year: number, settings: PeriodLockSettings) =>
  settings.financial_year_start_month === 1 && settings.financial_year_start_day === 1
    ? String(year)
    : `${String(year)}/${String((year + 1) % 100).padStart(2, '0')}`;

function bounds(year: number, settings: PeriodLockSettings) {
  const first = utc(year, settings.financial_year_start_month, settings.financial_year_start_day);
  return { first, last: addMonths(first, 12) - DAY };
}

function slices(type: LockablePeriodType, first: number, last: number) {
  if (type === 'year') return [{ start: first, end: last }];
  if (type === 'week') {
    const weekday = (new Date(first).getUTCDay() + 6) % 7;
    const result = [];
    for (let start = first + ((7 - weekday) % 7) * DAY; start <= last; start += 7 * DAY) {
      result.push({ start, end: start + 6 * DAY });
    }
    return result;
  }
  const length = type === 'quarter' ? 3 : 1;
  return Array.from({ length: 12 / length }, (_, n) => ({
    start: addMonths(first, n * length),
    end: addMonths(first, (n + 1) * length) - DAY,
  }));
}

function labelOf(
  type: LockablePeriodType,
  start: number,
  year: number,
  settings: PeriodLockSettings,
) {
  const date = new Date(start);
  if (type === 'week') return `Week of ${uk(start)}`;
  if (type === 'month')
    return `${MONTHS[date.getUTCMonth()] ?? ''} ${String(date.getUTCFullYear())}`;
  if (type === 'quarter') {
    return `Q${String(Math.floor(date.getUTCMonth() / 3) + 1)} ${String(date.getUTCFullYear())}`;
  }
  return yearLabel(year, settings);
}

function rowsOf(
  year: number,
  settings: PeriodLockSettings,
  locks: ReadonlyArray<LockedPeriod>,
  today: string,
): LockPeriodRow[] {
  const type = GRANULARITY_PERIOD[settings.granularity];
  const { first, last } = bounds(year, settings);
  return slices(type, first, last).map(({ start, end }, n) => {
    const from = iso(start);
    const to = iso(end);
    const exact = locks.find((lock) => lock.start_date === from && lock.end_date === to);
    const other = locks.find((lock) => lock.start_date <= to && lock.end_date >= from);
    const status = exact ? 'locked' : other ? 'blocked' : to > today ? 'future' : 'open';
    return {
      period_type: type,
      year,
      period: n + 1,
      start_date: from,
      end_date: to,
      label: labelOf(type, start, year, settings),
      status,
      lock_id: exact?.id ?? null,
      blocked_by: !exact && other ? other.label : null,
      locked_at: exact?.locked_at ?? null,
      locked_by_name: exact?.locked_by_name ?? null,
    };
  });
}

export function buildCalendar(
  lock: PeriodLock,
  year: number | undefined,
  today: string,
): PeriodLockCalendar {
  const { settings } = lock;
  const current = accountingYearOf(today, settings);
  const shown = year ?? current;
  const { first, last } = bounds(shown, settings);
  const oldest = Math.min(
    current - 5,
    ...lock.periods
      .filter((period) => period.period_type !== 'legacy')
      .map((period) => accountingYearOf(period.start_date, settings)),
  );
  const years: LockYearSummary[] = [];
  for (let n = current; n >= oldest; n -= 1) {
    const rows = rowsOf(n, settings, lock.periods, today);
    const range = bounds(n, settings);
    years.push({
      year: n,
      label: yearLabel(n, settings),
      start_date: iso(range.first),
      end_date: iso(range.last),
      locked: rows.filter((row) => row.status === 'locked').length,
      total: rows.length,
    });
  }
  return {
    settings,
    year: shown,
    label: yearLabel(shown, settings),
    start_date: iso(first),
    end_date: iso(last),
    periods: rowsOf(shown, settings, lock.periods, today),
    years,
  };
}
