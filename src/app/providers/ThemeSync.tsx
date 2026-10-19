import { useEffect } from 'react';

import { useThemeStore } from '@/app/store';
import { useMediaQuery } from '@/hooks';

/** Resolves the preference (light, dark or system) to the `data-theme` attribute the tokens key off. */
export function ThemeSync() {
  const preference = useThemeStore((state) => state.theme);
  const systemPrefersLight = useMediaQuery('(prefers-color-scheme: light)');
  const resolved = preference === 'system' ? (systemPrefersLight ? 'light' : 'dark') : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  return null;
}
