import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { chartColorVar } from '../colors';
import type { CartesianImplProps } from '../types';
import {
  AXIS_LINE,
  GRID_PROPS,
  hasFractions,
  INITIAL_DIMENSION,
  TICK,
  TOOLTIP_CURSOR,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
  Y_AXIS_LABEL_STYLE,
} from './theme';
import { formatTooltipLabel, formatTooltipValue } from './tooltip';

/** Recharts line chart. Loaded lazily by `LineChart`; keeps recharts out of the entry chunk. */
export default function LineChartImpl({
  data,
  xKey,
  series,
  xFormatter,
  yFormatter,
  yLabel,
  animate,
}: CartesianImplProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIMENSION}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey={xKey}
          tickFormatter={xFormatter}
          interval="preserveStartEnd"
          minTickGap={24}
          tickMargin={8}
          tick={TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
        />
        <YAxis
          width="auto"
          domain={[0, 'auto']}
          allowDecimals={hasFractions(data, series)}
          tickFormatter={yFormatter}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: 'insideLeft', style: Y_AXIS_LABEL_STYLE }
              : undefined
          }
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={TOOLTIP_CURSOR}
          labelFormatter={(label) => formatTooltipLabel(label, xFormatter)}
          formatter={(value) => formatTooltipValue(value, yFormatter)}
        />
        {series.map((item) => {
          const color = chartColorVar(item.color);
          return (
            <Line
              key={item.key}
              dataKey={item.key}
              name={item.label}
              type={item.kind === 'step' ? 'stepAfter' : 'monotone'}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={item.dashed ? '6 4' : undefined}
              dot={item.dashed ? false : { r: 2, fill: color, stroke: color }}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={animate}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
