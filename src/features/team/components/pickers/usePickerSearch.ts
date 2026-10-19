import { useState } from 'react';

import { useDebouncedValue } from '@/hooks';

/**
 * The state every lookup picker shares: the text typed, its debounced form (what is searched)
 * and whether the list is open. A list that is not open searches nothing.
 */
export function usePickerSearch() {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const query = useDebouncedValue(text.trim(), 250);
  return { setText, query, open, setOpen };
}
