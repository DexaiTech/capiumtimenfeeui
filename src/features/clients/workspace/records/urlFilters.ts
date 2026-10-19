import { useEffect, useState } from 'react';

import { useDebouncedValue, useUrlParams } from '@/hooks';

/**
 * The quick search of a tab: the text typed shows at once and, once typing stops (300 ms), is
 * written to the URL (`?q=`), which is what the list queries with. Returns the text to show, its
 * setter and the searched value.
 */
export function useUrlSearch(param = 'q') {
  const { params, setParam } = useUrlParams();
  const searched = params.get(param) ?? '';
  const [text, setText] = useState(searched);
  const debounced = useDebouncedValue(text.trim());
  useEffect(() => {
    if (debounced !== searched) setParam({ [param]: debounced });
    // Only the debounced text drives the URL; a URL change does not write back here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return { text, setText, searched };
}

/** One value of the URL's query string, limited to the values a filter accepts. */
export function oneOf<TValue extends string>(
  value: string | null,
  allowed: ReadonlyArray<TValue>,
): TValue | '' {
  return allowed.find((entry) => entry === value) ?? '';
}

/** `YYYY-MM-DD` from the URL, or '' for anything else. */
export function isoDateParam(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

/** The `from` and `to` of the URL, valid dates only. */
export function useDateRangeParams() {
  const { params } = useUrlParams();
  return { from: isoDateParam(params.get('from')), to: isoDateParam(params.get('to')) };
}
