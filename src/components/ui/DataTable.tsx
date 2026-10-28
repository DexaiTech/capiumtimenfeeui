import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { styleCell } from './cellStyle';
import { Skeleton } from './Skeleton';

/** What inside a row handles its own clicks. */
const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, [role="menu"], [role="listbox"], [role="dialog"], [role="checkbox"], [role="switch"]';

export type DataTableSortDirection = 'asc' | 'desc';

export interface DataTableSort {
  columnId: string;
  direction: DataTableSortDirection;
}

export interface DataTableColumn<TRow> {
  id: string;
  /** Header text; also the label in the column visibility menu. */
  header: string;
  cell: (row: TRow) => ReactNode;
  align?: 'start' | 'end' | 'center';
  /** Renders the header as a sort button. */
  sortable?: boolean;
  /** The value `sortRows` compares for client-side sorting. */
  sortValue?: (row: TRow) => string | number | null | undefined;
  /** Width and wrapping utilities for the header and its cells. */
  className?: string;
  /** False for columns that cannot be hidden (the name). Default true. */
  hideable?: boolean;
  /** Draw plain-text values as they are: no automatic pill or avatar. */
  plain?: boolean;
}

export interface DataTableProps<TRow> {
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rows: ReadonlyArray<TRow>;
  rowKey: (row: TRow) => string;
  /** Accessible name of the table (a visually hidden caption). */
  caption: string;
  /** Adds the checkbox column. */
  selectable?: boolean;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (selected: ReadonlySet<string>) => void;
  /** Accessible name of one row's checkbox, for example `Select ${row.name}`. */
  selectLabel?: (row: TRow) => string;
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort) => void;
  /** Ids of the columns not to draw (from `ColumnVisibilityMenu`). */
  hiddenColumns?: ReadonlySet<string>;
  /** Trailing cell with the actions of one row. Return null for a row without actions. */
  rowActions?: (row: TRow) => ReactNode;
  /** Makes the whole row clickable (opening a detail page). Inner buttons stop propagation. */
  onRowClick?: (row: TRow) => void;
  loading?: boolean;
  skeletonRows?: number;
  /** Shown in place of the body when there are no rows and it is not loading. */
  empty?: ReactNode;
  /** Above the table, inside the card: the `PageToolbar`. */
  toolbar?: ReactNode;
  /** Below the table, inside the card: pagination, totals. */
  footer?: ReactNode;
  /**
   * Keeps the header visible while the page scrolls. From the lg breakpoint the card no longer
   * scrolls sideways (a scroll container would stop the header sticking), so use it for tables
   * that fit the width. Set `--table-sticky-top` (through `className`) to the height of any bar
   * that is itself stuck to the top of the viewport.
   */
  stickyHeader?: boolean;
  className?: string;
}

const NEXT: Record<DataTableSortDirection, DataTableSortDirection> = { asc: 'desc', desc: 'asc' };

function nextSort(current: DataTableSort | null | undefined, columnId: string): DataTableSort {
  return current?.columnId === columnId
    ? { columnId, direction: NEXT[current.direction] }
    : { columnId, direction: 'asc' };
}

const alignClass = (align: DataTableColumn<unknown>['align']) =>
  align === 'end' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

function SelectBox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(element) => {
        if (element) element.indeterminate = indeterminate;
      }}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.checked)}
      className="size-4 cursor-pointer rounded-sm accent-primary align-middle"
    />
  );
}

/**
 * The full-width list table of the Capium design: a white rounded card, soft row separators,
 * an optional checkbox column with select-all, sortable headers, hideable columns and a row
 * actions cell. Scrolls horizontally on narrow screens.
 */
