import type { ReactNode } from 'react';

import { Card, CardHeader } from '@/components/ui';
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

/** A section of the Settings tab: a white card with a heading and, at the foot, its own buttons. */
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
      <CardHeader title={title} description={description} actions={actions} />
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}
