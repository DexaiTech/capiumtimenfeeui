import { cn } from '@/utils/cn';

import type { ChartTableData, ChartValue } from './types';

export interface ChartTableProps {
  table: ChartTableData;
  className?: string;
}

function cell(value: ChartValue | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

/** The accessible table alternative to a chart. The first column is the row header. */
export function ChartTable({ table, className }: ChartTableProps) {
  return (
    <div
      className={cn('overflow-auto', className)}
      tabIndex={0}
      role="region"
      aria-label={table.caption}
    >
      <table className="w-full border-collapse text-sm">
        {table.caption ? <caption className="sr-only">{table.caption}</caption> : null}
        <thead>
          <tr className="border-b border-border">
            {table.columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-3 py-2 text-xs font-medium text-text-muted',
                  column.align === 'end' ? 'text-end' : 'text-start',
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border last:border-b-0">
              {table.columns.map((column, columnIndex) => {
                const className = cn(
                  'px-3 py-2 tabular-nums',
                  column.align === 'end' ? 'text-end' : 'text-start',
                );
                return columnIndex === 0 ? (
                  <th
                    key={column.key}
                    scope="row"
                    className={cn(className, 'font-medium text-text')}
                  >
                    {cell(row[column.key])}
                  </th>
                ) : (
                  <td key={column.key} className={cn(className, 'text-text-muted')}>
                    {cell(row[column.key])}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
