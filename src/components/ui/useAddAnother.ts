import { useRef } from 'react';

/**
 * "Save and add another" for a create form. The form keeps its own submit; this only remembers
 * which of the two buttons sent it, so `onSuccess` can clear the form instead of closing it.
 */
export function useAddAnother() {
  const flagRef = useRef(false);
  return {
    flagRef,
    /** Spread on the primary submit button, so a failed attempt does not leave the flag set. */
    primaryProps: {
      onClick: () => {
        flagRef.current = false;
      },
    },
    /** True once when the last submit came from the "add another" button; call it in `onSuccess`. */
    consume: () => {
      const again = flagRef.current;
      flagRef.current = false;
      return again;
    },
  };
}
