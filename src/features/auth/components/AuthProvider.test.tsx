import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { delay, http } from 'msw';
import { MotionConfig } from 'motion/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ToastProvider } from '@/components/ui';
import { apiPath, fail, ok, server } from '@/test/server';

import { AuthProvider } from './AuthProvider';

function PublicPage() {
  const data = useQuery({
    queryKey: ['public-page'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/v1/public/thing', { signal });
      return ((await response.json()) as { data: { title: string } }).data;
    },
    retry: false,
  });
  return <p>{data.data ? data.data.title : data.isError ? 'failed' : 'loading'}</p>;
}

describe('AuthProvider', () => {
  it('does not cancel what a public page is loading when there is no session to restore', async () => {
    server.use(
      http.post(apiPath('/auth/refresh'), async () => {
        await delay(30);
        return fail(401, 'AUTH_REFRESH_INVALID', 'Your session has ended.');
      }),
      http.get('*/api/v1/public/thing', async () => {
        await delay(120);
        return ok({ title: 'Shared document' });
      }),
    );
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="always">
          <ToastProvider>
            <MemoryRouter>
              <AuthProvider>
                <PublicPage />
              </AuthProvider>
            </MemoryRouter>
          </ToastProvider>
        </MotionConfig>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Shared document', {}, { timeout: 3000 })).toBeInTheDocument();
  });
});
