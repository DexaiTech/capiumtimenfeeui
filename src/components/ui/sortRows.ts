import type { DataTableColumn, DataTableSort } from './DataTable';

/**
 * Sorts rows on the client by the sorted column's `sortValue` (strings by locale, numbers by
 * value, empty values last). For lists the server sorts, pass the rows as they come.
 */
export function sortRows<TRow>(
  rows: ReadonlyArray<TRow>,
  columns: ReadonlyArray<DataTableColumn<TRow>>,
  sort: DataTableSort | null | undefined,
): TRow[] {
  const column = sort ? columns.find((entry) => entry.id === sort.columnId) : undefined;
  if (!sort || !column?.sortValue) return [...rows];
  const value = column.sortValue;
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === right) return 0;
    if (left === null || left === undefined || left === '') return 1;
    if (right === null || right === undefined || right === '') return -1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
    return String(left).localeCompare(String(right), 'en-GB', { numeric: true }) * factor;
  });
}
