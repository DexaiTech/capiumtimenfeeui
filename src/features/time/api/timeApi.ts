import { PAGE_SIZE } from '@/constants/limits';
import { api } from '@/services/api';

import { WEEK_ENTRIES_PAGE } from '../constants';
import type {
  ClientRef,
  CopyEntryRequest,
  CopyWeekRequest,
  CopyWeekResult,
  ExportFormat,
  JobRef,
  MissingFilters,
  MissingTimesheet,
  RemindersResult,
  StaffPerson,
  TimeCalendar,
  TimeCorrection,
  TimeDay,
  TimeEntry,
  TimeEntryCreate,
  TimeEntryFilters,
  TimeEntryHistory,
  TimeEntryUpdate,
  Timer,
  TimerStart,
  Timesheet,
  TimesheetDetail,
  TimesheetFilters,
  TimeSummary,
  TimeSummaryFilters,
  Utilisation,
  UtilisationFilters,
  WeekGrid,
} from '../types';
import { fetchEverything } from './pages';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const seg = encodeURIComponent;

export interface PageRequest {
  cursor?: string;
  signal?: AbortSignal;
  limit?: number;
}

/** `me` is the API's default, so it is left out of the query. */
const who = (userId: string | undefined) => (userId === 'me' ? undefined : userId);

