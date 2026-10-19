import { ArrowDown, ArrowUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Fragment, useId, useState, type ReactNode } from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';

import { Skeleton } from './Skeleton';

export type SortDirection = 'asc' | 'desc';

export interface TableSort {
  columnId: string;
  direction: SortDirection;
}

export interface TableColumn<TRow> {
  id: string;
  /** Column header; also the label of the value in card mode. */
  header: string;
  cell: (row: TRow) => ReactNode;
  align?: 'start' | 'end';
  /** Renders the header as a button that calls `onSortChange`. */
  sortable?: boolean;
  /** Layout utilities (width, wrapping, responsive visibility) for the header and its cells. */
  className?: string;
  /**
   * Card mode (below md): `title` is drawn at the top of the card without a label,
   * `field` (default) as a label/value pair, `hidden` not at all.
   */
  card?: 'title' | 'field' | 'hidden';
}

export interface TableExpansion<TRow> {
  /** Content of the details row. Rendered only while the row is expanded. */
  render: (row: TRow) => ReactNode;
  /** Accessible name of the toggle, for example "Details of the event from 3 minutes ago". */
  label: (row: TRow) => string;
}

export interface TableProps<TRow> {
  columns: ReadonlyArray<TableColumn<TRow>>;
  rows: ReadonlyArray<TRow>;
  rowKey: (row: TRow) => string;
  /** Accessible name of the table (a visually hidden caption). */
  caption: string;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort) => void;
  /**
   * Keeps the header visible while the page scrolls. Set `--table-sticky-top` (through
   * `className`) to the height of any bar that is itself stuck to the top of the viewport.
   */
  stickyHeader?: boolean;
  /**
   * `fixed` sizes columns from the widths in each column's `className` and lets the rest share
   * the remaining space, so long values truncate or wrap instead of widening the table.
   */
  layout?: 'auto' | 'fixed';
  /** Trailing cell with the actions of one row. Return null for a row without actions. */
  rowActions?: (row: TRow) => ReactNode;
  /** Adds a toggle per row that reveals a details row. */
  expansion?: TableExpansion<TRow>;
  /** Shows skeleton rows instead of `rows`. */
  loading?: boolean;
  skeletonRows?: number;
  /** Shown instead of the table when there are no rows and it is not loading. */
  empty?: ReactNode;
  /** Replaces the default stacked card below the md breakpoint. */
  renderCard?: (row: TRow) => ReactNode;
  className?: string;
}

const DESKTOP_QUERY = '(min-width: 48rem)';

function nextSort(current: TableSort | null | undefined, columnId: string): TableSort {
  if (current?.columnId === columnId) {
    return { columnId, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { columnId, direction: 'asc' };
}

function ariaSort(
  sort: TableSort | null | undefined,
  columnId: string,
): 'ascending' | 'descending' | 'none' {
  if (sort?.columnId !== columnId) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

interface ExpandToggleProps {
  expanded: boolean;
  label: string;
  controls: string;
  onToggle: () => void;
  withText?: boolean;
}

function ExpandToggle({ expanded, label, controls, onToggle, withText }: ExpandToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-text-muted md:min-h-9 md:min-w-9',
        'transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-text',
      )}
    >
      {withText ? <span aria-hidden="true">{expanded ? 'Hide details' : 'Details'}</span> : null}
      <ChevronDown
        aria-hidden="true"
        className={cn(
          'size-4 transition-transform duration-fast ease-standard',
          expanded && 'rotate-180',
        )}
      />
    </button>
  );
}

/**
 * Data table with typed columns. From the md breakpoint it is a semantic `<table>`;
 * below it every row becomes a stacked card of label/value pairs (or `renderCard`).
 * Dense data sits on a flat surface, without blur.
 */
