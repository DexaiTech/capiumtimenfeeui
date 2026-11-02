import { useQueries, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { JobRef, StaffPerson } from '../types';
import { staffName } from '../utils/format';
import { timeKeys } from './keys';
import { timeApi } from './timeApi';

/** The name every time screen shows: deleted users read "John Smith (deleted user)". */
const withRecordNames = (people: StaffPerson[]): StaffPerson[] =>
  people.map((person) => ({ ...person, full_name: staffName(person) }));

/**
 * Everybody on the staff list (also people who left and deleted users), to name ids and to work out
 * targets. Needs `member.read`; without it the hook stays idle and the screens fall back to what
 * they have.
 */
export function useStaffDirectory({ enabled = true }: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.staff(organization.id),
    queryFn: ({ signal }) => timeApi.listStaff(organization.id, signal),
    select: withRecordNames,
    enabled,
    staleTime: 60_000,
  });
}

/** One client, to name the one on a timer. Needs `client.read`. */
export function useClientRef(clientId: string | null | undefined, enabled: boolean) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.client(organization.id, clientId ?? ''),
    queryFn: ({ signal }) => timeApi.getClient(organization.id, clientId ?? '', signal),
    enabled: enabled && Boolean(clientId),
    staleTime: 60_000,
  });
}

/**
 * The jobs of a week's rows, by id: their status (a closed job takes no time) and billing basis.
 * One small request per job, kept for a minute. Needs `job.read`.
 */
export function useJobRefs(jobIds: ReadonlyArray<string>, enabled: boolean): Map<string, JobRef> {
  const { organization } = useOrg();
  return useQueries({
    queries: jobIds.map((jobId) => ({
      queryKey: timeKeys.job(organization.id, jobId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        timeApi.getJob(organization.id, jobId, signal),
      enabled,
      staleTime: 60_000,
    })),
    combine: (results) =>
      new Map(
        results.flatMap((result) => (result.data ? [[result.data.id, result.data] as const] : [])),
      ),
  });
}
