import { ChartColumn, Table as TableIcon, TriangleAlert } from 'lucide-react';
import { Suspense, useId, useState, type CSSProperties, type ReactNode } from 'react';

import { Button, Skeleton, type DisplayableError } from '@/components/ui';
import { cn } from '@/utils/cn';

import { ChartLegend } from './ChartLegend';
import { ChartTable } from './ChartTable';
import type { ChartLegendItem, ChartTableData } from './types';

export type ChartFrameState = 'ready' | 'loading' | 'empty' | 'error';

export interface ChartFrameProps {
  title: string;
  description?: string;
  legend?: ChartLegendItem[];
  /** The data behind the chart, shown by the "View as table" toggle. */
  table: ChartTableData;
  state?: ChartFrameState;
  emptyTitle?: string;
  emptyDescription?: string;
  error?: DisplayableError | null;
  onRetry?: () => void;
  /** Width over height of the chart box. Default 16/9. */
  aspect?: number;
  /** `end` puts the legend in a column beside the chart (under it on narrow screens). */
  legendPlacement?: 'bottom' | 'end';
  /** Extra header controls, shown before the table toggle. */
  actions?: ReactNode;
  className?: string;
  /** The chart element. It is wrapped in Suspense so lazy implementations reserve the same space. */
  children?: ReactNode;
}

const MIN_HEIGHT = 220;

/** The shared box of every chart: header, fixed-size chart area, legend and the accessible table alternative. */
export function ChartFrame({
  title,
  description,
  legend,
  table,
  state = 'ready',
  emptyTitle = 'No data to show',
  emptyDescription,
  error,
  onRetry,
  aspect = 16 / 9,
  legendPlacement = 'bottom',
  actions,
  className,
  children,
}: ChartFrameProps) {
  const titleId = useId();
  const [showTable, setShowTable] = useState(false);
  const boxStyle: CSSProperties = { aspectRatio: String(aspect), minHeight: MIN_HEIGHT };
  const label = description ? `${title}. ${description}` : title;
  const tableAvailable = state === 'ready';
  const beside = legendPlacement === 'end' && state === 'ready' && !showTable;
  const legendList =
    state === 'ready' && legend && legend.length > 0 ? (
      <ChartLegend items={legend} orientation={beside ? 'vertical' : 'horizontal'} />
    ) : null;
  const chartBox = (
    <div
      role="img"
      aria-label={label}
      style={boxStyle}
      className={cn('relative w-full min-w-0', beside && 'sm:w-1/2 sm:shrink-0')}
    >
      <div className="absolute inset-0 overflow-hidden">
        <Suspense fallback={<ChartSkeleton title={title} className="size-full" />}>
          {children}
        </Suspense>
      </div>
    </div>
  );

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface shadow-card p-4',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold text-text">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-sm text-text-muted">{description}</p> : null}
        </div>
        {actions || tableAvailable ? (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {tableAvailable ? (
              <Button
                size="sm"
                variant="ghost"
                aria-pressed={showTable}
                onClick={() => {
                  setShowTable((current) => !current);
                }}
                leftIcon={
                  showTable ? (
                    <ChartColumn className="size-4" aria-hidden="true" />
                  ) : (
                    <TableIcon className="size-4" aria-hidden="true" />
                  )
                }
              >
                View as table
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {state === 'loading' ? (
        <ChartSkeleton title={title} style={boxStyle} />
      ) : state === 'empty' ? (
        <div
          style={boxStyle}
          className="flex w-full flex-col items-center justify-center gap-1 px-6 text-center"
        >
          <p className="text-sm font-medium text-text">{emptyTitle}</p>
          {emptyDescription ? (
            <p className="max-w-md text-sm text-text-muted">{emptyDescription}</p>
          ) : null}
        </div>
      ) : state === 'error' ? (
        <div
          role="alert"
          style={boxStyle}
          className="flex w-full flex-col items-center justify-center gap-2 overflow-auto px-6 py-4 text-center"
        >
          <TriangleAlert className="size-6 text-danger" aria-hidden="true" />
          <p className="text-sm font-medium text-text">Could not load this chart</p>
          <p className="max-w-md text-sm text-text-muted">
            {error?.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {error?.requestId ? (
            <p className="text-xs text-text-subtle">
              Request ID: <code className="font-mono break-all">{error.requestId}</code>
            </p>
          ) : null}
          {onRetry ? <Button onClick={onRetry}>Retry</Button> : null}
        </div>
      ) : showTable ? (
        <ChartTable table={table} />
      ) : beside ? (
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
          {chartBox}
          {legendList}
        </div>
      ) : (
        chartBox
      )}

      {beside ? null : legendList}
    </section>
  );
}

interface ChartSkeletonProps {
  title: string;
  style?: CSSProperties;
  className?: string;
}

function ChartSkeleton({ title, style, className }: ChartSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={`Loading ${title}`}
      style={style}
      className={cn('w-full', className)}
    >
      <Skeleton shape="rect" className="size-full" />
    </div>
  );
}
