/**
 * Durations are whole minutes (`docs/domain.md`, "Conventions"). People read them as h:mm
 * and type them as h:mm, decimal hours or "1h 30m".
 */

/** 90 → "1:30", 5 → "0:05", 600 → "10:00", -90 → "-1:30". `null` gives an empty string. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '';
  const whole = Math.round(minutes);
  const sign = whole < 0 ? '-' : '';
  const absolute = Math.abs(whole);
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, '0')}`;
}

/** 90 → "1.50", 20 → "0.33": decimal hours to two places, for reports and invoices. */
export function formatDecimalHours(minutes: number | null | undefined, places = 2): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '';
  return (Math.round(minutes) / 60).toFixed(places);
}

/** 90 → "1h 30m", 45 → "45m", 120 → "2h". */
export function formatMinutesLong(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) {
    return '';
  }
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Decimal hours as text to whole minutes, through the digits: "1.5" → 90, "0.25" → 15. */
function decimalHoursToMinutes(whole: string, fraction: string): number {
  const hours = Number(whole || '0');
  if (!fraction) return hours * 60;
  // minutes of the fraction = fraction × 60 / 10^n, rounded half up, in integers.
  const scale = 10 ** fraction.length;
  const fractionMinutes = Math.floor((Number(fraction) * 60 * 2 + scale) / (2 * scale));
  return hours * 60 + fractionMinutes;
}

const CLOCK = /^(\d+):([0-5]\d)$/;
const DECIMAL = /^(\d*)(?:[.,](\d+))?$/;
const UNITS = /^(?:(\d+)(?:[.,](\d+))?\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/;

/**
 * Parses a duration into whole minutes. Accepts "h:mm" ("1:30" → 90), decimal hours
 * ("1.5" → 90, "0,25" → 15, "2" → 120) and units ("1h 30m", "45m", "1.5h").
 * Returns `null` for empty or invalid text.
 */
export function parseMinutes(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (value === '') return null;

  const clock = CLOCK.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const decimal = DECIMAL.exec(value);
  if (decimal && (decimal[1] || decimal[2])) {
    return decimalHoursToMinutes(decimal[1] ?? '', decimal[2] ?? '');
  }

  const units = UNITS.exec(value);
  if (!units || (units[1] === undefined && units[3] === undefined)) return null;
  return decimalHoursToMinutes(units[1] ?? '', units[2] ?? '') + Number(units[3] ?? 0);
}

/** Rounds minutes up to the practice increment (`time_increment_minutes`), as the API does. */
export function roundUpToIncrement(minutes: number, increment: number): number {
  if (increment <= 1) return Math.ceil(minutes);
  return Math.ceil(minutes / increment) * increment;
}

/** Hours as text ("37.5") to whole minutes (2250); `null` when it is not a number. */
export function hoursToMinutes(hours: string): number | null {
  const match = DECIMAL.exec(hours.trim());
  if (!match || !(match[1] || match[2])) return null;
  return decimalHoursToMinutes(match[1] ?? '', match[2] ?? '');
}

/** 2250 → "37.5"; whole hours have no decimals. */
export function minutesToHours(minutes: number): string {
  return String(Math.round((minutes / 60) * 100) / 100);
}
