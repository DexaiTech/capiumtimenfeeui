import type { ReactNode } from 'react';

import { chartColorVar } from './colors';
import { ChartFrame } from './ChartFrame';
import { buildCartesianTable } from './cartesianTable';
import type { BaseChartProps } from './types';

/** Internal: the props a Cartesian chart passes to its frame, plus the lazy implementation as children. */
export interface CartesianChartFrameProps extends BaseChartProps {
  children: ReactNode;
}

/** Internal: ChartFrame wired with state, legend and table derived from Cartesian chart props. */
export function CartesianChartFrame({
  children,
  title,
  description,
  data,
  series,
  loading = false,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  aspect,
  legend,
  actions,
  className,
  xKey,
  xFormatter,
  yFormatter,
  tableColumns,
}: CartesianChartFrameProps) {
  const state = error ? 'error' : loading ? 'loading' : data.length === 0 ? 'empty' : 'ready';
  const showLegend = legend ?? series.length > 1;
  return (
    <ChartFrame
      title={title}
      description={description}
      state={state}
      error={error}
      onRetry={onRetry}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      aspect={aspect}
      actions={actions}
      className={className}
      legend={
        showLegend
          ? series.map((item) => ({
              id: item.key,
              label: item.label,
              color: chartColorVar(item.color),
              dashed: item.dashed,
            }))
          : undefined
      }
      table={buildCartesianTable({
        title,
        data,
        xKey,
        series,
        xFormatter,
        yFormatter,
        tableColumns,
      })}
    >
      {children}
    </ChartFrame>
  );
}
