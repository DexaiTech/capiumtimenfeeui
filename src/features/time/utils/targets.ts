import type { StaffPerson } from '../types';
import { isoWeekday } from './weeks';

type TargetPerson = Pick<
  StaffPerson,
  'weekly_capacity_minutes' | 'working_days' | 'start_date' | 'leaving_date'
>;

/**
 * The daily targets of `days` for a person, by the rule of the API (`docs/modules/time.md`,
 * "Targets, working days and missing days"): the weekly capacity is divided over the working
 * weekdays, the first of them (in ISO order) take the leftover minutes, and a day off or a day
 * outside the employment period has none.
 */
export function dailyTargets(person: TargetPerson, days: ReadonlyArray<string>): number[] {
  const weekdays = [...new Set(person.working_days)]
    .filter((day) => day >= 1 && day <= 7)
    .sort((a, b) => a - b);
  if (weekdays.length === 0 || person.weekly_capacity_minutes <= 0) return days.map(() => 0);

  const base = Math.floor(person.weekly_capacity_minutes / weekdays.length);
  const extra = person.weekly_capacity_minutes % weekdays.length;
  const perWeekday = new Map(weekdays.map((day, index) => [day, base + (index < extra ? 1 : 0)]));

  return days.map((date) => {
    const employed =
      (!person.start_date || date >= person.start_date) &&
      (!person.leaving_date || date <= person.leaving_date);
    return employed ? (perWeekday.get(isoWeekday(date)) ?? 0) : 0;
  });
}

/** What a person is expected to log in the week of `days`. */
export function weeklyTarget(person: TargetPerson, days: ReadonlyArray<string>): number {
  return dailyTargets(person, days).reduce((sum, minutes) => sum + minutes, 0);
}
