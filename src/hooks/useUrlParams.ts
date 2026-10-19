import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Filters live in the URL so they survive a reload and can be shared
 * (docs/frontend.md, "State"). Updates replace the history entry.
 */
export function useUrlParams() {
  const [params, setParams] = useSearchParams();

  const setParam = useCallback(
    (changes: Record<string, string | null | undefined>, options: { push?: boolean } = {}) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [name, value] of Object.entries(changes)) {
            if (value) next.set(name, value);
            else next.delete(name);
          }
          return next;
        },
        { replace: !options.push },
      );
    },
    [setParams],
  );

  return { params, setParam };
}
