import { cn } from '@/utils/cn';

import type { ChartLegendItem } from './types';

export interface ChartLegendProps {
  items: ChartLegendItem[];
  /** `vertical` lists one entry per line with a dot and the detail at the end. Default `horizontal`. */
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/** A list of series with a colour swatch and a label; dashed series are also described in text. */
export function ChartLegend({ items, orientation = 'horizontal', className }: ChartLegendProps) {
  if (items.length === 0) return null;
  const vertical = orientation === 'vertical';
  return (
    <ul
      aria-label="Legend"
      className={cn(
        vertical ? 'flex min-w-0 flex-1 flex-col gap-2.5' : 'flex flex-wrap gap-x-4 gap-y-1.5',
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2 text-xs text-text-muted">
          {item.dashed ? (
            <span
              aria-hidden="true"
              className="block h-0 w-4 shrink-0 border-t-2 border-dashed"
              style={{ borderColor: item.color }}
            />
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                'block shrink-0',
                vertical ? 'size-2.5 rounded-full' : 'h-2 w-4 rounded-xs',
              )}
              style={{ backgroundColor: item.color }}
            />
          )}
          <span className={cn('text-text', vertical && 'min-w-0 flex-1 truncate')}>
            {item.label}
          </span>
          {item.dashed ? <span className="sr-only">(dashed line)</span> : null}
          {item.detail ? <span className="tabular-nums">{item.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}
