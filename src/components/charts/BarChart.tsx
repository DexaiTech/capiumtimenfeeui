import { lazy } from 'react';

import { CartesianChartFrame } from './CartesianChartFrame';
import type { BaseChartProps } from './types';
import { useChartAnimation } from './useChartAnimation';

const BarChartImpl = lazy(() => import('./impl/BarChartImpl'));

const identity = (value: string | number): string => String(value);
const plain = (value: number): string => String(value);

export interface BarChartProps extends BaseChartProps {
  /** Stack the series instead of grouping them. */
  stacked?: boolean;
  /** Draw the bars left to right with the categories on the left. */
  horizontal?: boolean;
  /** A dashed reference line, for example an average. */
  referenceValue?: { value: number; label: string };
  /**
   * Key of a datum value that names the `ChartColor` of that bar, so the bars of one series can
   * be coloured one by one (a priority chart: red, orange, green, grey).
   */
  colorKey?: string;
  /** Print each value above its bar (beside it when horizontal). */
  valueLabels?: boolean;
}

/** Grouped or stacked bar chart, vertical or horizontal, with an optional reference line. */
export function BarChart({
  stacked = false,
  horizontal = false,
  referenceValue,
  colorKey,
  valueLabels = false,
  ...props
}: BarChartProps) {
  const animate = useChartAnimation();
  return (
    <CartesianChartFrame {...props}>
      <BarChartImpl
        data={props.data}
        xKey={props.xKey}
        series={props.series}
        xFormatter={props.xFormatter ?? identity}
        yFormatter={props.yFormatter ?? plain}
        yLabel={props.yLabel}
        animate={animate}
        stacked={stacked}
        horizontal={horizontal}
        referenceValue={referenceValue}
        colorKey={colorKey}
        valueLabels={valueLabels}
      />
    </CartesianChartFrame>
  );
}
