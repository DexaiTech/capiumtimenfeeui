import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { memberContext, ownerContext } from '@/test/orgFixtures';
import { apiPath, fail, ok, server } from '@/test/server';

import { useMyOrganizations, useOrganizationBySlug } from './hooks';

/** What the API was asked, by endpoint. */
function backend(list: unknown[] = [ownerContext, memberContext]) {
  const calls = { list: 0, bySlug: [] as string[] };
  server.use(
    http.get(apiPath('/users/me/organizations'), () => {
      calls.list += 1;
      return ok(list as never);
    }),
    http.get(apiPath('/organizations/by-slug/:slug'), ({ params }) => {
      calls.bySlug.push(String(params.slug));
      return fail(404, 'RESOURCE_NOT_FOUND', 'Organization not found.');
    }),
  );
  return calls;
}

function setup<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(hook, { wrapper });
}

describe('useOrganizationBySlug', () => {
  it('shares the request of the practice list on a cold load: one call, none for the slug', async () => {
    const calls = backend();
    const { result } = setup(() => ({
      mine: useMyOrganizations(),
      current: useOrganizationBySlug(ownerContext.organization.slug),
    }));

    await waitFor(() => expect(result.current.current.data).toBeDefined());
    expect(result.current.current.data?.organization.id).toBe(ownerContext.organization.id);
    await waitFor(() => expect(result.current.mine.data).toHaveLength(2));
    expect(calls.list).toBe(1);
    expect(calls.bySlug).toEqual([]);
  });

  it('asks for a slug that is not in the list by itself, and keeps the 404 for a non-member', async () => {
    const calls = backend([ownerContext]);
    const { result } = setup(() => useOrganizationBySlug('not-mine'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls.bySlug).toEqual(['not-mine']);
  });

  it('still asks for the slug when the list cannot be loaded', async () => {
    const calls = { bySlug: [] as string[] };
    server.use(
      http.get(apiPath('/users/me/organizations'), () =>
        fail(500, 'INTERNAL_ERROR', 'Something went wrong.'),
      ),
      http.get(apiPath('/organizations/by-slug/:slug'), ({ params }) => {
        calls.bySlug.push(String(params.slug));
        return ok(ownerContext as never);
      }),
    );
    const { result } = setup(() => useOrganizationBySlug(ownerContext.organization.slug));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(calls.bySlug).toEqual([ownerContext.organization.slug]);
  });
});
