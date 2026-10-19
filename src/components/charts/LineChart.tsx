import { lazy } from 'react';

import { CartesianChartFrame } from './CartesianChartFrame';
import type { BaseChartProps } from './types';
import { useChartAnimation } from './useChartAnimation';

const LineChartImpl = lazy(() => import('./impl/LineChartImpl'));

const identity = (value: string | number): string => String(value);
const plain = (value: number): string => String(value);

export type LineChartProps = BaseChartProps;

/** Multi-series line chart; series may be dashed (reference lines) or stepped (scope lines). */
export function LineChart(props: LineChartProps) {
  const animate = useChartAnimation();
  return (
    <CartesianChartFrame {...props}>
      <LineChartImpl
        data={props.data}
        xKey={props.xKey}
        series={props.series}
        xFormatter={props.xFormatter ?? identity}
        yFormatter={props.yFormatter ?? plain}
        yLabel={props.yLabel}
        animate={animate}
      />
    </CartesianChartFrame>
  );
}
