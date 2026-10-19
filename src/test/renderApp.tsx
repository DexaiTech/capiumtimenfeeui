import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configure, render } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';

import { appRoutes } from '@/app/router';
import { useOrgPreferenceStore, useReturnPathStore, useShellStore } from '@/app/store';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/features/auth';
import type { User } from '@/types/models';

import { testAuth, testUser } from './fixtures';
import { apiPath, fail, ok, server } from './server';

// Route modules are loaded lazily, which takes longer than the default second on a cold run.
configure({ asyncUtilTimeout: 5000 });
// Whole-application tests type into real forms; give them room on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

export interface RenderAppOptions {
  /** The signed-in user, or null for an anonymous visitor. Defaults to the verified test user. */
  user?: User | null;
}

/** Call in `beforeEach`: the persisted preferences must not leak from one test into the next. */
export function resetAppStores(): void {
  useOrgPreferenceStore.setState({ lastOrgSlug: null });
  useReturnPathStore.setState({ returnPath: null });
  useShellStore.setState({ drawerOpen: false, searchOpen: false });
}

/**
 * Renders the real route table at `route` with every provider of the application.
 * The session is restored through the mocked silent refresh, as in the browser.
 */
export function renderApp(route: string, { user = testUser }: RenderAppOptions = {}) {
  server.use(
    http.post(apiPath('/auth/refresh'), () =>
      user ? ok({ ...testAuth, user }) : fail(401, 'AUTH_REFRESH_INVALID', 'Please sign in again.'),
    ),
    http.post(apiPath('/auth/logout'), () => ok(null)),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="always">
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}
