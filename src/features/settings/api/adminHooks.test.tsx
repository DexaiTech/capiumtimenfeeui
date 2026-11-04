import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/constants/queryKeys';
import { OrgProvider, type OrganizationContext } from '@/features/organizations';
import { memberContext, ownerContext } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import { card } from '../test/adminFixtures';
import { useUpdateIntegration } from './adminHooks';

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  queryClient.setQueryData(
    queryKeys.organizationBySlug(ownerContext.organization.slug),
    ownerContext,
  );
  queryClient.setQueryData(queryKeys.myOrganizations(), [ownerContext, memberContext]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OrgProvider value={ownerContext}>{children}</OrgProvider>
    </QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useUpdateIntegration(), { wrapper }) };
}

describe('useUpdateIntegration', () => {
  it('tells the practice context when Capium Central is switched off (APT74)', async () => {
    server.use(
      http.patch(orgApiPath('/integrations/central_client'), () =>
        ok(card('central_client', { enabled: false, status: 'disabled' })),
      ),
    );
    const { queryClient, result } = setup();

    act(() => result.current.mutate({ key: 'central_client', body: { enabled: false } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const current = queryClient.getQueryData<OrganizationContext>(
      queryKeys.organizationBySlug(ownerContext.organization.slug),
    );
    expect(current?.central_client_enabled).toBe(false);
    const mine = queryClient.getQueryData<OrganizationContext[]>(queryKeys.myOrganizations());
    expect(mine?.map((entry) => entry.central_client_enabled)).toEqual([false, true]);
  });

  it('leaves the practice context alone for the other integrations', async () => {
    server.use(
      http.patch(orgApiPath('/integrations/bookkeeping'), () =>
        ok(card('bookkeeping', { enabled: false, status: 'disabled' })),
      ),
    );
    const { queryClient, result } = setup();

    act(() => result.current.mutate({ key: 'bookkeeping', body: { enabled: false } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      queryClient.getQueryData(queryKeys.organizationBySlug(ownerContext.organization.slug)),
    ).toBe(ownerContext);
  });
});
