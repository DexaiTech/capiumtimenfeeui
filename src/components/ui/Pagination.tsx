import { cn } from '@/utils/cn';

import { Button } from './Button';

export interface PaginationProps {
  /** `hasNextPage` of the infinite query. */
  hasMore: boolean;
  /** `fetchNextPage` of the infinite query. */
  onLoadMore: () => void;
  /** `isFetchingNextPage` of the infinite query. */
  loading?: boolean;
  /** How many items are shown so far. With it the control reports "Showing 25 members". */
  count?: number;
  /** Singular and plural noun for the count, for example `['member', 'members']`. */
  itemLabel?: readonly [singular: string, plural: string];
  loadMoreLabel?: string;
  /** Shown once every page has been loaded. */
  endLabel?: string;
  className?: string;
}

/**
 * Cursor pagination: a "Load more" control, never page numbers (the API has no offsets).
 * The count is a polite live region, so loading another page is announced.
 */
export function Pagination({
  hasMore,
  onLoadMore,
  loading = false,
  count,
  itemLabel = ['item', 'items'],
  loadMoreLabel = 'Load more',
  endLabel = 'End of the list',
  className,
}: PaginationProps) {
  const summary =
    count === undefined ? null : `Showing ${count} ${count === 1 ? itemLabel[0] : itemLabel[1]}`;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 sm:flex-row sm:justify-between',
        summary === null && 'sm:justify-center',
        className,
      )}
    >
      {summary !== null ? (
        <p aria-live="polite" className="text-xs text-text-muted">
          {summary}
          {hasMore ? '' : ` · ${endLabel}`}
        </p>
      ) : null}
      {hasMore ? (
        <Button size="sm" loading={loading} onClick={onLoadMore} className="w-full sm:w-auto">
          {loading ? 'Loading…' : loadMoreLabel}
        </Button>
      ) : summary === null ? (
        <p className="text-xs text-text-muted">{endLabel}</p>
      ) : null}
    </div>
  );
}
