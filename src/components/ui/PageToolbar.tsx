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
 * actions and the primary button on the right, 10 px apart. The layout follows the toolbar's
 * own width (a container query), not the viewport: from 48rem one row that never wraps (the
 * tabs scroll and the search shrinks); below it two rows (tabs, then search and actions);
 * stacked on phones.
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
      data-page-toolbar=""
      className={cn('@container/toolbar rounded-xl border border-border bg-surface p-2', className)}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center @3xl/toolbar:flex-nowrap">
        {/* Below 48rem the group dissolves (display: contents) so tabs, search and actions wrap as
            siblings: tabs first, then search + actions. From 48rem it is the left half of one row. */}
        <div className="contents @3xl/toolbar:flex @3xl/toolbar:min-w-72 @3xl/toolbar:flex-1 @3xl/toolbar:items-center @3xl/toolbar:gap-2.5">
          {start}
          {search}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:ml-auto sm:justify-end @3xl/toolbar:flex-initial">
          {actions}
          {primaryAction}
        </div>
      </div>
    </div>
  );
}
