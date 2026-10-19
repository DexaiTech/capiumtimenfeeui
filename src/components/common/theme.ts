import { Monitor, Moon, Sun } from 'lucide-react';

import type { ThemePreference } from '@/app/store';

const ORDER: ReadonlyArray<ThemePreference> = ['light', 'dark', 'system'];

export const THEME_LABELS: Record<ThemePreference, string> = {
  dark: 'Dark theme',
  light: 'Light theme',
  system: 'System theme',
};

export const THEME_ICONS: Record<ThemePreference, typeof Sun> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

/** The theme after `theme` in the cycle light → dark → system. */
export function nextTheme(theme: ThemePreference): ThemePreference {
  return ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'light';
}
