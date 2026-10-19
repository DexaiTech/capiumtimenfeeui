import { addDays } from '@/utils/dates';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A `YYYY-MM-DD` search parameter, or '' for anything else. */
export function isoParam(value: string | null): string {
  return value !== null && ISO_DATE.test(value) ? value : '';
}

function parts(date: string): { year: number; month: number } {
  const [year, month] = date.split('-').map(Number);
  return { year: year ?? 1970, month: month ?? 1 };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** The first day of the month holding `date`. */
export function monthStart(date: string): string {
  const { year, month } = parts(date);
  return `${String(year)}-${pad(month)}-01`;
}

/** The last day of the month holding `date`. */
export function monthEnd(date: string): string {
  const { year, month } = parts(date);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${String(year)}-${pad(month)}-${pad(last)}`;
}

/** A day in another month: the first of the month `months` away from the one holding `date`. */
export function monthsAway(date: string, months: number): string {
  const { year, month } = parts(date);
  const index = year * 12 + (month - 1) + months;
  return `${String(Math.floor(index / 12))}-${pad((index % 12) + 1)}-01`;
}

export interface RangePreset {
  value: string;
  label: string;
  from: string;
  to: string;
}

/** The ranges the period select offers, worked out for `today`. */
export function rangePresets(today: string): RangePreset[] {
  const lastMonth = monthsAway(today, -1);
  return [
    { value: 'this-month', label: 'This month', from: monthStart(today), to: today },
    { value: 'last-month', label: 'Last month', from: lastMonth, to: monthEnd(lastMonth) },
    { value: 'last-3-months', label: 'Last 3 months', from: monthsAway(today, -2), to: today },
    { value: 'this-year', label: 'This year', from: `${today.slice(0, 4)}-01-01`, to: today },
    { value: 'last-12-months', label: 'Last 12 months', from: addDays(today, -364), to: today },
  ];
}

/** The preset a range matches, or `custom`. */
export function presetOf(from: string, to: string, presets: ReadonlyArray<RangePreset>): string {
  return presets.find((preset) => preset.from === from && preset.to === to)?.value ?? 'custom';
}
