import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/constants/queryKeys';
import { OrgProvider } from '@/features/organizations';
import { ownerContext } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import { useSendTimesheetReminders } from './hooks';
import { dashboardKeys } from './keys';

const ORG = ownerContext.organization.id;

describe('useSendTimesheetReminders (TIME-07)', () => {
  it("marks the dashboard's and the Team page's missing lists stale", async () => {
    server.use(http.post(orgApiPath('/timesheets/reminders/run'), () => ok({})));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <OrgProvider value={ownerContext}>{children}</OrgProvider>
      </QueryClientProvider>
    );
    const keys = [
      [...dashboardKeys.all(ORG), 'missing-timesheets'],
      [...queryKeys.org.timesheets(ORG), 'missing', { week_start: '2026-10-12' }],
    ];
    for (const key of keys) client.setQueryData(key, {});
    const { result } = renderHook(() => useSendTimesheetReminders(), { wrapper });

    result.current.mutate('2026-10-12');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const key of keys) {
      expect(client.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(true);
    }
  });
});
