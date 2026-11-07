import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/constants/queryKeys';
import { OrgProvider } from '@/features/organizations';
import { ownerContext } from '@/test/orgFixtures';

import { useWipInvalidation } from './invalidation';
import { wipKeys } from './keys';

const ORG = ownerContext.organization.id;
const k = queryKeys.org;

describe('what a WIP change refreshes', () => {
  // A write-off changes the entries' billing status (the time screens lock them) and the report
  // figures (BIL-09).
  it('marks the WIP, the time, the reports and the jobs stale', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <OrgProvider value={ownerContext}>{children}</OrgProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useWipInvalidation(), { wrapper });
    const keys = [
      wipKeys.all(ORG),
      [...k.time(ORG), 'week', 'u-1', '2026-10-05'],
      [...k.reports(ORG), 'wip-ageing'],
      k.jobs(ORG),
      k.dashboard(ORG),
    ];
    for (const key of keys) client.setQueryData(key, {});

    result.current.changed();

    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
