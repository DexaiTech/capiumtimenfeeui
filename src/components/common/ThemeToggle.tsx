import { useThemeStore } from '@/app/store';
import { Button, Tooltip } from '@/components/ui';
import { cn } from '@/utils/cn';

import { nextTheme, THEME_ICONS, THEME_LABELS } from './theme';

/** Cycles light → dark → system. The choice is persisted by the theme store. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const next = nextTheme(theme);
  const Icon = THEME_ICONS[theme];

  return (
    <Tooltip
      content={`${THEME_LABELS[theme]} · switch to ${THEME_LABELS[next].toLowerCase()}`}
      side="bottom"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${THEME_LABELS[theme]}. Switch to ${THEME_LABELS[next].toLowerCase()}.`}
        onClick={() => setTheme(next)}
        className={cn(className)}
      >
        <Icon className="size-5" aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
