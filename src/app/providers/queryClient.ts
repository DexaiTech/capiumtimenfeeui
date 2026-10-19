import { QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/services/api';

const MAX_QUERY_RETRIES = 2;

/** Defaults from docs/frontend.md: 30 s stale time, no retry for 4xx, two retries for network and 5xx, none for mutations. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          isApiError(error) && error.retryable && failureCount < MAX_QUERY_RETRIES,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: false },
    },
  });
}
