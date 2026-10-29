import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import type { SegmentCreate, SegmentUpdate } from '../segmentTypes';
import { segmentApi } from './segmentApi';

const staffSegmentsKey = (organizationId: string, userId: string) =>
  [...queryKeys.org.segments(organizationId), 'staff', userId] as const;

/** Marks the segments (and the audit log) stale after a change; only what is shown is refetched. */
function useRefresh() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.org.segments(organization.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.org.auditLogs(organization.id) });
    // A rename reaches the clients that have the segment.
    void queryClient.invalidateQueries({ queryKey: queryKeys.org.clients(organization.id) });
  };
}

/** Every segment of the practice, inactive ones included (the list is bounded). */
export function useSegments() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: [...queryKeys.org.segments(organization.id), 'list'] as const,
    queryFn: ({ signal }) => segmentApi.list(organization.id, signal),
  });
}

export function useCreateSegment() {
  const { organization } = useOrg();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: SegmentCreate) => segmentApi.create(organization.id, body),
    onSettled: refresh,
  });
}

/** Changes, deactivates or reactivates: PATCH with the fields to change. */
export function useUpdateSegment() {
  const { organization } = useOrg();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ segmentId, body }: { segmentId: string; body: SegmentUpdate }) =>
      segmentApi.update(organization.id, segmentId, body),
    onSettled: refresh,
  });
}

/** Deletes an unused segment; one that clients have is deactivated (the outcome says which). */
export function useDeleteSegment() {
  const { organization } = useOrg();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (segmentId: string) => segmentApi.remove(organization.id, segmentId),
    onSettled: refresh,
  });
}

/** The segments a staff member looks after, and how many clients that makes. */
export function useStaffSegments(userId: string, enabled = true) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: staffSegmentsKey(organization.id, userId),
    queryFn: ({ signal }) => segmentApi.staffSegments(organization.id, userId, signal),
    enabled,
  });
}

export function useSetStaffSegments(userId: string) {
  const { organization } = useOrg();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (segmentIds: string[]) =>
      segmentApi.setStaffSegments(organization.id, userId, segmentIds),
    onSettled: refresh,
  });
}
