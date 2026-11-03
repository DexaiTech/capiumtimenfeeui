import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import type { BranchCreate, BranchUpdate } from '../branchTypes';
import { branchApi } from './branchApi';

/** Marks the branches (and the audit log) stale after a change; only what is shown is refetched. */
function useRefresh() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.org.branches(organization.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.org.auditLogs(organization.id) });
    // A rename reaches the clients in the branch.
    void queryClient.invalidateQueries({ queryKey: queryKeys.org.clients(organization.id) });
  };
}

/**
 * Whether the practice uses branches (Settings > Branches, ticket APT74). Every place that shows
 * or filters by branch asks this; off, branches are hidden and not required, but nothing is
 * deleted. On, every client needs a branch.
 */
export function useBranchesEnabled(): boolean {
  return useOrg().organization.branches_enabled;
}

/**
 * Every branch of the practice, inactive ones included (the list is bounded). `enabled` false
 * (the client screens while the practice does not use branches) fetches nothing.
 */
export function useBranches(enabled = true) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: [...queryKeys.org.branches(organization.id), 'list'] as const,
    queryFn: ({ signal }) => branchApi.list(organization.id, signal),
    enabled,
  });
}

export function useCreateBranch() {
  const { organization } = useOrg();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: BranchCreate) => branchApi.create(organization.id, body),
    onSettled: refresh,
  });
}

/** Changes, deactivates or reactivates: PATCH with the fields to change. */
export function useUpdateBranch() {
  const { organization } = useOrg();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ branchId, body }: { branchId: string; body: BranchUpdate }) =>
      branchApi.update(organization.id, branchId, body),
    onSettled: refresh,
  });
}

/** Deletes a branch no client has; one that clients have is deactivated (the outcome says which). */
export function useDeleteBranch() {
  const { organization } = useOrg();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (branchId: string) => branchApi.remove(organization.id, branchId),
    onSettled: refresh,
  });
}
