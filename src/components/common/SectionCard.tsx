import type { ReactNode } from 'react';

import { Card } from '@/components/ui';
import { cn } from '@/utils/cn';

export interface SectionCardProps {
  title: string;
  description?: ReactNode;
  /** Right of the title: a badge ("Read only") or an action. */
  aside?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** A white rounded card with a heading: one section of a settings or account page. */
export function SectionCard({
  title,
  description,
  aside,
  id,
  className,
  children,
}: SectionCardProps) {
  return (
    <Card
      padding="lg"
      className={cn('flex flex-col gap-5', className)}
      aria-labelledby={id ? `${id}-title` : undefined}
      role={id ? 'region' : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={id ? `${id}-title` : undefined} className="text-base font-semibold text-text">
            {title}
          </h2>
          {description ? <p className="text-sm text-text-muted">{description}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}
