import { TriangleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { Button, Skeleton, type DisplayableError } from '@/components/ui';
import { cn } from '@/utils/cn';

import { chartColorVar, type ChartColor } from './colors';

export interface HorizontalBarItem {
  key: string;
  label: string;
  value: number;
  /** The bar's colour (drawn as a pastel of it). Default: the muted grey. */
  color?: ChartColor;
}

export interface HorizontalBarListProps {
  title: string;
  items: ReadonlyArray<HorizontalBarItem>;
  /** Formats the value at the end of a row. Default: the number. */
  valueFormatter?: (value: number) => string;
  loading?: boolean;
  error?: DisplayableError | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Extra header controls. */
  actions?: ReactNode;
  className?: string;
}

const plain = (value: number): string => String(value);

/**
 * Ranked horizontal bars as a list: the name on the left, a pastel bar sized against the largest
 * value, the value at the end. Every row is text first (name and value), so the list is its own
 * text alternative. Loading, empty and error states match the other charts.
 */
export function HorizontalBarList({
  title,
  items,
  valueFormatter = plain,
  loading = false,
  error,
  onRetry,
  emptyTitle = 'No data to show',
  emptyDescription,
  actions,
  className,
}: HorizontalBarListProps) {
  const titleId = useId();
  const largest = Math.max(1, ...items.map((item) => item.value));

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface shadow-card p-4',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-base font-semibold text-text">
          {title}
        </h2>
        {actions}
      </header>

      {error ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center"
        >
          <TriangleAlert className="size-6 text-danger" aria-hidden="true" />
          <p className="text-sm font-medium text-text">Could not load this chart</p>
          <p className="max-w-md text-sm text-text-muted">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {error.requestId ? (
            <p className="text-xs text-text-subtle">
              Request ID: <code className="font-mono break-all">{error.requestId}</code>
            </p>
          ) : null}
          {onRetry ? <Button onClick={onRetry}>Retry</Button> : null}
        </div>
      ) : loading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} shape="rect" className="h-5 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 px-6 py-8 text-center">
          <p className="text-sm font-medium text-text">{emptyTitle}</p>
          {emptyDescription ? (
            <p className="max-w-md text-sm text-text-muted">{emptyDescription}</p>
          ) : null}
        </div>
      ) : (
        <ul aria-label={title} className="flex flex-col gap-2.5">
          {items.map((item) => (
            <li
              key={item.key}
              className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs"
            >
              <span className="truncate font-medium text-text-muted" title={item.label}>
                {item.label}
              </span>
              <span aria-hidden="true" className="flex h-5 items-center">
                <span
                  className="block h-full rounded-md"
                  style={{
                    width: `${String((item.value / largest) * 100)}%`,
                    backgroundColor: `color-mix(in srgb, ${chartColorVar(item.color ?? 'muted')} 35%, transparent)`,
                  }}
                />
              </span>
              <span className="min-w-6 text-right font-medium text-text tabular-nums">
                {valueFormatter(item.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
