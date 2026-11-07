import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/constants/queryKeys';
import { OrgProvider } from '@/features/organizations';
import { ownerContext } from '@/test/orgFixtures';

import { useBillingInvalidation } from './invalidation';

const ORG = ownerContext.organization.id;
const k = queryKeys.org;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <OrgProvider value={ownerContext}>{children}</OrgProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useBillingInvalidation(), { wrapper });
  const stale = (queryKey: readonly unknown[]) =>
    client.getQueryState(queryKey)?.isInvalidated === true;
  return { client, invalidate: result.current, stale };
}

describe('what a billing change refreshes', () => {
  // Issuing, voiding or crediting changes the entries' billing status: the time screens lock or
  // free them, and the job figures move (BIL-09).
  it.each(['invoices', 'creditNotes'] as const)(
    'marks the time and job data stale after a change to %s',
    (change) => {
      const { client, invalidate, stale } = setup();
      const keys = [
        [...k.time(ORG), 'week', 'u-1', '2026-10-05'],
        [...k.jobs(ORG), 'detail', 'j-1'],
        k.wip(ORG),
        k.invoices(ORG),
      ];
      for (const key of keys) client.setQueryData(key, {});

      invalidate[change]();

      for (const key of keys) expect(stale(key)).toBe(true);
    },
  );

  it('leaves the time data alone after a payment', () => {
    const { client, invalidate, stale } = setup();
    const week = [...k.time(ORG), 'week', 'u-1', '2026-10-05'];
    client.setQueryData(week, {});

    invalidate.payments();

    expect(stale(week)).toBe(false);
  });
});
