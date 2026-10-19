import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/constants/queryKeys';
import { OrgProvider } from '@/features/organizations';
import { ownerContext } from '@/test/orgFixtures';

import { useJobInvalidation } from './invalidation';
import { jobKeys } from './keys';

const ORG = ownerContext.organization.id;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <OrgProvider value={ownerContext}>{children}</OrgProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useJobInvalidation(), { wrapper });
  const stale = (queryKey: readonly unknown[]) =>
    client.getQueryState(queryKey)?.isInvalidated === true;
  return { client, invalidate: result.current, stale };
}

describe('what a change refreshes', () => {
  it('marks every job query and the pages around them stale after a change', () => {
    const { client, invalidate, stale } = setup();
    const keys = [
      jobKeys.detail(ORG, 'j-1'),
      jobKeys.list(ORG, {}),
      jobKeys.budget(ORG, 'j-1'),
      queryKeys.org.dashboard(ORG),
      queryKeys.org.clients(ORG),
    ];
    for (const key of keys) client.setQueryData(key, {});

    invalidate.jobs();

    for (const key of keys) expect(stale(key)).toBe(true);
  });

  it('leaves the detail, tasks and budget of a deleted job alone, and refreshes the rest', () => {
    const { client, invalidate, stale } = setup();
    const own = [
      jobKeys.detail(ORG, 'j-1'),
      jobKeys.jobTasks(ORG, 'j-1'),
      jobKeys.budget(ORG, 'j-1'),
    ];
    const others = [
      jobKeys.detail(ORG, 'j-2'),
      jobKeys.jobTasks(ORG, 'j-2'),
      jobKeys.list(ORG, {}),
      jobKeys.taskList(ORG, {}),
      jobKeys.budgetList(ORG, {}),
      queryKeys.org.dashboard(ORG),
      queryKeys.org.clients(ORG),
    ];
    for (const key of [...own, ...others]) client.setQueryData(key, {});

    invalidate.deleted('j-1');

    // A page still showing the job would ask for these again and be answered 404.
    for (const key of own) expect(stale(key)).toBe(false);
    for (const key of others) expect(stale(key)).toBe(true);
  });
});
