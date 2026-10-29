import { http, HttpResponse, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';
import { addDays, formatUkDate } from '@/utils/dates';

import type {
  CalendarDay,
  CopySkipped,
  RemindersResult,
  TimeEntry,
  TimeEntryCreate,
  TimeEntryHistory,
  TimeEntryUpdate,
  Timer,
  Timesheet,
  TimesheetDetail,
  TimesheetStatus,
  Utilisation,
  WeekGrid,
  WeekGridRow,
} from '../types';
import { dailyTargets } from '../utils/targets';
import { monthLabel, weekDates, weekStartOf } from '../utils/weeks';
import {
  ACTIVITIES,
  CHARGE_RATE,
  CLIENTS,
  COST_RATE,
  JOBS,
  PEOPLE,
  TODAY,
  ME,
  poundsFor,
  sheetId,
  weekEntries,
} from './fixtures';

export { orgApiPath };

export interface Call {
  method: string;
  /** Path below the practice, for example `/time-entries/week`. */
  path: string;
  query: URLSearchParams;
  body: unknown;
}

export interface Sheet {
  id: string;
  user_id: string;
  week_start: string;
  status: TimesheetStatus;
  submitted_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

/** The state the fake time API keeps, and the knobs a test turns. */
export interface TimeBackend {
  entries: TimeEntry[];
  sheets: Sheet[];
  timer: Timer | null;
  history: Record<string, TimeEntryHistory[]>;
  /** Every request the page made, in order. */
  calls: Call[];
  /** Time on or before this date is refused with 409 `PERIOD_LOCKED`. */
  lockedThrough: string | null;
  /** Jobs that refuse time (409 `JOB_CLOSED`), besides those whose status is closed. */
  closedJobs: Set<string>;
  /** Source entries that `copy-week` leaves out, with the reason. */
  skipCopy: Record<string, CopySkipped>;
  /** Whether the caller sees cost figures (`rate.read`). */
  seesCost: boolean;
  increment: number;
  /** People who were reminded about the week, by user id. */
  reminded: Record<string, string>;
  reminders: RemindersResult;
  utilisation: Utilisation;
  /** The signed-in person. */
  userId: string;
  nextId: number;
}

const END = { next_cursor: null, has_more: false };
const NOW = '2026-10-14T10:00:00Z';

const uk = (date: string) => formatUkDate(date);

export function createBackend(overrides: Partial<TimeBackend> = {}): TimeBackend {
  const entries = overrides.entries ?? weekEntries();
  const sheets: Sheet[] = overrides.sheets ?? [];
  if (!overrides.sheets) {
    for (const item of entries) {
      const week = weekStartOf(item.entry_date, 1);
      if (!sheets.some((sheet) => sheet.user_id === item.user_id && sheet.week_start === week)) {
        sheets.push({
          id: sheetId(item.user_id, week),
          user_id: item.user_id,
          week_start: week,
          status: item.timesheet_status,
          submitted_at: item.timesheet_status === 'open' ? null : '2026-10-16T16:00:00Z',
          decided_at: item.timesheet_status === 'approved' ? '2026-10-17T09:00:00Z' : null,
          decision_note: null,
        });
      }
    }
  }
  return {
    entries,
    sheets,
    timer: null,
    history: {},
    calls: [],
    lockedThrough: null,
    closedJobs: new Set(),
    skipCopy: {},
    seesCost: true,
    increment: 6,
    reminded: {},
    reminders: {
      week_start: '2026-10-05',
      missing: 2,
      reminded: 2,
      already_reminded: 0,
      unreachable: 1,
      sheets_waiting: 1,
      approvers_reminded: 1,
      approvers_already_reminded: 0,
      disabled: [],
    },
    utilisation: {
      rows: [
        {
          user_id: ME,
          full_name: 'Ada Lovelace',
          initials: 'AL',
          status: 'active',
          capacity_minutes: 9000,
          total_minutes: 7200,
          chargeable_minutes: 6300,
          non_chargeable_minutes: 900,
          utilisation_bp: 7000,
          target_bp: 7500,
          variance_bp: -500,
        },
      ],
      totals: {
        working_days: 20,
        capacity_minutes: 9000,
        total_minutes: 7200,
        chargeable_minutes: 6300,
        non_chargeable_minutes: 900,
        utilisation_bp: 7000,
        target_bp: 7500,
        variance_bp: -500,
      },
    },
    userId: ME,
    nextId: 100,
    ...overrides,
  };
}

/** A page of `rows` after the cursor (an index), `size` rows at a time. */
function paged<T>(rows: T[], params: URLSearchParams) {
  const size = Number(params.get('limit') ?? rows.length) || rows.length;
  const start = Number(params.get('cursor') ?? 0);
  const next = start + size;
  return {
    rows: rows.slice(start, next),
    meta: next < rows.length ? { next_cursor: String(next), has_more: true } : END,
  };
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Every handler of the time endpoints over one backend; the backend is what a test asserts on. */
export function timeHandlers(backend: TimeBackend): HttpHandler[] {
  const round = (minutes: number) => Math.ceil(minutes / backend.increment) * backend.increment;
  const person = (id: string) => PEOPLE.find((candidate) => candidate.id === id);
  const sheetFor = (userId: string, week: string) =>
    backend.sheets.find((sheet) => sheet.user_id === userId && sheet.week_start === week);
  const ensureSheet = (userId: string, week: string): Sheet => {
    const found = sheetFor(userId, week);
    if (found) return found;
    const created: Sheet = {
      id: sheetId(userId, week),
      user_id: userId,
      week_start: week,
      status: 'open',
      submitted_at: null,
      decided_at: null,
      decision_note: null,
    };
    backend.sheets.push(created);
    return created;
  };
  const view = (item: TimeEntry): TimeEntry => {
    const sheet = sheetFor(item.user_id, weekStartOf(item.entry_date, 1));
    const status = sheet?.status ?? 'open';
    return {
      ...item,
      timesheet_id: sheet?.id ?? item.timesheet_id,
      timesheet_status: status,
      cost_rate: backend.seesCost ? item.cost_rate : null,
      cost_value: backend.seesCost ? item.cost_value : null,
      is_locked:
        status === 'submitted' || status === 'approved' || item.billing_status !== 'unbilled',
    };
  };
  const owned = (userId: string, from: string, to: string) =>
    backend.entries.filter(
      (item) => item.user_id === userId && item.entry_date >= from && item.entry_date <= to,
    );
  const targetsOf = (userId: string, days: string[]) =>
    dailyTargets(
      person(userId) ?? {
        weekly_capacity_minutes: 2250,
        working_days: [1, 2, 3, 4, 5],
        start_date: null,
        leaving_date: null,
      },
      days,
    );
  const minutesOn = (userId: string, date: string) =>
    sum(
      backend.entries
        .filter((item) => item.user_id === userId && item.entry_date === date)
        .map((item) => item.minutes),
    );

  const sheetRead = (sheet: Sheet): Timesheet => {
    const week = owned(sheet.user_id, sheet.week_start, addDays(sheet.week_start, 6));
    return {
      id: sheet.id,
      user_id: sheet.user_id,
      user_name: person(sheet.user_id)?.full_name ?? null,
      week_start: sheet.week_start,
      week_end: addDays(sheet.week_start, 6),
      status: sheet.status,
      submitted_at: sheet.submitted_at,
      decided_by: sheet.decided_at ? ME : null,
      decided_at: sheet.decided_at,
      decision_note: sheet.decision_note,
      entry_count: week.length,
      total_minutes: sum(week.map((item) => item.minutes)),
      billable_minutes: sum(week.filter((item) => item.is_billable).map((item) => item.minutes)),
      non_billable_minutes: sum(
        week.filter((item) => !item.is_billable).map((item) => item.minutes),
      ),
      billable_value: sum(week.filter((item) => item.is_billable).map((item) => item.charge_value)),
      created_at: '2026-10-12T08:00:00Z',
      updated_at: NOW,
    };
  };
  const detail = (sheet: Sheet): TimesheetDetail => {
    const week = owned(sheet.user_id, sheet.week_start, addDays(sheet.week_start, 6));
    return {
      ...sheetRead(sheet),
      entries: week.map(view),
      day_totals: weekDates(sheet.week_start).map((day) => ({
        day,
        minutes: sum(week.filter((item) => item.entry_date === day).map((item) => item.minutes)),
      })),
    };
  };

  const grid = (userId: string, weekOf: string): WeekGrid => {
    const start = weekStartOf(weekOf, 1);
    const days = weekDates(start);
    const mine = owned(userId, start, days[6] ?? start);
    const rows: WeekGridRow[] = [];
    for (const item of mine) {
      let row = rows.find(
        (candidate) =>
          candidate.client_id === item.client_id &&
          candidate.job_id === item.job_id &&
          candidate.activity_code_id === item.activity_code_id &&
          candidate.is_billable === item.is_billable,
      );
      if (!row) {
        row = {
          client_id: item.client_id,
          client_code: item.client_code,
          client_name: item.client_name,
          job_id: item.job_id,
          job_number: item.job_number,
          job_name: item.job_name,
          activity_code_id: item.activity_code_id,
          activity_code: item.activity_code,
          activity_name: item.activity_name,
          is_billable: item.is_billable,
          minutes: days.map(() => 0),
          total_minutes: 0,
          entry_ids: [],
        };
        rows.push(row);
      }
      const index = days.indexOf(item.entry_date);
      row.minutes[index] = (row.minutes[index] ?? 0) + item.minutes;
      row.total_minutes += item.minutes;
      row.entry_ids.push(item.id);
    }
    const targets = targetsOf(userId, days);
    const totals = days.map((day) =>
      sum(mine.filter((item) => item.entry_date === day).map((item) => item.minutes)),
    );
    const sheet = sheetFor(userId, start);
    const working = days.filter((_, index) => (targets[index] ?? 0) > 0);
    return {
      user_id: userId,
      week_start: start,
      week_end: days[6] ?? start,
      days,
      timesheet_id: sheet?.id ?? null,
      timesheet_status: sheet?.status ?? 'open',
      rows,
      day_totals: totals,
      total_minutes: sum(totals),
      chargeable_minutes: sum(mine.filter((item) => item.is_billable).map((item) => item.minutes)),
      non_chargeable_minutes: sum(
        mine.filter((item) => !item.is_billable).map((item) => item.minutes),
      ),
      today: TODAY,
      targets: {
        daily_minutes: Object.fromEntries(days.map((day, index) => [day, targets[index] ?? 0])),
        weekly_minutes: sum(targets),
      },
      working_days: working,
      missing_days: working.filter((day) => day <= TODAY && minutesOn(userId, day) === 0),
      day_variance: totals.map((total, index) => total - (targets[index] ?? 0)),
    };
  };

  /** What a write must pass before it is stored (the rules of time in `docs/modules/time.md`). */
  const refuse = (
    userId: string,
    date: string,
    jobId: string | null | undefined,
    extra = 0,
    skipId?: string,
  ) => {
    if (backend.lockedThrough && date <= backend.lockedThrough) {
      return fail(
        409,
        'PERIOD_LOCKED',
        `Time dated ${uk(date)} cannot be changed: the period is locked through ${uk(backend.lockedThrough)}.`,
        { details: { date, locked_through: backend.lockedThrough, area: 'time' } },
      );
    }
    const job = JOBS.find((candidate) => candidate.id === jobId);
    if (jobId && (backend.closedJobs.has(jobId) || (job && job.status === 'completed'))) {
      return fail(409, 'JOB_CLOSED', 'Time cannot be logged on a completed or cancelled job.');
    }
    const status = sheetFor(userId, weekStartOf(date, 1))?.status;
    if (status === 'submitted' || status === 'approved') {
      return fail(
        409,
        'TIME_LOCKED',
        'This time is locked: its timesheet is submitted or approved.',
      );
    }
    const others = sum(
      backend.entries
        .filter((item) => item.user_id === userId && item.entry_date === date && item.id !== skipId)
        .map((item) => item.minutes),
    );
    if (others + extra > 1440) {
      return fail(422, 'DAY_LIMIT_EXCEEDED', 'A person can log at most 24 hours in a day.', {
        details: [
          {
            field: 'minutes',
            code: 'day_limit',
            message: `This would make ${others + extra} minutes on ${date}; the most is 1440.`,
          },
        ],
      });
    }
    return null;
  };

  const newEntry = (body: TimeEntryCreate, userId: string, createdBy: string): TimeEntry => {
    backend.nextId += 1;
    const job = JOBS.find((candidate) => candidate.id === body.job_id);
    const client = CLIENTS.find((candidate) => candidate.id === (body.client_id ?? job?.client_id));
    const activity = ACTIVITIES.find((candidate) => candidate.id === body.activity_code_id);
    const minutes = round(body.minutes);
    const billable = body.is_billable ?? Boolean(client && activity?.is_chargeable !== false);
    const week = weekStartOf(body.entry_date, 1);
    const sheet = ensureSheet(userId, week);
    return {
      id: `new-${backend.nextId}`,
      user_id: userId,
      timesheet_id: sheet.id,
      timesheet_status: sheet.status,
      entry_date: body.entry_date,
      minutes,
      client_id: client?.id ?? null,
      client_code: client?.code ?? null,
      client_name: client?.name ?? null,
      job_id: job?.id ?? null,
      job_number: job?.number ?? null,
      job_name: job?.name ?? null,
      service_id: job?.service_id ?? null,
      service_name: job?.service_name ?? null,
      activity_code_id: activity?.id ?? null,
      activity_code: activity?.code ?? null,
      activity_name: activity?.name ?? null,
      description: body.description ?? null,
      internal_note: body.internal_note ?? null,
      is_billable: billable,
      charge_rate: CHARGE_RATE,
      charge_value: poundsFor(minutes, CHARGE_RATE),
      cost_rate: COST_RATE,
      cost_value: poundsFor(minutes, COST_RATE),
      rate_source: 'job',
      billing_status: 'unbilled',
      is_locked: false,
      created_by: createdBy,
      created_at: NOW,
      updated_at: NOW,
    };
  };

  const record = async (request: Request): Promise<unknown> => {
    const url = new URL(request.url);
    const text =
      request.method === 'GET' || request.method === 'DELETE' ? '' : await request.clone().text();
    let body: unknown;
    try {
      body = text ? (JSON.parse(text) as unknown) : undefined;
    } catch {
      body = text;
    }
    backend.calls.push({
      method: request.method,
      path: url.pathname.replace(/^.*\/organizations\/[^/]+/, ''),
      query: url.searchParams,
      body,
    });
    return body;
  };

  const notFound = () => fail(404, 'RESOURCE_NOT_FOUND', 'Not found.');
  const whose = (params: URLSearchParams) => {
    const id = params.get('user_id');
    return id === null || id === 'me' ? backend.userId : id;
  };

  return [
    /* ---------------------------------- Views --------------------------------- */
    http.get(orgApiPath('/time-entries/week'), async ({ request }) => {
      await record(request);
      const params = new URL(request.url).searchParams;
      return ok(grid(whose(params), params.get('week_start') ?? TODAY));
    }),
    http.get(orgApiPath('/time-entries/day'), async ({ request }) => {
      await record(request);
      const params = new URL(request.url).searchParams;
      const date = params.get('date') ?? TODAY;
      const userId = whose(params);
      const day = owned(userId, date, date);
      const target = targetsOf(userId, [date])[0] ?? 0;
      const total = sum(day.map((item) => item.minutes));
      return ok({
        user_id: userId,
        date,
        week_start: weekStartOf(date, 1),
        timesheet_id: sheetFor(userId, weekStartOf(date, 1))?.id ?? null,
        timesheet_status: sheetFor(userId, weekStartOf(date, 1))?.status ?? 'open',
        is_working_day: target > 0,
        entries: day.map(view),
        total_minutes: total,
        billable_minutes: sum(day.filter((item) => item.is_billable).map((item) => item.minutes)),
        non_billable_minutes: sum(
          day.filter((item) => !item.is_billable).map((item) => item.minutes),
        ),
        target_minutes: target,
        remaining_minutes: Math.max(0, target - total),
        variance_minutes: total - target,
        timer: userId === backend.userId ? backend.timer : null,
      });
    }),
    http.get(orgApiPath('/time-entries/calendar'), async ({ request }) => {
      await record(request);
      const params = new URL(request.url).searchParams;
      const from = params.get('from') ?? TODAY;
      const to = params.get('to') ?? TODAY;
      const userId = whose(params);
      const days: CalendarDay[] = [];
      for (let day = from; day <= to; day = addDays(day, 1)) {
        const mine = owned(userId, day, day);
        const target = targetsOf(userId, [day])[0] ?? 0;
        days.push({
          date: day,
          week_start: weekStartOf(day, 1),
          entry_count: mine.length,
          total_minutes: sum(mine.map((item) => item.minutes)),
          billable_minutes: sum(
            mine.filter((item) => item.is_billable).map((item) => item.minutes),
          ),
          target_minutes: target,
          is_working_day: target > 0,
          timesheet_status: sheetFor(userId, weekStartOf(day, 1))?.status ?? 'open',
        });
      }
      return ok({
        user_id: userId,
        date_from: from,
        date_to: to,
        days,
        total_minutes: sum(days.map((day) => day.total_minutes)),
        billable_minutes: sum(days.map((day) => day.billable_minutes)),
        target_minutes: sum(days.map((day) => day.target_minutes)),
      });
    }),

    /* ------------------------------ Copying and lists ------------------------- */
    http.post(orgApiPath('/time-entries/copy-week'), async ({ request }) => {
      const body = (await record(request)) as {
        from_week_start: string;
        to_week_start: string;
        include_notes?: boolean;
      };
      const from = weekStartOf(body.from_week_start, 1);
      const to = weekStartOf(body.to_week_start, 1);
      const target = sheetFor(backend.userId, to);
      if (target && (target.status === 'submitted' || target.status === 'approved')) {
        return fail(
          409,
          'TIMESHEET_NOT_EDITABLE',
          'The timesheet of that week cannot take new time.',
        );
      }
      const offset = (Date.parse(to) - Date.parse(from)) / 86_400_000;
      const created: TimeEntry[] = [];
      const skipped: CopySkipped[] = [];
      for (const source of owned(backend.userId, from, addDays(from, 6))) {
        const forced = backend.skipCopy[source.id];
        const date = addDays(source.entry_date, offset);
        const closed =
          source.job_id !== null &&
          JOBS.find((job) => job.id === source.job_id)?.status === 'completed';
        if (forced) {
          skipped.push(forced);
          continue;
        }
        if (closed) {
          skipped.push({
            source_entry_id: source.id,
            code: 'JOB_CLOSED',
            message: 'Time cannot be logged on a completed or cancelled job.',
          });
          continue;
        }
        const copy = newEntry(
          {
            entry_date: date,
            minutes: source.minutes,
            client_id: source.client_id,
            job_id: source.job_id,
            activity_code_id: source.activity_code_id,
            description: source.description,
            internal_note: body.include_notes ? source.internal_note : null,
            is_billable: source.is_billable,
          },
          backend.userId,
          backend.userId,
        );
        backend.entries.push(copy);
        created.push(view(copy));
      }
      return ok({ from_week_start: from, to_week_start: to, created, skipped });
    }),
    http.get(orgApiPath('/time-entries'), async ({ request }) => {
      await record(request);
      const params = new URL(request.url).searchParams;
      const userParam = params.get('user_id');
      const billing = params.getAll('billing_status');
      const sheets = params.getAll('timesheet_status');
      const list = backend.entries
        .filter((item) => {
          if (userParam === null || userParam === 'me') {
            if (item.user_id !== backend.userId) return false;
          } else if (userParam !== 'all' && item.user_id !== userParam) {
            return false;
          }
          return (
            (!params.get('date_from') || item.entry_date >= (params.get('date_from') ?? '')) &&
            (!params.get('date_to') || item.entry_date <= (params.get('date_to') ?? '')) &&
            (!params.get('client_id') || item.client_id === params.get('client_id')) &&
            (!params.get('job_id') || item.job_id === params.get('job_id')) &&
            (params.get('billable') === null ||
              String(item.is_billable) === params.get('billable')) &&
            (billing.length === 0 || billing.includes(item.billing_status)) &&
            (sheets.length === 0 || sheets.includes(view(item).timesheet_status))
          );
        })
        .sort(
          (a, b) =>
            b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at),
        )
        .map(view);
      const page = paged(list, params);
      return ok(page.rows, { meta: page.meta });
    }),
    http.post(orgApiPath('/time-entries'), async ({ request }) => {
      const body = (await record(request)) as TimeEntryCreate;
      const userId = body.user_id ?? backend.userId;
      const refusal = refuse(userId, body.entry_date, body.job_id, round(body.minutes));
      if (refusal) return refusal;
      const created = newEntry(body, userId, backend.userId);
      backend.entries.push(created);
      return ok(view(created), { status: 201, message: 'Time logged' });
    }),
    http.get(orgApiPath('/time-entries/:entryId/history'), async ({ request, params }) => {
      await record(request);
      const items = backend.history[String(params.entryId)] ?? [];
      const page = paged(items, new URL(request.url).searchParams);
      return ok(page.rows, { meta: page.meta });
    }),
    http.post(orgApiPath('/time-entries/:entryId/copy'), async ({ request, params }) => {
      const body = (await record(request)) as { date: string; include_notes?: boolean };
      const source = backend.entries.find((item) => item.id === params.entryId);
      if (!source) return notFound();
      const refusal = refuse(source.user_id, body.date, source.job_id, source.minutes);
      if (refusal) return refusal;
      const copy = newEntry(
        {
          entry_date: body.date,
          minutes: source.minutes,
          client_id: source.client_id,
          job_id: source.job_id,
          activity_code_id: source.activity_code_id,
          description: source.description,
          internal_note: body.include_notes ? source.internal_note : null,
          is_billable: source.is_billable,
        },
        source.user_id,
        backend.userId,
      );
      backend.entries.push(copy);
      return ok(view(copy), { status: 201 });
    }),
    http.post(orgApiPath('/time-entries/:entryId/correct'), async ({ request, params }) => {
      const body = (await record(request)) as Record<string, unknown> & { reason?: string };
      const found = backend.entries.find((item) => item.id === params.entryId);
      if (!found) return notFound();
      if (!body.reason?.trim()) {
        return fail(422, 'TIME_CORRECTION_REASON_REQUIRED', 'Say why the time is corrected.', {
          details: [
            { field: 'reason', code: 'required', message: 'Say why the time is corrected.' },
          ],
        });
      }
      const shown = view(found);
      if (shown.timesheet_status !== 'approved' || found.billing_status !== 'unbilled') {
        return fail(409, 'TIME_NOT_CORRECTABLE', 'Only approved, unbilled time can be corrected.');
      }
      const before = { ...found };
      const minutes = typeof body.minutes === 'number' ? round(body.minutes) : found.minutes;
      const date = typeof body.date === 'string' ? body.date : found.entry_date;
      const refusal = refuse(found.user_id, date, found.job_id, minutes, found.id);
      if (refusal && backend.lockedThrough && date <= backend.lockedThrough) return refusal;
      found.minutes = minutes;
      found.entry_date = date;
      if (typeof body.description === 'string' || body.description === null) {
        found.description = body.description;
      }
      if (typeof body.billable === 'boolean') found.is_billable = body.billable;
      found.charge_value = poundsFor(minutes, found.charge_rate);
      found.cost_value = poundsFor(minutes, COST_RATE);
      const changes: Record<string, [unknown, unknown]> = {};
      for (const field of [
        'entry_date',
        'minutes',
        'description',
        'is_billable',
        'charge_value',
      ] as const) {
        if (before[field] !== found[field]) changes[field] = [before[field], found[field]];
      }
      backend.nextId += 1;
      (backend.history[found.id] ??= []).unshift({
        id: `history-${backend.nextId}`,
        time_entry_id: found.id,
        user_id: found.user_id,
        user_name: person(found.user_id)?.full_name ?? null,
        corrected_by: backend.userId,
        corrected_by_name: person(backend.userId)?.full_name ?? null,
        reason: body.reason,
        before,
        after: { ...found },
        changes,
        created_at: NOW,
      });
      return ok(view(found));
    }),
    http.get(orgApiPath('/time-entries/:entryId'), async ({ request, params }) => {
      await record(request);
      const found = backend.entries.find((item) => item.id === params.entryId);
      return found ? ok(view(found)) : notFound();
    }),
    http.patch(orgApiPath('/time-entries/:entryId'), async ({ request, params }) => {
      const body = (await record(request)) as TimeEntryUpdate;
      const found = backend.entries.find((item) => item.id === params.entryId);
      if (!found) return notFound();
      const shown = view(found);
      if (shown.is_locked) return fail(409, 'TIME_LOCKED', 'This time is locked.');
      const date = body.entry_date ?? found.entry_date;
      const minutes = body.minutes === undefined ? found.minutes : round(body.minutes);
      const refusal = refuse(
        found.user_id,
        date,
        body.job_id === undefined ? found.job_id : body.job_id,
        minutes,
        found.id,
      );
      if (refusal) return refusal;
      found.entry_date = date;
      found.minutes = minutes;
      if (body.description !== undefined) found.description = body.description;
      if (body.internal_note !== undefined) found.internal_note = body.internal_note;
      if (body.is_billable !== undefined && body.is_billable !== null)
        found.is_billable = body.is_billable;
      if (body.job_id !== undefined) {
        const job = JOBS.find((candidate) => candidate.id === body.job_id);
        found.job_id = job?.id ?? null;
        found.job_number = job?.number ?? null;
        found.job_name = job?.name ?? null;
        found.service_name = job?.service_name ?? null;
      }
      if (body.activity_code_id !== undefined) {
        const activity = ACTIVITIES.find((candidate) => candidate.id === body.activity_code_id);
        found.activity_code_id = activity?.id ?? null;
        found.activity_name = activity?.name ?? null;
        found.activity_code = activity?.code ?? null;
      }
      found.charge_value = poundsFor(minutes, found.charge_rate);
      found.cost_value = poundsFor(minutes, COST_RATE);
      return ok(view(found), { message: 'Time entry updated' });
    }),
    http.post(orgApiPath('/time-entries/:entryId/remove'), async ({ request, params }) => {
      const body = (await record(request)) as { reason?: string } | undefined;
      const found = backend.entries.find((item) => item.id === params.entryId);
      if (!found) return notFound();
      if (!body?.reason?.trim()) {
        return fail(422, 'TIME_CORRECTION_REASON_REQUIRED', 'Say why the time is removed.');
      }
      if (found.timesheet_status !== 'approved' || found.billing_status !== 'unbilled') {
        return fail(409, 'TIME_NOT_CORRECTABLE', 'Only approved, unbilled time can be removed.');
      }
      backend.entries = backend.entries.filter((item) => item.id !== found.id);
      return ok(null, { message: 'Time entry removed' });
    }),
    http.delete(orgApiPath('/time-entries/:entryId'), async ({ request, params }) => {
      await record(request);
      const found = backend.entries.find((item) => item.id === params.entryId);
      if (!found) return notFound();
      if (view(found).is_locked) return fail(409, 'TIME_LOCKED', 'This time is locked.');
      backend.entries = backend.entries.filter((item) => item.id !== found.id);
      return ok(null, { message: 'Time entry deleted' });
    }),

    /* ----------------------------------- Timer -------------------------------- */
    http.get(orgApiPath('/timer'), async ({ request }) => {
      await record(request);
      return ok(backend.timer);
    }),
    http.post(orgApiPath('/timer/start'), async ({ request }) => {
      const body = (await record(request)) as Partial<Timer>;
      if (backend.timer) return fail(409, 'TIMER_RUNNING', 'A timer is already running.');
      backend.timer = {
        id: 'timer-new',
        user_id: backend.userId,
        client_id: body.client_id ?? null,
        job_id: body.job_id ?? null,
        activity_code_id: body.activity_code_id ?? null,
        description: body.description ?? null,
        is_billable: body.is_billable ?? true,
        is_running: true,
        started_at: NOW,
        accumulated_seconds: 0,
        elapsed_seconds: 0,
        started_on: TODAY,
        created_at: NOW,
      };
      return ok(backend.timer, { status: 201 });
    }),
    http.post(orgApiPath('/timer/pause'), async ({ request }) => {
      await record(request);
      if (!backend.timer) return fail(404, 'TIMER_NOT_FOUND', 'There is no timer.');
      backend.timer = { ...backend.timer, is_running: false, started_at: null };
      return ok(backend.timer);
    }),
    http.post(orgApiPath('/timer/resume'), async ({ request }) => {
      await record(request);
      if (!backend.timer) return fail(404, 'TIMER_NOT_FOUND', 'There is no timer.');
      backend.timer = { ...backend.timer, is_running: true, started_at: NOW };
      return ok(backend.timer);
    }),
    http.post(orgApiPath('/timer/stop'), async ({ request }) => {
      const body = (await record(request)) as { description?: string } | undefined;
      const timer = backend.timer;
      if (!timer) return fail(404, 'TIMER_NOT_FOUND', 'There is no timer.');
      const refusal = refuse(
        backend.userId,
        timer.started_on,
        timer.job_id,
        round(Math.ceil(timer.elapsed_seconds / 60)),
      );
      if (refusal) return refusal;
      const created = newEntry(
        {
          entry_date: timer.started_on,
          minutes: Math.max(1, Math.ceil(timer.elapsed_seconds / 60)),
          client_id: timer.client_id,
          job_id: timer.job_id,
          activity_code_id: timer.activity_code_id,
          description: body?.description ?? timer.description,
        },
        backend.userId,
        backend.userId,
      );
      backend.entries.push(created);
      backend.timer = null;
      return ok(view(created), { status: 201 });
    }),
    http.delete(orgApiPath('/timer'), async ({ request }) => {
      await record(request);
      if (!backend.timer) return fail(404, 'TIMER_NOT_FOUND', 'There is no timer.');
      backend.timer = null;
      return ok(null);
    }),

    /* -------------------------------- Timesheets ------------------------------ */
    http.get(orgApiPath('/timesheets/missing'), async ({ request }) => {
      await record(request);
      const params = new URL(request.url).searchParams;
      const week = weekStartOf(params.get('week_start') ?? addDays(TODAY, -7), 1);
      const days = weekDates(week);
      const rows = PEOPLE.filter(
        (candidate) =>
          candidate.weekly_capacity_minutes > 0 &&
          (!params.get('user_id') || candidate.id === params.get('user_id')) &&
          (!params.get('manager_user_id') ||
            candidate.approver?.id === params.get('manager_user_id')),
      ).flatMap((candidate) => {
        const sheet = sheetFor(candidate.id, week);
        if (sheet && (sheet.status === 'submitted' || sheet.status === 'approved')) return [];
        const targets = dailyTargets(candidate, days);
        const logged = sum(owned(candidate.id, week, addDays(week, 6)).map((item) => item.minutes));
        return [
          {
            user_id: candidate.id,
            name: candidate.full_name,
            week_start: week,
            status: sheet ? sheet.status : ('none' as const),
            timesheet_id: sheet?.id ?? null,
            logged_minutes: logged,
            expected_minutes: sum(targets),
            missing_days: days.filter(
              (day, index) =>
                (targets[index] ?? 0) > 0 && day <= TODAY && minutesOn(candidate.id, day) === 0,
            ),
            last_reminded_at: backend.reminded[candidate.id] ?? null,
            has_login: candidate.has_login,
          },
        ];
      });
      return ok(rows as never);
    }),
    http.post(orgApiPath('/timesheets/reminders/run'), async ({ request }) => {
      await record(request);
      for (const candidate of PEOPLE) backend.reminded[candidate.id] = NOW;
      return ok(backend.reminders);
    }),
    http.get(orgApiPath('/timesheets'), async ({ request }) => {
      await record(request);
      const params = new URL(request.url).searchParams;
      const userParam = params.get('user_id');
      const statuses = params.getAll('status');
      const list = backend.sheets
        .filter((sheet) => {
          const mine =
            userParam === null || userParam === 'me'
              ? sheet.user_id === backend.userId
              : userParam === 'all' || sheet.user_id === userParam;
          return (
            mine &&
            (!params.get('from') || sheet.week_start >= (params.get('from') ?? '')) &&
            (!params.get('to') || sheet.week_start <= (params.get('to') ?? '')) &&
            (statuses.length === 0 || statuses.includes(sheet.status))
          );
        })
        .sort((a, b) => b.week_start.localeCompare(a.week_start))
        .map(sheetRead);
      const page = paged(list, params);
      return ok(page.rows, { meta: page.meta });
    }),
    http.get(orgApiPath('/timesheets/:sheetId'), async ({ request, params }) => {
      await record(request);
      const sheet = backend.sheets.find((candidate) => candidate.id === params.sheetId);
      return sheet ? ok(detail(sheet)) : notFound();
    }),
    http.delete(orgApiPath('/timesheets/:sheetId'), async ({ request, params }) => {
      await record(request);
      const sheet = backend.sheets.find((candidate) => candidate.id === params.sheetId);
      if (!sheet) return notFound();
      if (sheet.status !== 'open' && sheet.status !== 'rejected') {
        return fail(409, 'INVALID_STATUS_TRANSITION', 'That status change is not allowed.');
      }
      const own = backend.entries.filter((item) => view(item).timesheet_id === sheet.id);
      if (own.some((item) => item.billing_status !== 'unbilled')) {
        return fail(409, 'TIMESHEET_HAS_BILLED_TIME', 'Some of this time has been billed.');
      }
      backend.entries = backend.entries.filter((item) => view(item).timesheet_id !== sheet.id);
      backend.sheets = backend.sheets.filter((candidate) => candidate.id !== sheet.id);
      return ok(null, { message: 'Timesheet deleted' });
    }),
    http.post(orgApiPath('/timesheets/:sheetId/submit'), async ({ request, params }) => {
      await record(request);
      const sheet = backend.sheets.find((candidate) => candidate.id === params.sheetId);
      if (!sheet) return notFound();
      if (owned(sheet.user_id, sheet.week_start, addDays(sheet.week_start, 6)).length === 0) {
        return fail(422, 'TIMESHEET_EMPTY', 'A timesheet needs at least one entry.');
      }
      if (sheet.status !== 'open' && sheet.status !== 'rejected') {
        return fail(409, 'INVALID_STATUS_TRANSITION', 'That status change is not allowed.');
      }
      sheet.status = 'submitted';
      sheet.submitted_at = NOW;
      sheet.decision_note = null;
      return ok(detail(sheet), { message: 'Timesheet submitted' });
    }),
    http.post(orgApiPath('/timesheets/:sheetId/recall'), async ({ request, params }) => {
      await record(request);
      const sheet = backend.sheets.find((candidate) => candidate.id === params.sheetId);
      if (!sheet) return notFound();
      if (sheet.status !== 'submitted') {
        return fail(409, 'INVALID_STATUS_TRANSITION', 'That status change is not allowed.');
      }
      sheet.status = 'open';
      sheet.submitted_at = null;
      return ok(detail(sheet), { message: 'Timesheet recalled' });
    }),
    http.post(orgApiPath('/timesheets/:sheetId/approve'), async ({ request, params }) => {
      await record(request);
      const sheet = backend.sheets.find((candidate) => candidate.id === params.sheetId);
      if (!sheet) return notFound();
      if (sheet.user_id === backend.userId) {
        return fail(403, 'SELF_APPROVAL_FORBIDDEN', 'You cannot decide on your own timesheet.');
      }
      if (sheet.status !== 'submitted') {
        return fail(409, 'INVALID_STATUS_TRANSITION', 'That status change is not allowed.');
      }
      sheet.status = 'approved';
      sheet.decided_at = NOW;
      return ok(detail(sheet), { message: 'Timesheet approved' });
    }),
    http.post(orgApiPath('/timesheets/:sheetId/reopen'), async ({ request, params }) => {
      await record(request);
      const sheet = backend.sheets.find((candidate) => candidate.id === params.sheetId);
      if (!sheet) return notFound();
      if (sheet.status !== 'approved') {
        return fail(409, 'INVALID_STATUS_TRANSITION', 'That status change is not allowed.');
      }
      if (
        backend.entries.some(
          (item) => item.timesheet_id === sheet.id && item.billing_status !== 'unbilled',
        )
      ) {
        return fail(409, 'TIMESHEET_HAS_BILLED_TIME', 'Some of this time has been billed.');
      }
      sheet.status = 'open';
      sheet.decided_at = null;
      backend.entries = backend.entries.map((item) =>
        item.timesheet_id === sheet.id
          ? { ...item, timesheet_status: 'open', is_locked: false }
          : item,
      );
      return ok(detail(sheet), { message: 'Timesheet reopened' });
    }),
    http.post(orgApiPath('/timesheets/:sheetId/reject'), async ({ request, params }) => {
      const body = (await record(request)) as { decision_note?: string } | undefined;
      const sheet = backend.sheets.find((candidate) => candidate.id === params.sheetId);
      if (!sheet) return notFound();
      if (!body?.decision_note?.trim()) {
        return fail(422, 'VALIDATION_ERROR', 'Validation failed.', {
          details: [
            { field: 'decision_note', code: 'required', message: 'Say why it is returned.' },
          ],
        });
      }
      if (sheet.status !== 'submitted') {
        return fail(409, 'INVALID_STATUS_TRANSITION', 'That status change is not allowed.');
      }
      sheet.status = 'rejected';
      sheet.decided_at = NOW;
      sheet.decision_note = body.decision_note;
      return ok(detail(sheet), { message: 'Timesheet rejected' });
    }),
    http.get(orgApiPath('/approvals'), async ({ request }) => {
      await record(request);
      const list = backend.sheets
        .filter((sheet) => sheet.status === 'submitted')
        .sort((a, b) => a.week_start.localeCompare(b.week_start))
        .map(sheetRead);
      const page = paged(list, new URL(request.url).searchParams);
      return ok(page.rows, { meta: page.meta });
    }),
    http.post(orgApiPath('/approvals/bulk-approve'), async ({ request }) => {
      const body = (await record(request)) as { timesheet_ids: string[] };
      const chosen = body.timesheet_ids.map((id) =>
        backend.sheets.find((sheet) => sheet.id === id),
      );
      if (chosen.some((sheet) => !sheet)) return notFound();
      if (chosen.some((sheet) => sheet?.status !== 'submitted')) {
        return fail(409, 'INVALID_STATUS_TRANSITION', 'One of the timesheets is not submitted.');
      }
      for (const sheet of chosen) {
        if (sheet) {
          sheet.status = 'approved';
          sheet.decided_at = NOW;
        }
      }
      return ok(chosen.flatMap((sheet) => (sheet ? [sheetRead(sheet)] : [])));
    }),

    /* ----------------------------------- Lookups ------------------------------ */
    http.get(orgApiPath('/staff'), async ({ request }) => {
      await record(request);
      const params = new URL(request.url).searchParams;
      const q = params.get('q')?.toLowerCase();
      const rows = PEOPLE.filter(
        (candidate) =>
          (!q || candidate.full_name.toLowerCase().includes(q)) &&
          (params.get('has_login') === null ||
            String(candidate.has_login) === params.get('has_login')),
      ).map((candidate) => ({
        ...candidate,
        email: `${candidate.code.toLowerCase()}@acme.example`,
      }));
      return ok(rows, { meta: END });
    }),
    http.get(orgApiPath('/clients/:clientId'), ({ params }) => {
      const found = CLIENTS.find((client) => client.id === params.clientId);
      return found ? ok(found) : notFound();
    }),
    http.get(orgApiPath('/clients'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const q = params.get('q')?.toLowerCase();
      return ok(
        CLIENTS.filter((client) => !q || client.name.toLowerCase().includes(q)),
        { meta: END },
      );
    }),
    http.get(orgApiPath('/jobs/:jobId'), ({ params }) => {
      const found = JOBS.find((job) => job.id === params.jobId);
      return found ? ok(found) : notFound();
    }),
    http.get(orgApiPath('/jobs'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const q = params.get('q')?.toLowerCase();
      return ok(
        JOBS.filter(
          (job) =>
            (!q || job.name.toLowerCase().includes(q) || job.number.toLowerCase().includes(q)) &&
            (!params.get('client_id') || job.client_id === params.get('client_id')),
        ),
        { meta: END },
      );
    }),
    http.get(orgApiPath('/services'), () =>
      ok([
        service('0198c1f2-0000-7000-8000-0000000000e1', 'Year-end accounts', [
          '0198c1f2-0000-7000-8000-0000000000f1',
          '0198c1f2-0000-7000-8000-0000000000f2',
        ]),
        service('0198c1f2-0000-7000-8000-0000000000e2', 'Tax returns', []),
      ]),
    ),
    http.get(orgApiPath('/activity-codes'), () =>
      ok(
        ACTIVITIES.map((activity) => ({
          ...activity,
          vat_rate_id: null,
          invoice_description: null,
          is_active: true,
          status: 'active',
          is_used: true,
          can_delete: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        })),
      ),
    ),

    /* ----------------------------------- Reports ------------------------------ */
    http.get(orgApiPath('/reports/time-summary'), async ({ request }) => {
      await record(request);
      const params = new URL(request.url).searchParams;
      if (params.get('format')) {
        return new HttpResponse('Group,Total\r\nAda,12:00\r\n', {
          headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        });
      }
      const group = params.get('group_by') ?? 'person';
      const from = params.get('date_from') ?? '0000-00-00';
      const to = params.get('date_to') ?? '9999-99-99';
      const list = backend.entries.filter(
        (item) => item.entry_date >= from && item.entry_date <= to,
      );
      const keyOf = (
        item: TimeEntry,
      ): { key: string | null; code: string | null; name: string } => {
        switch (group) {
          case 'client':
            return {
              key: item.client_id,
              code: item.client_code,
              name: item.client_name ?? 'No client',
            };
          case 'job':
            return { key: item.job_id, code: item.job_number, name: item.job_name ?? 'No job' };
          case 'activity':
            return {
              key: item.activity_code_id,
              code: item.activity_code,
              name: item.activity_name ?? 'No activity',
            };
          case 'day':
            return { key: item.entry_date, code: null, name: item.entry_date };
          case 'month':
            return {
              key: `${item.entry_date.slice(0, 7)}-01`,
              code: null,
              name: monthLabel(item.entry_date),
            };
          default:
            return {
              key: item.user_id,
              code: person(item.user_id)?.code ?? null,
              name: person(item.user_id)?.full_name ?? 'Someone',
            };
        }
      };
      const groups = new Map<string, TimeEntry[]>();
      const meta = new Map<string, ReturnType<typeof keyOf>>();
      for (const item of list) {
        const info = keyOf(item);
        const id = info.key ?? 'none';
        meta.set(id, info);
        groups.set(id, [...(groups.get(id) ?? []), item]);
      }
      const amounts = (items: TimeEntry[]) => {
        const total = sum(items.map((item) => item.minutes));
        const chargeable = sum(
          items.filter((item) => item.is_billable).map((item) => item.minutes),
        );
        return {
          entry_count: items.length,
          total_minutes: total,
          chargeable_minutes: chargeable,
          non_chargeable_minutes: total - chargeable,
          chargeable_bp: total === 0 ? null : Math.round((chargeable * 10000) / total),
          charge_value: sum(
            items.filter((item) => item.is_billable).map((item) => item.charge_value),
          ),
          cost_value: backend.seesCost ? sum(items.map((item) => item.cost_value ?? 0)) : null,
        };
      };
      return ok({
        rows: [...groups.entries()].map(([id, items]) => ({
          ...amounts(items),
          key: meta.get(id)?.key ?? null,
          code: meta.get(id)?.code ?? null,
          name: meta.get(id)?.name ?? '',
          client_name: null,
        })),
        totals: amounts(list),
        filters: {
          date_from: params.get('date_from'),
          date_to: params.get('date_to'),
          group_by: group,
        },
      });
    }),
    http.get(orgApiPath('/reports/utilisation'), async ({ request }) => {
      await record(request);
      return ok(backend.utilisation);
    }),
  ];
}

function service(id: string, name: string, activityIds: string[]) {
  return {
    id,
    code: name.slice(0, 3).toUpperCase(),
    name,
    description: null,
    billing_basis: 'hourly',
    default_fee: null,
    default_billable: true,
    vat_rate_id: null,
    invoice_description: null,
    is_active: true,
    status: 'active',
    sort_order: 0,
    activity_code_ids: activityIds,
    is_used: true,
    can_delete: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

/** The requests a test made to one path, in order. */
export const callsTo = (backend: TimeBackend, method: string, path: string): Call[] =>
  backend.calls.filter((call) => call.method === method && call.path === path);
