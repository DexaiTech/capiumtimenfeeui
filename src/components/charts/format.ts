/** Formats a number of minutes as "0m", "45m", "1h 30m" or "2h". */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return '0m';
  const total = Math.round(Math.abs(minutes));
  const sign = minutes < 0 && total > 0 ? '-' : '';
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${sign}${rest}m`;
  return rest === 0 ? `${sign}${hours}h` : `${sign}${hours}h ${rest}m`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Formats a date (ISO string, timestamp or Date) as a short UTC date such as "Oct 5". Unparseable input is returned as text. */
export function formatShortDate(value: string | number | Date, locale = 'en-US'): string {
  const date =
    typeof value === 'string' && DATE_ONLY.test(value)
      ? new Date(`${value}T00:00:00Z`)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Axis-tick variant of `formatShortDate`; accepts the loosely typed value a chart axis hands over. */
export function formatDateTick(value: string | number, locale?: string): string {
  return formatShortDate(value, locale);
}

/** Formats a ratio (0.25) as a whole percentage ("25%"). */
export function formatPercent(ratio: number): string {
  return `${String(Math.round(ratio * 100))}%`;
}
