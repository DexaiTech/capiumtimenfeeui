import { addDays, formatUkDate } from '@/utils/dates';

import type { TimeAmounts, TimeGroupBy, TimeSummaryRow } from '../types';
import { addMonths, monthEnd, monthLabel, monthStart, weekStartOf } from './weeks';

/** The name of a row of the time summary: dates read dd/MM/yyyy, months by name. */
export function groupLabel(groupBy: TimeGroupBy, row: TimeSummaryRow): string {
  if (groupBy === 'day' && row.key) return formatUkDate(row.key);
  if (groupBy === 'week' && row.key) return `Week of ${formatUkDate(row.key)}`;
  if (groupBy === 'month' && row.key) return monthLabel(row.key);
  return row.name;
}

/** Value less cost, or null while the cost is hidden (no `rate.read`). */
export function valueLessCost(
  amounts: Pick<TimeAmounts, 'charge_value' | 'cost_value'>,
): number | null {
  return amounts.cost_value === null ? null : amounts.charge_value - amounts.cost_value;
}

export interface RangePreset {
  value: string;
  label: string;
  from: string;
  to: string;
}

/** The ranges the period select offers, worked out for `today` and the practice's week start. */
export function rangePresets(today: string, firstDay: number): RangePreset[] {
  const thisMonth = monthStart(today);
  const lastMonth = addMonths(today, -1);
  const week = weekStartOf(today, firstDay);
  return [
    { value: 'this-week', label: 'This week', from: week, to: addDays(week, 6) },
    { value: 'this-month', label: 'This month', from: thisMonth, to: monthEnd(today) },
    { value: 'last-month', label: 'Last month', from: lastMonth, to: monthEnd(lastMonth) },
    { value: 'last-30', label: 'Last 30 days', from: addDays(today, -29), to: today },
    { value: 'this-year', label: 'This year', from: `${today.slice(0, 4)}-01-01`, to: today },
  ];
}

/** The preset a range matches, or `custom`. */
export function presetOf(from: string, to: string, presets: ReadonlyArray<RangePreset>): string {
  return presets.find((preset) => preset.from === from && preset.to === to)?.value ?? 'custom';
}

/**
 * The rows a chart draws: periods in date order, every other grouping the biggest ones first and
 * cut after `limit` (the table below lists them all).
 */
export function chartRows(
  rows: ReadonlyArray<TimeSummaryRow>,
  groupBy: TimeGroupBy,
  limit = 12,
): TimeSummaryRow[] {
  const periods = groupBy === 'day' || groupBy === 'week' || groupBy === 'month';
  const ordered = [...rows].sort((a, b) =>
    periods
      ? (a.key ?? '').localeCompare(b.key ?? '')
      : b.total_minutes - a.total_minutes || a.name.localeCompare(b.name),
  );
  return periods ? ordered : ordered.slice(0, limit);
}
