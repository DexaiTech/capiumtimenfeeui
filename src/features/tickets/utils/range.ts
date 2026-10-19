import { addDays, daysBetween } from '@/utils/dates';

/** The longest range the dashboard accepts. */
export const MAX_RANGE_DAYS = 366;

export interface DateSpan {
  from: string;
  to: string;
}

export interface RangePreset {
  id: string;
  label: string;
  span: (today: string) => DateSpan;
}

const lastDays = (days: number) => (today: string) => ({
  from: addDays(today, 1 - days),
  to: today,
});

/** The quick choices of the date-range popover, as spans ending today (or at a month's end). */
export const RANGE_PRESETS: ReadonlyArray<RangePreset> = [
  { id: 'last-7', label: 'Last 7 days', span: lastDays(7) },
  { id: 'last-14', label: 'Last 14 days', span: lastDays(14) },
  { id: 'last-19', label: 'Last 19 days', span: lastDays(19) },
  { id: 'last-30', label: 'Last 30 days', span: lastDays(30) },
  {
    id: 'this-month',
    label: 'This month',
    span: (today) => ({ from: `${today.slice(0, 7)}-01`, to: today }),
  },
  {
    id: 'last-month',
    label: 'Last month',
    span: (today) => {
      const to = addDays(`${today.slice(0, 7)}-01`, -1);
      return { from: `${to.slice(0, 7)}-01`, to };
    },
  },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A date from the URL when it is a plain `YYYY-MM-DD`, else undefined. */
export function isoDateOrUndefined(value: string | null): string | undefined {
  return value && ISO_DATE.test(value) ? value : undefined;
}

/** Why a range cannot be applied (the API refuses it too), or null when it can. */
export function rangeProblem(from: string | null, to: string | null): string | null {
  if (!from || !to) return 'Choose both dates.';
  if (from > to) return 'The start date must be on or before the end date.';
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
    return `Choose at most ${String(MAX_RANGE_DAYS)} days.`;
  }
  return null;
}
