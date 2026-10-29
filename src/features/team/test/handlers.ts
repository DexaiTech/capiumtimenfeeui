import { http, type HttpHandler } from 'msw';

import type { Role } from '@/features/settings';
import { segmentHandlers } from '@/test/segments';
import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type {
  ActivityType,
  ClientOption,
  Grade,
  JobOption,
  RateChange,
  RateRule,
  Rerun,
  RerunItem,
  Service,
  StaffMember,
  TaskTemplate,
  VatCode,
} from '../types';
import {
  accountsService,
  accountsTemplates,
  detailOf,
  testActivities,
  testChanges,
  testChargeRules,
  testClients,
  testGrades,
  testReruns,
  testRoles,
  testServices,
  testStaff,
  testVatCodes,
  job,
  rerunItem,
} from './fixtures';

export { orgApiPath };

const END = { next_cursor: null, has_more: false };

export interface TeamData {
  staff?: StaffMember[];
  grades?: Grade[];
  roles?: Role[];
  rules?: RateRule[];
  changes?: RateChange[];
  reruns?: Rerun[];
  rerunItems?: RerunItem[];
  services?: Service[];
  /** The default tasks of each service by id (the year-end accounts service has three). */
  taskTemplates?: Record<string, TaskTemplate[]>;
  activities?: ActivityType[];
  vatCodes?: VatCode[];
  clients?: ClientOption[];
  jobs?: JobOption[];
  /** Receive the query string of every request of that list. */
  onStaffList?: (params: URLSearchParams) => void;
  onGradeList?: (params: URLSearchParams) => void;
  onRuleList?: (params: URLSearchParams) => void;
  onHistory?: (params: URLSearchParams) => void;
  onClientList?: (params: URLSearchParams) => void;
  onJobList?: (params: URLSearchParams) => void;
}

/** A page of `rows` after the `cursor` (an index), `size` rows at a time; everything when no size. */
export function page<T>(rows: T[], params: URLSearchParams, size?: number) {
  if (!size) return { rows, meta: END };
  const start = Number(params.get('cursor') ?? 0);
  const next = start + size;
  return {
    rows: rows.slice(start, next),
    meta: next < rows.length ? { next_cursor: String(next), has_more: true } : END,
  };
}

const flag = (value: string | null): boolean | null => (value === null ? null : value === 'true');

/**
 * Read handlers of the Team & Rates endpoints with the real envelope shapes and the filters the
 * pages use. Tests add the mutations they exercise and override the lists they care about.
 */
