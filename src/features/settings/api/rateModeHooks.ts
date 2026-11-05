import { useQuery } from '@tanstack/react-query';

import { PERMISSIONS } from '@/constants/permissions';
import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';
import { api } from '@/services/api';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

export interface PersonWithoutOwnRate {
  id: string;
  full_name: string;
}

/** Follows the cursor of a list to its end (staff and staff-level rules are short lists). */
async function everything<TItem>(
  path: string,
  query: Record<string, unknown>,
  signal: AbortSignal,
): Promise<TItem[]> {
  const items: TItem[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const result = await api.list<TItem>(path, { query: { ...query, limit: 100, cursor }, signal });
    items.push(...result.data);
    cursor = result.meta?.next_cursor ?? undefined;
    if (!cursor) break;
  }
  return items;
}

/**
 * The active staff with no charge-out rate of their own in force today (APT79): under "Staff rates
 * only" their grade's rate is not used, so their time is priced at the practice default. Asked
 * only when `enabled` and the viewer may read both the staff and the rates; else nothing is
 * fetched and the list is empty.
 */
export function useStaffWithoutOwnRate(enabled: boolean) {
  const { organization, can } = useOrg();
  const allowed = can(PERMISSIONS.memberRead) && can(PERMISSIONS.rateRead);
  return useQuery({
    queryKey: [...queryKeys.org.rateRules(organization.id), 'staff-without-own-rate'] as const,
    queryFn: async ({ signal }) => {
      const [people, rules] = await Promise.all([
        everything<PersonWithoutOwnRate>(
          `${org(organization.id)}/staff`,
          { status: ['active'] },
          signal,
        ),
        everything<{ staff: { id: string } | null }>(
          `${org(organization.id)}/rates`,
          { kind: 'charge', level: ['staff'], status: 'current' },
          signal,
        ),
      ]);
      const withOwnRate = new Set(rules.map((rule) => rule.staff?.id));
      return people
        .filter((person) => !withOwnRate.has(person.id))
        .map(({ id, full_name }) => ({ id, full_name }));
    },
    enabled: enabled && allowed,
    staleTime: 30_000,
  });
}
