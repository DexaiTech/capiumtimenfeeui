import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type {
  MemberPermissionsUpdate,
  StaffBulkRequest,
  StaffCreate,
  StaffDetail,
  StaffFilters,
  StaffInvite,
  StaffLinkLogin,
  StaffMember,
  StaffStatus,
  StaffUpdate,
} from '../types';
import { useTeamInvalidation } from './invalidation';
import { teamKeys } from './keys';
import { nextCursor } from './pages';
import { teamApi } from './teamApi';

/** The staff list, newest filters first: previous rows stay visible while a new search loads. */
export function useStaffList(filters: StaffFilters, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: teamKeys.staffList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      teamApi.listStaff(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** One page of staff for a picker; `filters` carry the search text and the restrictions. */
export function useStaffLookup(filters: StaffFilters, enabled: boolean) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.staffLookup(organization.id, filters),
    queryFn: async ({ signal }) =>
      (await teamApi.listStaff(organization.id, filters, { signal, limit: 20 })).data,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** One staff member with what refers to them (`usage`, `can_delete`). */
export function useStaffMember(staffId: string | null | undefined) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.staffMember(organization.id, staffId ?? ''),
    queryFn: ({ signal }) => teamApi.getStaff(organization.id, staffId ?? '', signal),
    enabled: Boolean(staffId),
    staleTime: 30_000,
  });
}

/** What one person can do beyond, or without, their role. Needs `role.read` and `member.read`. */
export function useMemberPermissions(staffId: string, enabled: boolean) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.memberPermissions(organization.id, staffId),
    queryFn: ({ signal }) => teamApi.getMemberPermissions(organization.id, staffId, signal),
    enabled,
  });
}

export function useSetMemberPermissions(staffId: string) {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: MemberPermissionsUpdate) =>
      teamApi.setMemberPermissions(organization.id, staffId, body),
    onSuccess: (saved) =>
      queryClient.setQueryData(teamKeys.memberPermissions(organization.id, staffId), saved),
    onSettled: invalidate.staff,
  });
}

export function useCreateStaff() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: StaffCreate) => teamApi.createStaff(organization.id, body),
    onSettled: invalidate.staff,
  });
}

export interface SaveStaffVariables {
  /** The record as it was loaded. */
  staff: StaffMember;
  /** Only the profile fields that changed (may be empty). */
  changes: StaffUpdate;
  /** The new status when it differs from `staff.status`. */
  status?: StaffStatus;
  /** For `left`: the leaving date to record (the API defaults to the existing one, else today). */
  leavingDate?: string;
}

/**
 * Saves the edit form: the profile PATCH and, when the status changed, the lifecycle call
 * that matches it. Coming back (to active, or from left to inactive) goes first, because the
 * profile of a person who left may name dates they cannot hold; pausing or leaving goes last.
 */
export function useSaveStaff() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: async ({
      staff,
      changes,
      status,
      leavingDate,
    }: SaveStaffVariables): Promise<StaffDetail | null> => {
      let saved: StaffDetail | null = null;
      const coming = status === 'active' || (status === 'inactive' && staff.status === 'left');
      if (coming) saved = await teamApi.reactivateStaff(organization.id, staff.id);
      if (Object.keys(changes).length > 0) {
        saved = await teamApi.updateStaff(organization.id, staff.id, changes);
      }
      if (status === 'inactive' || status === 'left') {
        saved = await teamApi.deactivateStaff(organization.id, staff.id, {
          status,
          ...(status === 'left' && leavingDate ? { leaving_date: leavingDate } : {}),
        });
      }
      return saved;
    },
    onSettled: invalidate.staff,
  });
}

/** One action on the selected people: all or nothing (`POST /staff/bulk`). */
export function useBulkStaff() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: StaffBulkRequest) => teamApi.bulkStaff(organization.id, body),
    onSettled: invalidate.staff,
  });
}

export function useDeactivateStaff() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({
      staffId,
      status,
      leavingDate,
    }: {
      staffId: string;
      status: 'inactive' | 'left';
      leavingDate?: string;
    }) =>
      teamApi.deactivateStaff(organization.id, staffId, {
        status,
        ...(status === 'left' && leavingDate ? { leaving_date: leavingDate } : {}),
      }),
    onSettled: invalidate.staff,
  });
}

export function useReactivateStaff() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (staffId: string) => teamApi.reactivateStaff(organization.id, staffId),
    onSettled: invalidate.staff,
  });
}

export function useDeleteStaff() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (staffId: string) => teamApi.deleteStaff(organization.id, staffId),
    onSettled: invalidate.staff,
  });
}

export function useInviteStaff() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ staffId, body }: { staffId: string; body: StaffInvite }) =>
      teamApi.inviteStaff(organization.id, staffId, body),
    onSettled: invalidate.staff,
  });
}

/**
 * Gives a staff member a login. The temporary password of `create_account` is handed to
 * `onSecret` and NOT returned from the mutation function, so it never reaches the mutation
 * cache (`data`, the result of `mutateAsync`) or any query.
 */
export function useLinkLogin() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: async ({
      staffId,
      body,
      onSecret,
    }: {
      staffId: string;
      body: StaffLinkLogin;
      onSecret?: (password: string) => void;
    }) => {
      const linked = await teamApi.linkLogin(organization.id, staffId, body);
      if (linked.temporary_password !== null) onSecret?.(linked.temporary_password);
      return { staff: linked.staff, emailSent: linked.email_sent, mergedFrom: linked.merged_from };
    },
    onSettled: invalidate.staff,
  });
}

export function useUnlinkLogin() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (staffId: string) => teamApi.unlinkLogin(organization.id, staffId),
    onSettled: invalidate.staff,
  });
}

/** The role of a person with a login (V1 `PATCH /members/{id}`). */
export function useChangeRole() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ staffId, roleId }: { staffId: string; roleId: string }) =>
      teamApi.changeRole(organization.id, staffId, { role_id: roleId }),
    onSettled: invalidate.staff,
  });
}

/** Resets a password; like `useLinkLogin`, the new password only goes to `onSecret`. */
export function useResetPassword() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: async ({
      staffId,
      onSecret,
    }: {
      staffId: string;
      onSecret: (password: string) => void;
    }) => {
      const reset = await teamApi.resetPassword(organization.id, staffId);
      onSecret(reset.temporary_password);
      return null;
    },
    onSettled: invalidate.staff,
  });
}
