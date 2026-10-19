import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** The page's actions; at most one of them is primary. */
  actions?: ReactNode;
  className?: string;
}

/** Title row of a page in the content area. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-lg font-semibold text-text">{title}</h1>
        {description ? <p className="max-w-3xl text-xs text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
