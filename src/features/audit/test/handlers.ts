import { http, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { ok } from '@/test/server';

import type { HistoryEntry } from '../types';

/** The history endpoint of the test practice. */
export const historyPath = () => orgApiPath('/audit-logs/history');

const END = { next_cursor: null, has_more: false };

/**
 * Serves `pages` of history by cursor (`first` for none) and records the query of every request.
 */
export function historyHandlers(
  pages: Record<string, { rows: HistoryEntry[]; next: string | null }>,
  requests: URLSearchParams[] = [],
): HttpHandler[] {
  return [
    http.get(historyPath(), ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const page = pages[params.get('cursor') ?? 'first'] ?? { rows: [], next: null };
      return ok(page.rows, {
        meta: page.next ? { next_cursor: page.next, has_more: true } : END,
      });
    }),
  ];
}
