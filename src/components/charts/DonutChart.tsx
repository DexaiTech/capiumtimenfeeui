import { lazy, type ReactNode } from 'react';

import type { DisplayableError } from '@/components/ui';

import { chartColorVar, type ChartColor } from './colors';
import { ChartFrame } from './ChartFrame';
import { formatPercent } from './format';
import type { ChartTableData } from './types';
import { useChartAnimation } from './useChartAnimation';

const DonutChartImpl = lazy(() => import('./impl/DonutChartImpl'));

export interface DonutDatum {
  key: string;
  label: string;
  value: number;
  color: ChartColor;
  /** A share the caller already has ("1.9%"); it replaces the whole percentage computed here. */
  share?: string;
}

export interface DonutChartProps {
  title: string;
  description?: string;
  data: DonutDatum[];
  valueFormatter?: (value: number) => string;
  /** Text drawn in the middle of the ring, for example the total. */
  centreLabel?: { value: string; label: string };
  /** `end` lists the legend in a column beside the ring. Default `bottom`. */
  legendPlacement?: 'bottom' | 'end';
  /** The text after a label in the legend, from the formatted value and share. Default "value · share". */
  legendDetail?: (value: string, share: string) => string;
  loading?: boolean;
  error?: DisplayableError | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  aspect?: number;
  actions?: ReactNode;
  className?: string;
}

const plain = (value: number): string => String(value);

/** Donut chart whose legend lists each slice with its value and share; empty when every value is 0. */
export function DonutChart({
  title,
  description,
  data,
  valueFormatter = plain,
  centreLabel,
  legendPlacement,
  legendDetail = (value, share) => `${value} · ${share}`,
  loading = false,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  aspect,
  actions,
  className,
}: DonutChartProps) {
  const animate = useChartAnimation();
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const state = error ? 'error' : loading ? 'loading' : total <= 0 ? 'empty' : 'ready';
  const share = (value: number): string => formatPercent(total > 0 ? value / total : 0);
  const slices = data.map((item) => ({
    key: item.key,
    label: item.label,
    value: Math.max(0, item.value),
    color: chartColorVar(item.color),
    share: item.share ?? share(Math.max(0, item.value)),
  }));
  const table: ChartTableData = {
    caption: title,
    columns: [
      { key: 'label', label: 'Label', align: 'start' },
      { key: 'value', label: 'Value', align: 'end' },
      { key: 'percent', label: 'Percent', align: 'end' },
    ],
    rows: slices.map((slice) => ({
      label: slice.label,
      value: valueFormatter(slice.value),
      percent: slice.share,
    })),
  };

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
      legendPlacement={legendPlacement}
      actions={actions}
      className={className}
      table={table}
      legend={slices.map((slice) => ({
        id: slice.key,
        label: slice.label,
        color: slice.color,
        detail: legendDetail(valueFormatter(slice.value), slice.share),
      }))}
    >
      <DonutChartImpl
        slices={slices}
        valueFormatter={valueFormatter}
        centreLabel={centreLabel}
        animate={animate}
      />
    </ChartFrame>
  );
}
