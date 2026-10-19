import { lazy } from 'react';

import { CartesianChartFrame } from './CartesianChartFrame';
import type { BaseChartProps } from './types';
import { useChartAnimation } from './useChartAnimation';

const AreaChartImpl = lazy(() => import('./impl/AreaChartImpl'));

const identity = (value: string | number): string => String(value);
const plain = (value: number): string => String(value);

export interface AreaChartProps extends BaseChartProps {
  /** Stack the series on top of each other. Default true. */
  stacked?: boolean;
}

/** Area chart with translucent fills and solid strokes; stacked by default. */
export function AreaChart({ stacked = true, ...props }: AreaChartProps) {
  const animate = useChartAnimation();
  return (
    <CartesianChartFrame {...props}>
      <AreaChartImpl
        data={props.data}
        xKey={props.xKey}
        series={props.series}
        xFormatter={props.xFormatter ?? identity}
        yFormatter={props.yFormatter ?? plain}
        yLabel={props.yLabel}
        animate={animate}
        stacked={stacked}
      />
    </CartesianChartFrame>
  );
}
