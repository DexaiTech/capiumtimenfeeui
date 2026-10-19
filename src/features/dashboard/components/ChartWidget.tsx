import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type { DisplayableError } from '@/components/ui';
import { cn } from '@/utils/cn';

import type { WidgetData } from '../types';
import { toDisplayable } from '../utils/errors';
import { RefreshButton } from './RefreshButton';
import { UpdatedAt } from './Widget';
import { WidgetNoAccess } from './WidgetStates';

/** What the chart kit takes to draw its own loading, error and header states. */
export interface ChartStateProps {
  loading: boolean;
  error: DisplayableError | null;
  onRetry: () => void;
  /** The refresh button, for the chart's header. */
  actions: ReactNode;
}

export interface ChartWidgetProps<T extends WidgetData> {
  title: string;
  query: UseQueryResult<T>;
  className?: string;
  /** The chart; `data` is undefined until the first answer. */
  children: (data: T | undefined, chart: ChartStateProps) => ReactNode;
}

/**
 * A widget made of a chart of the kit (`@/components/charts`): the chart draws its own card,
 * header, loading, empty and error states and its "View as table" switch; this adds the refresh
 * button, the last-updated line and the notice for a role the widget is not for.
 */
export function ChartWidget<T extends WidgetData>({
  title,
  query,
  className,
  children,
}: ChartWidgetProps<T>) {
  const { data } = query;
  if (data && !data.visible) {
    return (
      <section
        aria-label={title}
        className={cn(
          'flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card',
          className,
        )}
      >
        <h2 className="text-base font-semibold text-text">{title}</h2>
        <WidgetNoAccess title={title} />
      </section>
    );
  }
  const retry = () => void query.refetch();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      {children(data, {
        loading: data === undefined && !query.isError,
        error: data === undefined ? toDisplayable(query.error) : null,
        onRetry: retry,
        actions: <RefreshButton label={title} onRefresh={retry} refreshing={query.isFetching} />,
      })}
      {data ? <UpdatedAt at={data.generated_at} className="px-1" /> : null}
    </div>
  );
}
