import { PAGE_SIZE } from '@/constants/limits';
import { api } from '@/services/api';

import type {
  ActivityType,
  ActivityTypeCreate,
  ActivityTypeUpdate,
  ClientOption,
  DeleteOutcome,
  Grade,
  GradeCreate,
  GradeFilters,
  GradeUpdate,
  JobOption,
  MemberRoleChange,
  RateChange,
  RateHistoryFilters,
  RateResolution,
  RateRule,
  RateRuleCreate,
  RateRuleFilters,
  RateRuleUpdate,
  RerateApply,
  RerateRequest,
  ReratePreview,
  ResolveQuery,
  Rerun,
  RerunItem,
  RerunItemOutcome,
  Service,
  ServiceActivityTypes,
  ServiceCreate,
  ServiceUpdate,
  StaffCreate,
  StaffDeactivate,
  StaffDetail,
  StaffFilters,
  StaffInvite,
  StaffInvited,
  StaffLinkLogin,
  StaffLinked,
  StaffMember,
  StaffUpdate,
  VatCode,
} from '../types';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const seg = encodeURIComponent;

export interface PageRequest {
  cursor?: string;
  signal?: AbortSignal;
  limit?: number;
}

/**
 * Typed wrappers over the Team & Rates endpoints (`docs/modules/team-rates.md` of the API).
 * Query values that are empty are left out by the client.
 */
