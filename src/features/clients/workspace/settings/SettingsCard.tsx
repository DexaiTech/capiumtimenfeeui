import type { ReactNode } from 'react';

import { Card } from '@/components/ui';
import { cn } from '@/utils/cn';

export interface SettingsCardProps {
  /** The card's heading; it also names the region. */
  title: string;
  description?: ReactNode;
  /** Buttons at the right of the heading. */
  actions?: ReactNode;
  /** Draws the border in the danger colour (the danger zone). */
  danger?: boolean;
  children: ReactNode;
}

/**
 * A section of the Settings tab, laid out like the cards of Settings → General: a heading with no
 * divider, the fields, and (for a form) a footer from `SettingsFormFooter`.
 */
export function SettingsCard({
  title,
  description,
  actions,
  danger = false,
  children,
}: SettingsCardProps) {
  return (
    <Card
      padding="none"
      role="region"
      aria-label={title}
      className={cn(danger && 'ring-1 ring-danger/40')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {description ? <p className="text-sm text-text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </Card>
  );
}
