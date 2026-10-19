import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface PageToolbarProps {
  /** Left: the count tabs ("Clients 12"), or a title. */
  start?: ReactNode;
  /** The quick-search field, next to the tabs. */
  search?: ReactNode;
  /** Outline buttons: Show/Hide Columns, Filter, Export, Import. */
  actions?: ReactNode;
  /** The one solid violet button, for example "Add Client". */
  primaryAction?: ReactNode;
  className?: string;
}

/**
 * The toolbar card above a list (style guide): tabs and quick search on the left; outline
 * actions and the primary button on the right, 10 px apart. Wraps onto two rows on narrow
 * screens.
 */
export function PageToolbar({
  start,
  search,
  actions,
  primaryAction,
  className,
}: PageToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-2 lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        {start}
        {search}
      </div>
      <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
        {actions}
        {primaryAction}
      </div>
    </div>
  );
}