export const teamApi = {
  /* ---------------------------------- Staff ---------------------------------- */
  listStaff: (organizationId: string, filters: StaffFilters, page: PageRequest = {}) =>
    api.list<StaffMember>(`${org(organizationId)}/staff`, {
      query: { ...filters, limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  getStaff: (organizationId: string, staffId: string, signal?: AbortSignal) =>
    api.get<StaffDetail>(`${org(organizationId)}/staff/${seg(staffId)}`, { signal }),
  createStaff: (organizationId: string, body: StaffCreate) =>
    api.post<StaffDetail>(`${org(organizationId)}/staff`, body),
  updateStaff: (organizationId: string, staffId: string, body: StaffUpdate) =>
    api.patch<StaffDetail>(`${org(organizationId)}/staff/${seg(staffId)}`, body),
  deleteStaff: (organizationId: string, staffId: string) =>
    api.delete<null>(`${org(organizationId)}/staff/${seg(staffId)}`),
  deactivateStaff: (organizationId: string, staffId: string, body: StaffDeactivate) =>
    api.post<StaffDetail>(`${org(organizationId)}/staff/${seg(staffId)}/deactivate`, body),
  reactivateStaff: (organizationId: string, staffId: string) =>
    api.post<StaffDetail>(`${org(organizationId)}/staff/${seg(staffId)}/reactivate`),
  inviteStaff: (organizationId: string, staffId: string, body: StaffInvite) =>
    api.post<StaffInvited>(`${org(organizationId)}/staff/${seg(staffId)}/invite`, body),
  /** The temporary password is in this response only; callers must not keep it in a cache. */
  linkLogin: (organizationId: string, staffId: string, body: StaffLinkLogin) =>
    api.post<StaffLinked>(`${org(organizationId)}/staff/${seg(staffId)}/link-login`, body),
  unlinkLogin: (organizationId: string, staffId: string) =>
    api.post<StaffDetail>(`${org(organizationId)}/staff/${seg(staffId)}/unlink-login`),
  /** V1 member endpoints: the role and the password of a person with a login. */
  changeRole: (organizationId: string, staffId: string, body: MemberRoleChange) =>
    api.patch<unknown>(`${org(organizationId)}/members/${seg(staffId)}`, body),
  resetPassword: (organizationId: string, staffId: string) =>
    api.post<{ temporary_password: string }>(
      `${org(organizationId)}/members/${seg(staffId)}/reset-password`,
    ),

  /* ---------------------------------- Grades --------------------------------- */
  listGrades: (organizationId: string, filters: GradeFilters, page: PageRequest = {}) =>
    api.list<Grade>(`${org(organizationId)}/grades`, {
      query: { ...filters, limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  createGrade: (organizationId: string, body: GradeCreate) =>
    api.post<Grade>(`${org(organizationId)}/grades`, body),
  updateGrade: (organizationId: string, gradeId: string, body: GradeUpdate) =>
    api.patch<Grade>(`${org(organizationId)}/grades/${seg(gradeId)}`, body),
  deleteGrade: (organizationId: string, gradeId: string) =>
    api.delete<DeleteOutcome>(`${org(organizationId)}/grades/${seg(gradeId)}`),
  setGradeActive: (organizationId: string, gradeId: string, active: boolean) =>
    api.post<Grade>(
      `${org(organizationId)}/grades/${seg(gradeId)}/${active ? 'activate' : 'deactivate'}`,
    ),

  /* ----------------------------------- Rates --------------------------------- */
  listRateRules: (organizationId: string, filters: RateRuleFilters, page: PageRequest = {}) =>
    api.list<RateRule>(`${org(organizationId)}/rates`, {
      query: { ...filters, limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  createRateRule: (organizationId: string, body: RateRuleCreate) =>
    api.post<RateRule>(`${org(organizationId)}/rates`, body),
  updateRateRule: (organizationId: string, ruleId: string, body: RateRuleUpdate) =>
    api.patch<RateRule>(`${org(organizationId)}/rates/${seg(ruleId)}`, body),
  deleteRateRule: (organizationId: string, ruleId: string) =>
    api.delete<null>(`${org(organizationId)}/rates/${seg(ruleId)}`),
  resolveRate: (organizationId: string, query: ResolveQuery, signal?: AbortSignal) =>
    api.get<RateResolution>(`${org(organizationId)}/rates/resolve`, {
      query: { ...query },
      signal,
    }),
  listRateHistory: (organizationId: string, filters: RateHistoryFilters, page: PageRequest = {}) =>
    api.list<RateChange>(`${org(organizationId)}/rates/history`, {
      query: { ...filters, limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  previewRerate: (organizationId: string, body: RerateRequest) =>
    api.post<ReratePreview>(`${org(organizationId)}/rates/rerate/preview`, body),
  applyRerate: (organizationId: string, body: RerateApply) =>
    api.post<Rerun>(`${org(organizationId)}/rates/rerate`, body),
  listReruns: (organizationId: string, page: PageRequest = {}) =>
    api.list<Rerun>(`${org(organizationId)}/rates/reruns`, {
      query: { limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  listRerunItems: (
    organizationId: string,
    runId: string,
    outcome: RerunItemOutcome | undefined,
    page: PageRequest = {},
  ) =>
    api.list<RerunItem>(`${org(organizationId)}/rates/reruns/${seg(runId)}/items`, {
      query: { outcome, limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),

  /* ------------------------- Services and activity types --------------------- */
  // Both lists are bounded: the API returns every record at once.
  listServices: (organizationId: string, signal?: AbortSignal) =>
    api.get<Service[]>(`${org(organizationId)}/services`, {
      query: { include_inactive: true },
      signal,
    }),
  createService: (organizationId: string, body: ServiceCreate) =>
    api.post<Service>(`${org(organizationId)}/services`, body),
  updateService: (organizationId: string, serviceId: string, body: ServiceUpdate) =>
    api.patch<Service>(`${org(organizationId)}/services/${seg(serviceId)}`, body),
  deleteService: (organizationId: string, serviceId: string) =>
    api.delete<DeleteOutcome>(`${org(organizationId)}/services/${seg(serviceId)}`),
  setServiceActive: (organizationId: string, serviceId: string, active: boolean) =>
    api.post<Service>(
      `${org(organizationId)}/services/${seg(serviceId)}/${active ? 'activate' : 'deactivate'}`,
    ),
  setServiceActivityTypes: (organizationId: string, serviceId: string, ids: string[]) =>
    api.put<ServiceActivityTypes>(
      `${org(organizationId)}/services/${seg(serviceId)}/activity-codes`,
      {
        activity_code_ids: ids,
      },
    ),
  listActivityTypes: (organizationId: string, signal?: AbortSignal) =>
    api.get<ActivityType[]>(`${org(organizationId)}/activity-codes`, {
      query: { include_inactive: true },
      signal,
    }),
  createActivityType: (organizationId: string, body: ActivityTypeCreate) =>
    api.post<ActivityType>(`${org(organizationId)}/activity-codes`, body),
  updateActivityType: (organizationId: string, activityId: string, body: ActivityTypeUpdate) =>
    api.patch<ActivityType>(`${org(organizationId)}/activity-codes/${seg(activityId)}`, body),
  deleteActivityType: (organizationId: string, activityId: string) =>
    api.delete<DeleteOutcome>(`${org(organizationId)}/activity-codes/${seg(activityId)}`),
  setActivityTypeActive: (organizationId: string, activityId: string, active: boolean) =>
    api.post<ActivityType>(
      `${org(organizationId)}/activity-codes/${seg(activityId)}/${active ? 'activate' : 'deactivate'}`,
    ),
  listVatCodes: (organizationId: string, signal?: AbortSignal) =>
    api.get<VatCode[]>(`${org(organizationId)}/vat-rates`, { signal }),

  /* ---------------------------------- Lookups -------------------------------- */
  listClients: (organizationId: string, q: string, signal?: AbortSignal) =>
    api.list<ClientOption>(`${org(organizationId)}/clients`, {
      query: { q: q || undefined, limit: 20 },
      signal,
    }),
  getClient: (organizationId: string, clientId: string, signal?: AbortSignal) =>
    api.get<ClientOption>(`${org(organizationId)}/clients/${seg(clientId)}`, { signal }),
  listJobs: (organizationId: string, q: string, clientId: string | null, signal?: AbortSignal) =>
    api.list<JobOption>(`${org(organizationId)}/jobs`, {
      query: { q: q || undefined, client_id: clientId ?? undefined, limit: 20 },
      signal,
    }),
  getJob: (organizationId: string, jobId: string, signal?: AbortSignal) =>
    api.get<JobOption>(`${org(organizationId)}/jobs/${seg(jobId)}`, { signal }),
};
