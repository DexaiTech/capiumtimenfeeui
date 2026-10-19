import { useEffect, useState } from 'react';

import { useDebouncedValue, useUrlParams } from '@/hooks';

/**
 * The quick search of a list: the text typed shows at once, and once typing stops (300 ms) it
 * is written to the URL, which is what the list queries with. Returns the text to show, its
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
