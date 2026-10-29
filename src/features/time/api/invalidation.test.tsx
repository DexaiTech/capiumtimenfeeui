import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/constants/queryKeys';
import { OrgProvider } from '@/features/organizations';
import { ownerContext } from '@/test/orgFixtures';

import { useTimeInvalidation } from './invalidation';
import { timeKeys } from './keys';

const ORG = ownerContext.organization.id;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <OrgProvider value={ownerContext}>{children}</OrgProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useTimeInvalidation(), { wrapper });
  const stale = (queryKey: readonly unknown[]) =>
    client.getQueryState(queryKey)?.isInvalidated === true;
  return { client, invalidate: result.current, stale };
}

/** Every place a piece of time is shown: a change to it on one page must reach all of them. */
const SHOWN_ON = (): ReadonlyArray<readonly unknown[]> => [
  timeKeys.entryList(ORG, { job_id: 'j-1' }),
  timeKeys.entryList(ORG, { user_id: 'all' }),
  timeKeys.week(ORG, 'u-1', '2026-10-12'),
  timeKeys.day(ORG, 'u-1', '2026-10-12'),
  [...queryKeys.org.time(ORG), 'by-client', 'c-1', 'all', {}],
  timeKeys.timesheet(ORG, 'ts-1'),
  timeKeys.timesheetList(ORG, { user_id: 'all' }),
  timeKeys.approvals(ORG),
  timeKeys.missing(ORG, { week_start: '2026-10-12' }),
  [...queryKeys.org.jobs(ORG), 'detail', 'j-1'],
  [...queryKeys.org.jobs(ORG), 'budget', 'j-1'],
  [...queryKeys.org.clients(ORG), 'overview', 'c-1'],
  queryKeys.org.wip(ORG),
  queryKeys.org.dashboard(ORG),
  queryKeys.org.reports(ORG),
];

describe('what a change to time refreshes', () => {
  it.each(['entries', 'sheets'] as const)(
    'marks the job, client, timesheet and approval views stale after %s change',
    (kind) => {
      const { client, invalidate, stale } = setup();
      for (const key of SHOWN_ON()) client.setQueryData(key, {});

      void invalidate[kind]();

      for (const key of SHOWN_ON()) expect(stale(key), JSON.stringify(key)).toBe(true);
    },
  );

  it('leaves the lookups of people and jobs alone', () => {
    const { client, invalidate, stale } = setup();
    const lookups = [timeKeys.staff(ORG), timeKeys.job(ORG, 'j-1')];
    for (const key of lookups) client.setQueryData(key, {});

    void invalidate.entries();

    for (const key of lookups) expect(stale(key)).toBe(false);
  });
});