export function teamHandlers(data: TeamData = {}): HttpHandler[] {
  const staff = data.staff ?? testStaff;
  const grades = data.grades ?? testGrades;
  const rules = data.rules ?? testChargeRules;
  const changes = data.changes ?? testChanges;
  const clients = data.clients ?? testClients;
  const jobs = data.jobs ?? [job];

  return [
    ...segmentHandlers(),
    http.get(orgApiPath('/staff'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      data.onStaffList?.(params);
      const statuses = params.getAll('status');
      const wanted = statuses.length > 0 ? statuses : ['active', 'inactive'];
      const q = params.get('q')?.toLowerCase();
      const hasLogin = flag(params.get('has_login'));
      const selectable = flag(params.get('selectable'));
      const rows = staff.filter(
        (member) =>
          wanted.includes(member.status) &&
          (!params.get('grade_id') || member.grade?.id === params.get('grade_id')) &&
          (!params.get('approver_id') || member.approver?.id === params.get('approver_id')) &&
          (!params.get('role_id') || member.role.id === params.get('role_id')) &&
          (hasLogin === null || member.has_login === hasLogin) &&
          (selectable === null || member.is_selectable === selectable) &&
          (!q ||
            member.full_name.toLowerCase().includes(q) ||
            member.code.toLowerCase().includes(q) ||
            (member.email ?? '').toLowerCase().includes(q)),
      );
      const sort = params.get('sort') ?? 'name';
      const factor = params.get('order') === 'desc' ? -1 : 1;
      const key = (member: StaffMember): string =>
        sort === 'code'
          ? member.code
          : sort === 'grade'
            ? (member.grade?.name ?? '~')
            : sort === 'status'
              ? member.status
              : member.full_name;
      rows.sort((a, b) => key(a).localeCompare(key(b)) * factor);
      return ok(rows, { meta: END });
    }),
    http.get(orgApiPath('/staff/:staffId'), ({ params }) => {
      const found = staff.find((member) => member.id === params.staffId);
      return found ? ok(detailOf(found)) : fail(404, 'RESOURCE_NOT_FOUND', 'Not found.');
    }),
    http.get(orgApiPath('/roles'), () => ok(data.roles ?? testRoles)),

    http.get(orgApiPath('/grades'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      data.onGradeList?.(params);
      const active = flag(params.get('is_active'));
      const q = params.get('q')?.toLowerCase();
      const rows = grades.filter(
        (grade) =>
          (active === null || grade.is_active === active) &&
          (!q || grade.name.toLowerCase().includes(q) || grade.code.toLowerCase().includes(q)),
      );
      return ok(rows, { meta: END });
    }),

    http.get(orgApiPath('/rates/history'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      data.onHistory?.(params);
      const rows = changes.filter(
        (change) =>
          (!params.get('kind') || change.kind === params.get('kind')) &&
          (!params.get('action') || change.action === params.get('action')) &&
          (!params.get('user_id') || change.staff?.id === params.get('user_id')) &&
          (!params.get('grade_id') || change.grade?.id === params.get('grade_id')) &&
          (!params.get('client_id') || change.client?.id === params.get('client_id')) &&
          (!params.get('service_id') || change.service?.id === params.get('service_id')),
      );
      const result = page(rows, params);
      return ok(result.rows, { meta: result.meta });
    }),
    http.get(orgApiPath('/rates/reruns'), () => ok(data.reruns ?? testReruns, { meta: END })),
    http.get(orgApiPath('/rates/reruns/:runId/items'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const outcome = params.get('outcome');
      const rows = (data.rerunItems ?? [rerunItem]).filter(
        (item) => !outcome || item.outcome === outcome,
      );
      return ok(rows, { meta: END });
    }),
    http.get(orgApiPath('/rates'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      data.onRuleList?.(params);
      const levels = params.getAll('level');
      const rows = rules.filter(
        (item) =>
          (!params.get('kind') || item.kind === params.get('kind')) &&
          (levels.length === 0 || levels.includes(item.level)) &&
          (!params.get('status') || item.status === params.get('status')) &&
          (!params.get('user_id') || item.staff?.id === params.get('user_id')) &&
          (!params.get('grade_id') || item.grade?.id === params.get('grade_id')) &&
          (!params.get('client_id') || item.client?.id === params.get('client_id')) &&
          (!params.get('service_id') || item.service?.id === params.get('service_id')),
      );
      return ok(rows, { meta: END });
    }),

    http.get(orgApiPath('/services/:serviceId/task-templates'), ({ params }) =>
      ok(
        data.taskTemplates?.[String(params.serviceId)] ??
          (params.serviceId === accountsService.id ? accountsTemplates : []),
      ),
    ),
    http.get(orgApiPath('/services'), () => ok(data.services ?? testServices)),
    http.get(orgApiPath('/activity-codes'), () => ok(data.activities ?? testActivities)),
    http.get(orgApiPath('/vat-rates'), () => ok(data.vatCodes ?? testVatCodes)),

    http.get(orgApiPath('/clients/:clientId'), ({ params }) => {
      const found = clients.find((client) => client.id === params.clientId);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Not found.');
    }),
    http.get(orgApiPath('/clients'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      data.onClientList?.(params);
      const q = params.get('q')?.toLowerCase();
      const rows = clients.filter(
        (client) =>
          !q || client.name.toLowerCase().includes(q) || client.code.toLowerCase().includes(q),
      );
      return ok(rows, { meta: END });
    }),
    http.get(orgApiPath('/jobs/:jobId'), ({ params }) => {
      const found = jobs.find((entry) => entry.id === params.jobId);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Not found.');
    }),
    http.get(orgApiPath('/jobs'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      data.onJobList?.(params);
      const q = params.get('q')?.toLowerCase();
      const rows = jobs.filter(
        (entry) =>
          (!params.get('client_id') || entry.client_id === params.get('client_id')) &&
          (!q || entry.name.toLowerCase().includes(q) || entry.number.toLowerCase().includes(q)),
      );
      return ok(rows, { meta: END });
    }),
  ];
}
