import { PAGE_SIZE } from '@/constants/limits';
import { api } from '@/services/api';

import type {
  AuditLogEntry,
  AuditLogFilters,
  Member,
  MemberFilters,
  Permission,
  Role,
  RoleCreate,
  RoleUpdate,
} from '../types';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const id = encodeURIComponent;

export { PAGE_SIZE };

interface PageRequest {
  cursor?: string;
  signal?: AbortSignal;
  limit?: number;
}

/** Typed wrappers over the member, role and audit endpoints (staff changes live in the Team feature). */
export const settingsApi = {
  listMembers: (organizationId: string, filters: MemberFilters, page: PageRequest = {}) =>
    api.list<Member>(`${org(organizationId)}/members`, {
      query: { ...filters, limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  getMember: (organizationId: string, userId: string, signal?: AbortSignal) =>
    api.get<Member>(`${org(organizationId)}/members/${id(userId)}`, { signal }),

  /** The catalogue is the same for every practice. */
  listPermissions: (signal?: AbortSignal) => api.get<Permission[]>('/permissions', { signal }),
  // A small, bounded collection: the API returns every role at once.
  listRoles: (organizationId: string, signal?: AbortSignal) =>
    api.get<Role[]>(`${org(organizationId)}/roles`, { signal }),
  createRole: (organizationId: string, body: RoleCreate) =>
    api.post<Role>(`${org(organizationId)}/roles`, body),
  updateRole: (organizationId: string, roleId: string, body: RoleUpdate) =>
    api.patch<Role>(`${org(organizationId)}/roles/${id(roleId)}`, body),
  setRolePermissions: (organizationId: string, roleId: string, permissions: string[]) =>
    api.put<Role>(`${org(organizationId)}/roles/${id(roleId)}/permissions`, { permissions }),
  deleteRole: (organizationId: string, roleId: string) =>
    api.delete<null>(`${org(organizationId)}/roles/${id(roleId)}`),

  listAuditLogs: (organizationId: string, filters: AuditLogFilters, page: PageRequest = {}) =>
    api.list<AuditLogEntry>(`${org(organizationId)}/audit-logs`, {
      query: { ...filters, limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
};
