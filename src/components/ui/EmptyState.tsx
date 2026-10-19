import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** The primary action, if the user may take it. */
  action?: ReactNode;
  /** `compact` for inside a table or card section; `page` for a whole page. */
  size?: 'compact' | 'page';
  className?: string;
}

/** What a list or page shows when there is nothing yet (or nothing matches). */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'compact',
  className,
}: EmptyStateProps) {
  return (
    <div
      data-empty-state=""
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 text-center',
        size === 'page' ? 'py-20' : 'py-12',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex items-center justify-center rounded-full bg-brand-soft text-brand-text',
            size === 'page' ? 'size-16' : 'size-12',
          )}
        >
          {icon}
        </span>
      ) : null}
      <h2 className={cn('font-semibold text-text', size === 'page' ? 'text-xl' : 'text-base')}>
        {title}
      </h2>
      {description ? <p className="max-w-md text-sm text-text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
