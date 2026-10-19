import type { MissingTimesheet, StaffPerson, Timesheet, TimesheetStatus } from '../types';
import { weeklyTarget } from './targets';

export type TeamStatus = TimesheetStatus | 'none';

/** One person's week on the Team page: the sheet if there is one, and what is missing. */
export interface TeamRow {
  userId: string;
  name: string;
  /** Null when the staff list is not available to the caller. */
  hasLogin: boolean | null;
  manager: { id: string; name: string } | null;
  status: TeamStatus;
  timesheetId: string | null;
  /** What the person should log in the week; null when it cannot be worked out. */
  expected: number | null;
  logged: number;
  missingDays: string[];
  lastRemindedAt: string | null;
}

export interface TeamInputs {
  missing: ReadonlyArray<MissingTimesheet>;
  sheets: ReadonlyArray<Timesheet>;
  staff: ReadonlyArray<StaffPerson> | undefined;
  /** The seven dates of the week. */
  days: ReadonlyArray<string>;
  /** Only the people this manager approves (needs the staff list). */
  managerId?: string;
}

/**
 * The Team page's rows: everybody whose timesheet for the week is not submitted comes from the
 * missing list (with their expected time, missing days and last reminder), everybody with a
 * submitted or approved sheet from the timesheet list. People who need not record time and have no
 * sheet are not listed.
 */
export function buildTeamRows({ missing, sheets, staff, days, managerId }: TeamInputs): TeamRow[] {
  const people = new Map((staff ?? []).map((person) => [person.id, person]));
  const rows = new Map<string, TeamRow>();

  const managerOf = (userId: string) => {
    const approver = people.get(userId)?.approver;
    return approver ? { id: approver.id, name: approver.full_name } : null;
  };

  for (const item of missing) {
    rows.set(item.user_id, {
      userId: item.user_id,
      name: item.name,
      hasLogin: item.has_login,
      manager: managerOf(item.user_id),
      status: item.status,
      timesheetId: item.timesheet_id,
      expected: item.expected_minutes,
      logged: item.logged_minutes,
      missingDays: item.missing_days,
      lastRemindedAt: item.last_reminded_at,
    });
  }

  for (const sheet of sheets) {
    if (rows.has(sheet.user_id)) continue;
    const person = people.get(sheet.user_id);
    rows.set(sheet.user_id, {
      userId: sheet.user_id,
      name: sheet.user_name ?? person?.full_name ?? 'Unknown person',
      hasLogin: person?.has_login ?? null,
      manager: managerOf(sheet.user_id),
      status: sheet.status,
      timesheetId: sheet.id,
      expected: person ? weeklyTarget(person, days) : null,
      logged: sheet.total_minutes,
      missingDays: [],
      lastRemindedAt: null,
    });
  }

  const all = [...rows.values()];
  const wanted = managerId && staff ? all.filter((row) => row.manager?.id === managerId) : all;
  return wanted.sort((a, b) => a.name.localeCompare(b.name));
}

/** True for a week that still waits for the person: nothing, open or returned. */
export function isMissing(row: TeamRow): boolean {
  return row.status === 'none' || row.status === 'open' || row.status === 'rejected';
}