export function Table<TRow>({
  columns,
  rows,
  rowKey,
  caption,
  sort,
  onSortChange,
  stickyHeader = false,
  layout = 'auto',
  rowActions,
  expansion,
  loading = false,
  skeletonRows = 5,
  empty,
  renderCard,
  className,
}: TableProps<TRow>) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const baseId = useId();
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (key: string) =>
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const detailsId = (key: string) => `${baseId}-details-${key}`;

  if (!loading && rows.length === 0 && empty) {
    return (
      <div
        className={cn(
          'flex flex-1 flex-col justify-center rounded-xl border border-border bg-surface shadow-card',
          className,
        )}
      >
        {empty}
      </div>
    );
  }

  const skeletonKeys = Array.from({ length: Math.max(1, skeletonRows) }, (_, index) => index);

  if (!isDesktop) {
    const titleColumns = columns.filter((column) => column.card === 'title');
    const fieldColumns = columns.filter((column) => (column.card ?? 'field') === 'field');

    if (loading) {
      return (
        <div role="status" aria-label={`Loading ${caption}`} className={className}>
          <ul aria-hidden="true" className="flex flex-col gap-3">
            {skeletonKeys.map((key) => (
              <li key={key} className="rounded-xl border border-border bg-surface shadow-card p-4">
                <Skeleton lines={3} />
              </li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <ul aria-label={caption} className={cn('flex flex-col gap-3', className)}>
        {rows.map((row) => {
          const key = rowKey(row);
          const expanded = expandedKeys.has(key);
          const actions = rowActions?.(row);
          return (
            <li key={key} className="rounded-xl border border-border bg-surface shadow-card p-4">
              {renderCard ? (
                renderCard(row)
              ) : (
                <div className="flex flex-col gap-3">
                  {titleColumns.length > 0 || actions ? (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        {titleColumns.map((column) => (
                          <div key={column.id} className="min-w-0">
                            {column.cell(row)}
                          </div>
                        ))}
                      </div>
                      {actions ? <div className="-mt-1.5 -mr-2 shrink-0">{actions}</div> : null}
                    </div>
                  ) : null}
                  {fieldColumns.length > 0 ? (
                    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
                      {fieldColumns.map((column) => (
                        <Fragment key={column.id}>
                          <dt className="text-xs font-medium text-text-muted">{column.header}</dt>
                          <dd className="min-w-0 text-sm text-text">{column.cell(row)}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  ) : null}
                </div>
              )}
              {renderCard && actions ? <div className="mt-3">{actions}</div> : null}
              {expansion ? (
                <div className="mt-2 -mb-1.5 border-t border-border pt-1.5">
                  <ExpandToggle
                    expanded={expanded}
                    label={expansion.label(row)}
                    controls={detailsId(key)}
                    onToggle={() => toggle(key)}
                    withText
                  />
                  {expanded ? (
                    <div id={detailsId(key)} className="pt-1.5 pb-2">
                      {expansion.render(row)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  const hasActions = Boolean(rowActions);
  const columnCount = columns.length + (expansion ? 1 : 0) + (hasActions ? 1 : 0);
  const headerCell = cn(
    'h-[37px] bg-surface px-4 text-xs font-medium whitespace-nowrap text-text-muted',
    'border-b border-row-border first:rounded-tl-lg last:rounded-tr-lg',
    stickyHeader && 'lg:sticky lg:top-[var(--table-sticky-top,0px)] lg:z-10',
  );

  const table = (
    <table
      className={cn(
        'w-full border-separate border-spacing-0 text-xs font-medium',
        layout === 'fixed' && 'table-fixed',
      )}
      aria-busy={loading}
    >
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.id}
              scope="col"
              aria-sort={column.sortable ? ariaSort(sort, column.id) : undefined}
              className={cn(
                headerCell,
                column.align === 'end' ? 'text-right' : 'text-left',
                column.className,
              )}
            >
              {column.sortable && onSortChange ? (
                <button
                  type="button"
                  onClick={() => onSortChange(nextSort(sort, column.id))}
                  className="-mx-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-1 hover:text-text"
                >
                  {column.header}
                  {sort?.columnId === column.id ? (
                    sort.direction === 'asc' ? (
                      <ArrowUp aria-hidden="true" className="size-3.5" />
                    ) : (
                      <ArrowDown aria-hidden="true" className="size-3.5" />
                    )
                  ) : (
                    <ChevronsUpDown aria-hidden="true" className="size-3.5 text-text-subtle" />
                  )}
                </button>
              ) : (
                column.header
              )}
            </th>
          ))}
          {expansion ? (
            <th scope="col" className={cn(headerCell, 'w-12')}>
              <span className="sr-only">Details</span>
            </th>
          ) : null}
          {hasActions ? (
            <th scope="col" className={cn(headerCell, layout === 'fixed' ? 'w-14' : 'w-px')}>
              <span className="sr-only">Actions</span>
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {loading
          ? skeletonKeys.map((key) => (
              <tr key={key}>
                {Array.from({ length: columnCount }, (_, index) => (
                  <td
                    key={index}
                    className={cn(
                      'border-b border-border px-4 py-3.5',
                      index < columns.length && columns[index]?.className,
                    )}
                  >
                    {index < columns.length ? <Skeleton className="w-4/5" /> : null}
                  </td>
                ))}
              </tr>
            ))
          : rows.map((row, rowIndex) => {
              const key = rowKey(row);
              const expanded = expandedKeys.has(key);
              const last = rowIndex === rows.length - 1;
              const cellBorder = last && !expanded ? null : 'border-b border-border';
              return (
                <Fragment key={key}>
                  <tr className="transition-colors duration-fast ease-standard hover:bg-surface-hover/50">
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          'px-4 py-3 align-middle text-text',
                          cellBorder,
                          column.align === 'end' && 'text-right',
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                    {expansion ? (
                      <td className={cn('px-2 py-1.5 text-right align-middle', cellBorder)}>
                        <ExpandToggle
                          expanded={expanded}
                          label={expansion.label(row)}
                          controls={detailsId(key)}
                          onToggle={() => toggle(key)}
                        />
                      </td>
                    ) : null}
                    {hasActions ? (
                      <td
                        className={cn(
                          'py-1.5 pr-3 pl-2 text-right align-middle whitespace-nowrap',
                          cellBorder,
                        )}
                      >
                        {rowActions?.(row)}
                      </td>
                    ) : null}
                  </tr>
                  {expansion && expanded ? (
                    <tr id={detailsId(key)}>
                      <td
                        colSpan={columnCount}
                        className={cn('bg-bg/40 px-4 py-4', !last && 'border-b border-border')}
                      >
                        {expansion.render(row)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
      </tbody>
    </table>
  );

  return (
    <div
      className={cn(
        'min-w-0 flex-1 rounded-xl border border-border bg-surface shadow-card',
        // `clip` rounds the corners but, unlike `hidden`, is not a scroll container, so a sticky
        // header still sticks to the page.
        stickyHeader ? 'overflow-clip' : 'overflow-hidden',
        className,
      )}
      {...(loading ? { role: 'status', 'aria-label': `Loading ${caption}` } : {})}
    >
      {/* `relative` keeps the visually hidden `sr-only` text inside the scroll area. */}
      <div
        className={cn(
          'relative overflow-x-auto',
          stickyHeader && 'lg:overflow-x-clip lg:overflow-y-visible',
        )}
      >
        {table}
      </div>
    </div>
  );
}
