import { useEffect } from 'react';

/** Asks the browser to confirm closing or reloading the tab while `active` (unsaved changes). */
export function useBeforeUnload(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}