const listEntries = (organizationId: string, filters: TimeEntryFilters, page: PageRequest = {}) =>
  api.list<TimeEntry>(`${org(organizationId)}/time-entries`, {
    query: { ...filters, limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
    signal: page.signal,
  });

/**
 * Typed wrappers over the time endpoints (`docs/modules/time.md` and `reports.md` of the API).
 * Query values that are empty are left out by the client.
 */
export const timeApi = {
  /* ------------------------------ Entries and views ------------------------------ */
  listEntries,
  /** Every entry of a date range of one person (a week), following the cursor. */
  listEntriesInRange: (
    organizationId: string,
    userId: string,
    from: string,
    to: string,
    signal?: AbortSignal,
  ) =>
    fetchEverything<TimeEntry>(
      (cursor) =>
        listEntries(
          organizationId,
          { user_id: who(userId), date_from: from, date_to: to },
          { cursor, limit: WEEK_ENTRIES_PAGE, signal },
        ),
      10,
    ),
  getWeek: (organizationId: string, userId: string, weekOf: string, signal?: AbortSignal) =>
    api.get<WeekGrid>(`${org(organizationId)}/time-entries/week`, {
      query: { week_start: weekOf, user_id: who(userId) },
      signal,
    }),
  getDay: (organizationId: string, userId: string, date: string, signal?: AbortSignal) =>
    api.get<TimeDay>(`${org(organizationId)}/time-entries/day`, {
      query: { date, user_id: who(userId) },
      signal,
    }),
  getCalendar: (
    organizationId: string,
    userId: string,
    from: string,
    to: string,
    signal?: AbortSignal,
  ) =>
    api.get<TimeCalendar>(`${org(organizationId)}/time-entries/calendar`, {
      query: { from, to, user_id: who(userId) },
      signal,
    }),
  createEntry: (organizationId: string, body: TimeEntryCreate) =>
    api.post<TimeEntry>(`${org(organizationId)}/time-entries`, body),
  updateEntry: (organizationId: string, entryId: string, body: TimeEntryUpdate) =>
    api.patch<TimeEntry>(`${org(organizationId)}/time-entries/${seg(entryId)}`, body),
  deleteEntry: (organizationId: string, entryId: string) =>
    api.delete<null>(`${org(organizationId)}/time-entries/${seg(entryId)}`),
  copyWeek: (organizationId: string, body: CopyWeekRequest) =>
    api.post<CopyWeekResult>(`${org(organizationId)}/time-entries/copy-week`, body),
  copyEntry: (organizationId: string, entryId: string, body: CopyEntryRequest) =>
    api.post<TimeEntry>(`${org(organizationId)}/time-entries/${seg(entryId)}/copy`, body),
  correctEntry: (organizationId: string, entryId: string, body: TimeCorrection) =>
    api.post<TimeEntry>(`${org(organizationId)}/time-entries/${seg(entryId)}/correct`, body),
  listHistory: (organizationId: string, entryId: string, page: PageRequest = {}) =>
    api.list<TimeEntryHistory>(`${org(organizationId)}/time-entries/${seg(entryId)}/history`, {
      query: { limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),

  /* ----------------------------------- Timer ------------------------------------ */
  getTimer: (organizationId: string, signal?: AbortSignal) =>
    api.get<Timer | null>(`${org(organizationId)}/timer`, { signal }),
  startTimer: (organizationId: string, body: TimerStart) =>
    api.post<Timer>(`${org(organizationId)}/timer/start`, body),
  pauseTimer: (organizationId: string) => api.post<Timer>(`${org(organizationId)}/timer/pause`),
  resumeTimer: (organizationId: string) => api.post<Timer>(`${org(organizationId)}/timer/resume`),
  /** Writes the entry and removes the timer; the description replaces the timer's. */
  stopTimer: (organizationId: string, description?: string | null) =>
    api.post<TimeEntry>(
      `${org(organizationId)}/timer/stop`,
      description === undefined ? undefined : { description },
    ),
  discardTimer: (organizationId: string) => api.delete<null>(`${org(organizationId)}/timer`),

  /* -------------------------------- Timesheets ---------------------------------- */
  listTimesheets: (organizationId: string, filters: TimesheetFilters, page: PageRequest = {}) =>
    api.list<Timesheet>(`${org(organizationId)}/timesheets`, {
      query: { ...filters, limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  getTimesheet: (organizationId: string, timesheetId: string, signal?: AbortSignal) =>
    api.get<TimesheetDetail>(`${org(organizationId)}/timesheets/${seg(timesheetId)}`, { signal }),
  submitTimesheet: (organizationId: string, timesheetId: string) =>
    api.post<TimesheetDetail>(`${org(organizationId)}/timesheets/${seg(timesheetId)}/submit`),
  recallTimesheet: (organizationId: string, timesheetId: string) =>
    api.post<TimesheetDetail>(`${org(organizationId)}/timesheets/${seg(timesheetId)}/recall`),
  approveTimesheet: (organizationId: string, timesheetId: string, note?: string) =>
    api.post<TimesheetDetail>(
      `${org(organizationId)}/timesheets/${seg(timesheetId)}/approve`,
      note ? { decision_note: note } : undefined,
    ),
  /** "Return": the sheet goes back to its owner with the reason. */
  rejectTimesheet: (organizationId: string, timesheetId: string, note: string) =>
    api.post<TimesheetDetail>(`${org(organizationId)}/timesheets/${seg(timesheetId)}/reject`, {
      decision_note: note,
    }),
  listApprovals: (organizationId: string, page: PageRequest = {}) =>
    api.list<Timesheet>(`${org(organizationId)}/approvals`, {
      query: { limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  bulkApprove: (organizationId: string, timesheetIds: string[]) =>
    api.post<Timesheet[]>(`${org(organizationId)}/approvals/bulk-approve`, {
      timesheet_ids: timesheetIds,
    }),
  listMissing: (organizationId: string, filters: MissingFilters, signal?: AbortSignal) =>
    api.get<MissingTimesheet[]>(`${org(organizationId)}/timesheets/missing`, {
      query: { ...filters },
      signal,
    }),
  runReminders: (organizationId: string, weekStart?: string) =>
    api.post<RemindersResult>(
      `${org(organizationId)}/timesheets/reminders/run`,
      weekStart ? { week_start: weekStart } : undefined,
    ),

  /* ----------------------------------- Lookups ---------------------------------- */
  /** Every person of the staff list (active, inactive and left), following the cursor. */
  listStaff: (organizationId: string, signal?: AbortSignal) =>
    fetchEverything<StaffPerson>(
      (cursor) =>
        api.list<StaffPerson>(`${org(organizationId)}/staff`, {
          query: { status: ['active', 'inactive', 'left'], limit: 100, cursor },
          signal,
        }),
      10,
    ),
  getJob: (organizationId: string, jobId: string, signal?: AbortSignal) =>
    api.get<JobRef>(`${org(organizationId)}/jobs/${seg(jobId)}`, { signal }),
  getClient: (organizationId: string, clientId: string, signal?: AbortSignal) =>
    api.get<ClientRef>(`${org(organizationId)}/clients/${seg(clientId)}`, { signal }),

  /* ----------------------------------- Reports ---------------------------------- */
  timeSummary: (organizationId: string, filters: TimeSummaryFilters, signal?: AbortSignal) =>
    api.get<TimeSummary>(`${org(organizationId)}/reports/time-summary`, {
      query: { ...filters },
      signal,
    }),
  utilisation: (organizationId: string, filters: UtilisationFilters, signal?: AbortSignal) =>
    api.get<Utilisation>(`${org(organizationId)}/reports/utilisation`, {
      query: { ...filters },
      signal,
    }),
  /** The report as a download (`csv`, `xlsx` or `pdf`); the API asks for `report.export` too. */
  exportTimeSummary: (organizationId: string, filters: TimeSummaryFilters, format: ExportFormat) =>
    api.getBlob(`${org(organizationId)}/reports/time-summary`, {
      query: { ...filters, format },
    }),
};
