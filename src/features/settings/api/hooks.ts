import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';
import type { ApiResult } from '@/services/api';
import type { PageMeta } from '@/types/api';

import type {
  AuditLogFilters,
  Member,
  MemberFilters,
  Role,
  RoleCreate,
  RoleUpdate,
} from '../types';
import { settingsApi } from './settingsApi';

type Page<TItem> = ApiResult<TItem[], PageMeta>;

/** Keys for the settings data, all under `['org', organizationId, …]`. */
export const settingsKeys = {
  memberList: (organizationId: string, filters: MemberFilters) =>
    [...queryKeys.org.members(organizationId), 'list', filters] as const,
  member: (organizationId: string, userId: string) =>
    [...queryKeys.org.members(organizationId), 'detail', userId] as const,
  roles: (organizationId: string) => [...queryKeys.org.roles(organizationId), 'list'] as const,
  auditLogList: (organizationId: string, filters: AuditLogFilters) =>
    [...queryKeys.org.auditLogs(organizationId), 'list', filters] as const,
  /** The permission catalogue is global, not tenant data. */
  permissions: queryKeys.permissions,
};

const nextCursor = <TItem>(last: Page<TItem>) => last.meta?.next_cursor ?? undefined;

/** Flattens the pages of an infinite list. */
export function flattenPages<TItem>(data: InfiniteData<Page<TItem>> | undefined): TItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

/* ---------------------------------- Members ---------------------------------- */

export function useMembers(filters: MemberFilters, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: settingsKeys.memberList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      settingsApi.listMembers(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    // Previous results stay visible while a new search or filter loads.
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useMember(userId: string | null | undefined) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: settingsKeys.member(organization.id, userId ?? ''),
    queryFn: ({ signal }) => settingsApi.getMember(organization.id, userId ?? '', signal),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

/**
 * Every current member (active and suspended), following the cursor: the name lookup for the
 * Manager column. Under the members key, so every member mutation refreshes it.
 */
export function useMemberDirectory(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: [...queryKeys.org.members(organization.id), 'directory'] as const,
    queryFn: async ({ signal }) => {
      const members: Member[] = [];
      let cursor: string | undefined;
      do {
        const page = await settingsApi.listMembers(
          organization.id,
          {},
          { cursor, signal, limit: 100 },
        );
        members.push(...page.data);
        cursor = page.meta?.next_cursor ?? undefined;
      } while (cursor);
      return members;
    },
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

/* ----------------------------------- Roles ----------------------------------- */

export function useRoles(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: settingsKeys.roles(organization.id),
    queryFn: ({ signal }) => settingsApi.listRoles(organization.id, signal),
    enabled: options.enabled ?? true,
  });
}

export function usePermissionCatalogue() {
  return useQuery({
    queryKey: settingsKeys.permissions(),
    queryFn: ({ signal }) => settingsApi.listPermissions(signal),
    // Seeded rows: the catalogue only changes with a release.
    staleTime: 60 * 60_000,
  });
}

function useRoleMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.org.roles(organization.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.org.auditLogs(organization.id) });
    },
  });
}

function upsertRole(queryClient: QueryClient, organizationId: string, role: Role) {
  queryClient.setQueryData<Role[]>(settingsKeys.roles(organizationId), (current) => {
    if (!current) return current;
    return current.some((item) => item.id === role.id)
      ? current.map((item) => (item.id === role.id ? role : item))
      : [...current, role];
  });
}

export function useCreateRole() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return useRoleMutation(async (body: RoleCreate) => {
    const role = await settingsApi.createRole(organization.id, body);
    upsertRole(queryClient, organization.id, role);
    return role;
  });
}

export interface SaveRoleVariables {
  roleId: string;
  /** Sent with PATCH when present. */
  details?: RoleUpdate;
  /** Sent with PUT …/permissions when present. */
  permissions?: string[];
}

/** Renames and/or replaces the permission set: the two endpoints behind one "Save changes". */
export function useSaveRole() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return useRoleMutation(async ({ roleId, details, permissions }: SaveRoleVariables) => {
    let role: Role | null = null;
    if (details) {
      role = await settingsApi.updateRole(organization.id, roleId, details);
      upsertRole(queryClient, organization.id, role);
    }
    if (permissions) {
      role = await settingsApi.setRolePermissions(organization.id, roleId, permissions);
      upsertRole(queryClient, organization.id, role);
    }
    return role;
  });
}

export function useDeleteRole() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return useRoleMutation(async (roleId: string) => {
    await settingsApi.deleteRole(organization.id, roleId);
    queryClient.setQueryData<Role[]>(settingsKeys.roles(organization.id), (current) =>
      current?.filter((item) => item.id !== roleId),
    );
    return null;
  });
}

/* --------------------------------- Audit log --------------------------------- */

export function useAuditLogs(filters: AuditLogFilters) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: settingsKeys.auditLogList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      settingsApi.listAuditLogs(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}
