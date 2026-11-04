import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';

import { ToastProvider } from '@/components/ui';

export interface RenderOptions {
  route?: string;
  /** Mounts `ui` in a data router, as the app does (needed by `useBlocker`). */
  dataRouter?: boolean;
}

/** Renders with the providers a feature component expects: query client, toasts and a router. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', dataRouter = false }: RenderOptions = {},
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="always">
        <ToastProvider>
          {dataRouter ? (
            <RouterProvider
              router={createMemoryRouter([{ path: '*', element: ui }], {
                initialEntries: [route],
              })}
            />
          ) : (
            <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
          )}
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>,
  );
}
