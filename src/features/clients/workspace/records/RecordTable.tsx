import { useState, type ReactNode } from 'react';

import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  sortRows,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/ui';
import { isApiError } from '@/services/api';

import { flattenPages, type RecordListQuery } from '../../api';

/** A failed load, in a card, with a retry and the request id. */
export function LoadError({
  title,
  error,
  onRetry,
  retrying,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-card">
      <ErrorState
        title={title}
        error={isApiError(error) ? error : null}
        onRetry={onRetry}
        retrying={retrying}
        className="py-10"
      />
    </div>
  );
}

export interface RecordTableProps<TRow> {
  caption: string;
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rowKey: (row: TRow) => string;
  query: RecordListQuery<TRow>;
  /** The noun of one row and of several, for the count under the table ("job", "jobs"). */
  noun: readonly [string, string];
  /** The `PageToolbar` with the tab's search and filters. */
  toolbar: ReactNode;
  /** A search or a filter is on: an empty list then says nothing matches. */
  filtered: boolean;
  onClearFilters: () => void;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  errorTitle: string;
  onRowClick?: (row: TRow) => void;
  /**
   * Set both when the server sorts (jobs): the rows are then shown as they come. Without them the
   * headers sort the rows loaded so far.
   */
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort) => void;
  /** Rendered under the table inside the card, above the pagination (totals). */
  footerExtra?: ReactNode;
}

/**
 * The table of a record tab (jobs, time, expenses, invoices, payments): the toolbar on top, the
 * skeleton while it loads, an error state with a retry, an empty state that tells "nothing yet"
 * from "nothing matches", and "Load more" with the API's cursor.
 */
export function RecordTable<TRow>({
  caption,
  columns,
  rowKey,
  query,
  noun,
  toolbar,
  filtered,
  onClearFilters,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  errorTitle,
  onRowClick,
  sort,
  onSortChange,
  footerExtra,
}: RecordTableProps<TRow>) {
  const [localSort, setLocalSort] = useState<DataTableSort | null>(null);
  const loaded = flattenPages(query.data);
  const serverSorted = onSortChange !== undefined;
  const rows = serverSorted ? loaded : sortRows(loaded, columns, localSort);

  if (query.isError && !query.data) {
    return (
      <div className="flex flex-col gap-2.5">
        {toolbar}
        <LoadError
          title={errorTitle}
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      </div>
    );
  }

  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      rowKey={rowKey}
      sort={serverSorted ? sort : localSort}
      onSortChange={serverSorted ? onSortChange : setLocalSort}
      onRowClick={onRowClick}
      loading={query.isPending}
      toolbar={toolbar}
      empty={
        <EmptyState
          icon={emptyIcon}
          title={filtered ? 'Nothing matches' : emptyTitle}
          description={filtered ? 'Try different filters or a different search.' : emptyDescription}
          action={filtered ? <Button onClick={onClearFilters}>Clear filters</Button> : undefined}
        />
      }
      footer={
        rows.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-row-border px-4 py-2">
            {footerExtra}
            <Pagination
              hasMore={query.hasNextPage}
              onLoadMore={() => void query.fetchNextPage()}
              loading={query.isFetchingNextPage}
              count={rows.length}
              itemLabel={noun}
            />
          </div>
        ) : null
      }
    />
  );
}
