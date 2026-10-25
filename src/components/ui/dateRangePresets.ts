import { addDays } from '@/utils/dates';

export interface DatePreset {
  label: string;
  from: string;
  to: string;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The first day of the week that holds `day`; `firstDay` is 1 for Monday to 7 for Sunday. */
function weekStartOf(day: string, firstDay: number): string {
  const match = ISO.exec(day);
  if (!match) return day;
  const weekday =
    new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay() || 7;
  return addDays(day, -((weekday - firstDay + 7) % 7));
}

function monthRange(day: string, offset: number): { from: string; to: string } {
  const match = ISO.exec(day);
  if (!match) return { from: day, to: day };
  const year = Number(match[1]);
  const month = Number(match[2]) - 1 + offset;
  const first = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  return { from: first, to: last };
}

/** The ranges people ask for most, worked out from today (`YYYY-MM-DD`, in the practice's zone) and its first day of the week. */
export function datePresets(today: string, firstDay = 1): DatePreset[] {
  const monday = weekStartOf(today, firstDay);
  return [
    { label: 'This week', from: monday, to: addDays(monday, 6) },
    { label: 'Last week', from: addDays(monday, -7), to: addDays(monday, -1) },
    { label: 'This month', ...monthRange(today, 0) },
    { label: 'Last month', ...monthRange(today, -1) },
  ];
}
