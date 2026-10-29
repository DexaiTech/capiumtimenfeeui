/**
 * UK date formats. Calendar dates travel as `YYYY-MM-DD` in the practice's time zone and are
 * shown as `dd/MM/yyyy`; timestamps are UTC and shown in the practice's time zone.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** "2026-10-18" → "18/10/2026". Text of any other shape, null and undefined give "". */
export function formatUkDate(value: string | null | undefined): string {
  const match = value ? ISO_DATE.exec(value) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = timeFormatters.get(timeZone);
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    };
    try {
      formatter = new Intl.DateTimeFormat('en-GB', { ...options, timeZone });
    } catch {
      formatter = new Intl.DateTimeFormat('en-GB', options);
    }
    timeFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** A UTC timestamp as "18/10/2026 14:05" in the given time zone. */
export function formatUkDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(
    dateTimeFormatter(timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  ) as Partial<Record<Intl.DateTimeFormatPartTypes, string>>;
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Today as `YYYY-MM-DD` in a time zone (falls back to the browser's zone for an unknown name). */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  try {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', options).format(now);
  }
}

/** Today as `YYYY-MM-DD` in the browser's own time zone. */
export function todayHere(now: Date = new Date()): string {
  return todayInZone(Intl.DateTimeFormat().resolvedOptions().timeZone, now);
}

/** The day before a `YYYY-MM-DD` date, without any time zone shift. */
export function dayBefore(value: string): string {
  return addDays(value, -1);
}

/** A `YYYY-MM-DD` date moved by whole days (negative goes back), without any time zone shift. */
export function addDays(value: string, days: number): string {
  const match = ISO_DATE.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`), negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = ISO_DATE.exec(from);
  const b = ISO_DATE.exec(to);
  if (!a || !b) return 0;
  const start = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const end = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((end - start) / 86_400_000);
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * "2026-10-17" → "17-Oct-2026". A timestamp is first moved to its calendar day in `timeZone`
 * (without a zone its UTC date is used). Anything that is not a date gives "".
 */
export function formatDayMonthYear(value: string | null | undefined, timeZone?: string): string {
  if (!value) return '';
  const day = value.length > 10 && timeZone ? calendarDay(value, timeZone) : value;
  const match = ISO_DATE.exec(day);
  const month = match ? MONTH_NAMES[Number(match[2]) - 1] : undefined;
  return match && month ? `${match[3]}-${month}-${match[1]}` : '';
}

function calendarDay(iso: string, timeZone: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : todayInZone(timeZone, date);
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * ISO weekdays (1 = Monday) as a short text: [1,2,3,4,5] → "Mon–Fri", [1,3] → "Mon, Wed",
 * all seven → "Every day".
 */
export function formatWeekdays(days: ReadonlyArray<number>): string {
  const sorted = [...new Set(days)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);
  if (sorted.length === 0) return '—';
  if (sorted.length === 7) return 'Every day';
  const first = sorted[0] ?? 1;
  const last = sorted[sorted.length - 1] ?? first;
  const name = (day: number) => WEEKDAY_NAMES[day - 1] ?? '';
  const contiguous = last - first === sorted.length - 1;
  if (contiguous && sorted.length >= 3) return `${name(first)}–${name(last)}`;
  return sorted.map(name).join(', ');
}
