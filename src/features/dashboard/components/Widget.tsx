import type { UseQueryResult } from '@tanstack/react-query';
import { useId, type ReactNode } from 'react';

import { useOrg } from '@/features/organizations';
import { cn } from '@/utils/cn';
import { formatUkDateTime } from '@/utils/dates';

import type { WidgetData } from '../types';
import { RefreshButton } from './RefreshButton';
import { WidgetEmpty, WidgetError, WidgetNoAccess, WidgetSkeleton } from './WidgetStates';

/** "Updated 17/10/2026 00:30": when the API worked the figures out, in the practice's time zone. */
export function UpdatedAt({ at, className }: { at: string; className?: string }) {
  const { organization } = useOrg();
  return (
    <p className={cn('text-xs text-text-subtle', className)}>
      Updated {formatUkDateTime(at, organization.timezone)}
    </p>
  );
}

export interface WidgetProps<T extends WidgetData> {
  title: string;
  description?: string;
  /** The widget's own query: it loads, refreshes and fails on its own. */
  query: UseQueryResult<T>;
  /** True when there is nothing to list: the empty state replaces the body. */
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Next to the refresh button: a "View all" link. */
  actions?: ReactNode;
  /** False for a second widget on a page that shares the query of the first. Default true. */
  showRefresh?: boolean;
  className?: string;
  /** The body, drawn only when the data is there and visible. */
  children: (data: T) => ReactNode;
}

/**
 * The card every dashboard widget is drawn in: a title, a refresh button, a last-updated line
 * and the four states of its data: loading (a skeleton), failed (a message with a retry),
 * hidden for the caller's role (a calm notice, not an error) and empty.
 */
export function Widget<T extends WidgetData>({
  title,
  description,
  query,
  isEmpty,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  actions,
  showRefresh = true,
  className,
  children,
}: WidgetProps<T>) {
  const titleId = useId();
  const { data } = query;
  const retry = () => void query.refetch();

  let body: ReactNode;
  if (data === undefined) {
    body = query.isError ? (
      <WidgetError title={title} error={query.error} onRetry={retry} retrying={query.isFetching} />
    ) : (
      <WidgetSkeleton title={title} />
    );
  } else if (!data.visible) {
    body = <WidgetNoAccess title={title} />;
  } else if (isEmpty?.(data)) {
    body = <WidgetEmpty title={emptyTitle} description={emptyDescription} />;
  } else {
    body = (
      <>
        {query.isError ? (
          <WidgetError
            inline
            title={title}
            error={query.error}
            onRetry={retry}
            retrying={query.isFetching}
          />
        ) : null}
        {children(data)}
      </>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold text-text">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-sm text-text-muted">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {showRefresh ? (
            <RefreshButton label={title} onRefresh={retry} refreshing={query.isFetching} />
          ) : null}
        </div>
      </header>
      {body}
      {data && showRefresh ? <UpdatedAt at={data.generated_at} /> : null}
    </section>
  );
}