export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  caption,
  selectable = false,
  selected,
  onSelectedChange,
  selectLabel,
  sort,
  onSortChange,
  hiddenColumns,
  rowActions,
  onRowClick,
  loading = false,
  skeletonRows = 6,
  empty,
  toolbar,
  footer,
  stickyHeader = false,
  className,
}: DataTableProps<TRow>) {
  const visible = columns.filter((column) => !hiddenColumns?.has(column.id));
  const selection = selected ?? new Set<string>();
  const keys = rows.map(rowKey);
  const selectedCount = keys.filter((key) => selection.has(key)).length;
  const allSelected = keys.length > 0 && selectedCount === keys.length;
  const columnCount = visible.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
  const showEmpty = !loading && rows.length === 0 && empty !== undefined;

  const setRow = (key: string, checked: boolean) => {
    const next = new Set(selection);
    if (checked) next.add(key);
    else next.delete(key);
    onSelectedChange?.(next);
  };
  const setAll = (checked: boolean) => {
    const next = new Set(selection);
    for (const key of keys) {
      if (checked) next.add(key);
      else next.delete(key);
    }
    onSelectedChange?.(next);
  };

  const headerCell = cn(
    'h-[37px] border-b border-row-border bg-surface px-4 text-xs font-medium whitespace-nowrap text-text-muted',
    // Only from lg up, where the card is not a scroll container (below it the table scrolls
    // sideways inside the card and a sticky offset would push the header over the first rows).
    stickyHeader &&
      'lg:sticky lg:top-[var(--table-sticky-top,0px)] lg:z-10 first:rounded-tl-xl last:rounded-tr-xl',
  );
  const bodyCell = 'h-[57px] border-b border-row-border px-4 py-2 align-middle';

  // A click on a control inside the row (a link, a menu, a checkbox, a status picker) is that
  // control's own: only the bare row, or plain text in it, opens the record.
  const onRowPointer = (row: TRow) => (event: MouseEvent<HTMLTableRowElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest(INTERACTIVE)) return;
    onRowClick?.(row);
  };

  const onRowKeyDown = (row: TRow) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2.5', className)}>
      {toolbar}
      <div
        className={cn(
          'list-card flex flex-1 flex-col rounded-xl bg-surface',
          // `clip` still rounds the corners but, unlike `hidden`, is not a scroll container.
          stickyHeader ? 'overflow-clip' : 'overflow-hidden',
        )}
      >
        <div
          className={cn(
            // `relative` makes this the containing block of the visually hidden `sr-only` text
            // (absolutely positioned), so it scrolls inside the card instead of widening the page.
            'relative flex-1 overflow-x-auto',
            stickyHeader && 'lg:overflow-x-clip lg:overflow-y-visible',
          )}
        >
          <table
            className="w-full border-separate border-spacing-0 text-xs font-medium"
            aria-busy={loading || undefined}
          >
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {selectable ? (
                  <th scope="col" className={cn(headerCell, 'w-10 pr-0')}>
                    <SelectBox
                      checked={allSelected}
                      indeterminate={selectedCount > 0 && !allSelected}
                      label="Select all rows"
                      onChange={setAll}
                    />
                  </th>
                ) : null}
                {visible.map((column) => {
                  const active = sort?.columnId === column.id;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={
                        column.sortable
                          ? active
                            ? sort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                          : undefined
                      }
                      className={cn(headerCell, alignClass(column.align), column.className)}
                    >
                      {column.sortable && onSortChange ? (
                        <button
                          type="button"
                          onClick={() => onSortChange(nextSort(sort, column.id))}
                          className={cn(
                            '-mx-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-1 hover:text-text',
                            active && 'text-text',
                          )}
                        >
                          {column.header}
                          {active ? (
                            sort.direction === 'asc' ? (
                              <ArrowUp aria-hidden="true" className="size-3.5" />
                            ) : (
                              <ArrowDown aria-hidden="true" className="size-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown
                              aria-hidden="true"
                              className="size-3.5 text-text-subtle"
                            />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
                {rowActions ? (
                  <th scope="col" className={cn(headerCell, 'w-px')}>
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: Math.max(1, skeletonRows) }, (_, index) => (
                  <tr key={`skeleton-${index}`} aria-hidden="true">
                    {Array.from({ length: columnCount }, (_, cell) => (
                      <td key={cell} className={bodyCell}>
                        <Skeleton className={cell === 0 && selectable ? 'w-4' : 'w-4/5'} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : showEmpty ? (
                <tr>
                  <td colSpan={columnCount} className="p-0">
                    {empty}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const key = rowKey(row);
                  const isSelected = selection.has(key);
                  return (
                    <tr
                      key={key}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={onRowClick ? onRowPointer(row) : undefined}
                      onKeyDown={onRowClick ? onRowKeyDown(row) : undefined}
                      className={cn(
                        'row-glow',
                        isSelected && 'bg-brand/5',
                        onRowClick && 'cursor-pointer',
                      )}
                    >
                      {selectable ? (
                        <td
                          className={cn(
                            bodyCell,
                            'w-10 pr-0',
                            // The selected row's violet marker on its left edge.
                            isSelected && 'shadow-[inset_5px_0_0_var(--color-brand)]',
                          )}
                        >
                          <SelectBox
                            checked={isSelected}
                            label={selectLabel ? selectLabel(row) : 'Select row'}
                            onChange={(checked) => setRow(key, checked)}
                          />
                        </td>
                      ) : null}
                      {visible.map((column, columnIndex) => (
                        <td
                          key={column.id}
                          className={cn(
                            bodyCell,
                            'text-xs font-medium',
                            // The first column is the name of the row, in the strong colour.
                            columnIndex === 0 ? 'text-text' : 'text-text-muted',
                            alignClass(column.align),
                            column.className,
                          )}
                        >
                          {column.plain
                            ? column.cell(row)
                            : styleCell(column.header, column.cell(row))}
                        </td>
                      ))}
                      {rowActions ? (
                        <td
                          className={cn(bodyCell, 'py-1.5 pr-3 pl-2 text-right whitespace-nowrap')}
                          onClick={(event: MouseEvent) => event.stopPropagation()}
                        >
                          {rowActions(row)}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {footer}
      </div>
    </div>
  );
}
