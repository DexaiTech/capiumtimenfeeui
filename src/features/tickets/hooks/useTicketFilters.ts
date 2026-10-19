import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useDebouncedValue } from '@/hooks';

import type { TicketFilters } from '../types';
import { filtersFromParams } from '../utils/filters';

/** What can be written to the URL; an empty list or null removes the parameter. */
export type FilterChanges = Partial<
  Record<
    'q' | 'status' | 'priority' | 'tag' | 'sort' | 'order',
    string | ReadonlyArray<string> | null
  >
>;

/**
 * The list's filters, search and sort, kept in the URL (`q`, `tag`, `priority`, `status`, `sort`,
 * `order`) so they survive a reload and can be shared. The search box shows what is typed at once
 * and writes it to the URL 300 ms after typing stops. Other parameters (`new`) are left alone.
 */
export function useTicketFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo<TicketFilters>(() => filtersFromParams(params), [params]);
  const searched = filters.q ?? '';

  const update = useCallback(
    (changes: FilterChanges) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            next.delete(key);
            const values = Array.isArray(value) ? value : value ? [value] : [];
            for (const entry of values) next.append(key, String(entry));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const [text, setText] = useState(searched);
  const debounced = useDebouncedValue(text.trim(), 300);
  useEffect(() => {
    if (debounced !== searched) update({ q: debounced || null });
    // Only the debounced text drives the URL; a URL change does not write back here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  /** Drops the search and every filter (the sort stays). */
  const clear = useCallback(() => {
    setText('');
    update({ q: null, status: null, priority: null, tag: null });
  }, [update]);

  /** `?new=1` opens the "new ticket" dialog (the top bar's menu leads here). */
  const creating = params.get('new') === '1';
  const setCreating = useCallback(
    (open: boolean) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (open) next.set('new', '1');
          else next.delete('new');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { filters, update, clear, search: { text, setText }, creating, setCreating };
}
