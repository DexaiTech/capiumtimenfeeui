import { queryKeys } from '@/constants/queryKeys';

import type {
  MissingFilters,
  TimeEntryFilters,
  TimesheetFilters,
  TimeSummaryFilters,
  UtilisationFilters,
} from '../types';

/**
 * Keys of the time data, all under `['org', organizationId, …]`. The recorded time (weeks, days,
 * the calendar, lists, the timer, histories) sits under `time`, the timesheets and the approvals
 * under `timesheets`; the reference lookups (staff, jobs) under their own root, which no
 * recording refreshes, so saving a cell does not reload them.
 */
export const timeKeys = {
  week: (organizationId: string, userId: string, weekOf: string) =>
    [...queryKeys.org.time(organizationId), 'week', userId, weekOf] as const,
  weekEntries: (organizationId: string, userId: string, from: string, to: string) =>
    [...queryKeys.org.time(organizationId), 'week-entries', userId, from, to] as const,
  day: (organizationId: string, userId: string, date: string) =>
    [...queryKeys.org.time(organizationId), 'day', userId, date] as const,
  calendar: (organizationId: string, userId: string, from: string, to: string) =>
    [...queryKeys.org.time(organizationId), 'calendar', userId, from, to] as const,
  entryList: (organizationId: string, filters: TimeEntryFilters) =>
    [...queryKeys.org.time(organizationId), 'list', filters] as const,
  history: (organizationId: string, entryId: string) =>
    [...queryKeys.org.time(organizationId), 'history', entryId] as const,
  timer: (organizationId: string) => [...queryKeys.org.time(organizationId), 'timer'] as const,

  timesheet: (organizationId: string, timesheetId: string) =>
    [...queryKeys.org.timesheets(organizationId), 'detail', timesheetId] as const,
  timesheetList: (organizationId: string, filters: TimesheetFilters) =>
    [...queryKeys.org.timesheets(organizationId), 'list', filters] as const,
  approvals: (organizationId: string) =>
    [...queryKeys.org.timesheets(organizationId), 'approvals'] as const,
  missing: (organizationId: string, filters: MissingFilters) =>
    [...queryKeys.org.timesheets(organizationId), 'missing', filters] as const,

  timeSummary: (organizationId: string, filters: TimeSummaryFilters) =>
    [...queryKeys.org.reports(organizationId), 'time-summary', filters] as const,
  utilisation: (organizationId: string, filters: UtilisationFilters) =>
    [...queryKeys.org.reports(organizationId), 'utilisation', filters] as const,

  staff: (organizationId: string) => ['org', organizationId, 'time-ref', 'staff'] as const,
  job: (organizationId: string, jobId: string) =>
    ['org', organizationId, 'time-ref', 'job', jobId] as const,
  client: (organizationId: string, clientId: string) =>
    ['org', organizationId, 'time-ref', 'client', clientId] as const,
};
