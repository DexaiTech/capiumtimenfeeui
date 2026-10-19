import type { ReactNode } from 'react';

import type { DisplayableError } from '@/components/ui';

import type { ChartColor } from './colors';

/** A value a chart datum or table cell may hold. */
export type ChartValue = string | number | null;

/** One row of chart data. */
export type ChartDatum = Record<string, ChartValue>;

/** A column of the "View as table" alternative. */
export interface ChartTableColumn {
  key: string;
  label: string;
  align?: 'start' | 'end';
}

/** The data behind a chart, as an accessible table. The first column is the row header. */
export interface ChartTableData {
  caption?: string;
  columns: ChartTableColumn[];
  rows: ChartDatum[];
}

/** One legend entry. Dashed entries get a dashed swatch and hidden text for assistive technology. */
export interface ChartLegendItem {
  id: string;
  label: string;
  /** Any CSS colour; use a `var(--color-...)` reference. */
  color: string;
  dashed?: boolean;
  /** Extra text after the label, for example "1h 30m · 25%". */
  detail?: string;
}

/** Definition of one data series. */
export interface SeriesDef {
  /** Key of the value in each datum. */
  key: string;
  label: string;
  color: ChartColor;
  /** Draws a dashed line (a reference or ideal line); only affects line charts. */
  dashed?: boolean;
  /** `step` draws a stepped line (scope lines); only affects line charts. */
  kind?: 'line' | 'step';
}

/** Props shared by the Cartesian charts (line, area, bar). */
export interface BaseChartProps {
  title: string;
  description?: string;
  data: ChartDatum[];
  /** Key of the category (x) value in each datum. */
  xKey: string;
  series: SeriesDef[];
  /** Formats x axis ticks, tooltip headings and table row headers. */
  xFormatter?: (value: string | number) => string;
  /** Formats y axis ticks, tooltip values and table cells. */
  yFormatter?: (value: number) => string;
  /** Name of the y axis, drawn small. */
  yLabel?: string;
  loading?: boolean;
  error?: DisplayableError | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Width over height of the chart box. Default 16/9. */
  aspect?: number;
  /** Show the legend. Default: true when there is more than one series. */
  legend?: boolean;
  /** Extra header controls. */
  actions?: ReactNode;
  /** Overrides the columns of the table alternative. */
  tableColumns?: ChartTableColumn[];
  className?: string;
}

/** Props every lazy implementation module receives. */
export interface CartesianImplProps {
  data: ChartDatum[];
  xKey: string;
  series: SeriesDef[];
  xFormatter: (value: string | number) => string;
  yFormatter: (value: number) => string;
  yLabel?: string;
  /** False when the user prefers reduced motion (and in tests). */
  animate: boolean;
}
