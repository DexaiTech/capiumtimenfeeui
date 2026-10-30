import { formatUkDate } from '@/utils/dates';

import type { TimeEntry } from '../types';

type LockFields = Pick<
  TimeEntry,
  'billing_status' | 'timesheet_status' | 'is_locked' | 'period_locked_through'
>;

/**
 * The entry cannot be edited or deleted as it stands: its sheet is submitted or approved, it is no
 * longer unbilled (`is_locked`), or its date lies in a locked period (Settings > Period Lock).
 */
export function isEntryLocked(entry: LockFields): boolean {
  return entry.is_locked || Boolean(entry.period_locked_through);
}

/**
 * Why an entry cannot be edited or deleted, in a few words for an action's label ("Delete entry
 * (the timesheet is submitted)"); null when it can. `canRevoke`: the caller may revoke the approval
 * of its week, so approved time says what to do first. Billing goes first (nothing reopens billed
 * time), then the period lock (revoking would not help), then the sheet.
 */
export function entryLockReason(entry: LockFields, canRevoke = false): string | null {
  if (entry.billing_status === 'in_draft') return 'it is on a draft invoice';
  if (entry.billing_status === 'written_off') return 'it is written off';
  if (entry.billing_status !== 'unbilled') return 'billed time is locked';
  if (entry.period_locked_through) {
    return `the period is locked through ${formatUkDate(entry.period_locked_through)}`;
  }
  if (entry.timesheet_status === 'approved') {
    return canRevoke ? 'revoke approval first' : 'approved time is locked';
  }
  if (entry.timesheet_status === 'submitted') return 'the timesheet is submitted';
  return entry.is_locked ? 'the time is locked' : null;
}
