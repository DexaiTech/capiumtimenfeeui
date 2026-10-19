import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts';

import { CHART_CHROME, chartColorVar, type ChartColor } from '../colors';
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
  truncate,
  Y_AXIS_LABEL_STYLE,
} from './theme';
import { formatTooltipLabel, formatTooltipValue } from './tooltip';

export interface BarReference {
  value: number;
  label: string;
}

export interface BarChartImplProps extends CartesianImplProps {
  stacked: boolean;
  horizontal: boolean;
  referenceValue?: BarReference;
  colorKey?: string;
  valueLabels: boolean;
}

const CATEGORY_AXIS_WIDTH = 96;
const MAX_LABEL_CHARS = 14;

/** Recharts bar chart (grouped or stacked, vertical or horizontal). Loaded lazily by `BarChart`. */
export default function BarChartImpl({
  data,
  xKey,
  series,
  xFormatter,
  yFormatter,
  yLabel,
  animate,
  stacked,
  horizontal,
  referenceValue,
  colorKey,
  valueLabels,
}: BarChartImplProps) {
  const decimals = hasFractions(data, series);
  const valueLabel = yLabel
    ? {
        value: yLabel,
        angle: horizontal ? 0 : -90,
        position: horizontal ? ('insideBottom' as const) : ('insideLeft' as const),
        style: Y_AXIS_LABEL_STYLE,
      }
    : undefined;
  const category = horizontal ? (
    <YAxis
      type="category"
      dataKey={xKey}
      width={CATEGORY_AXIS_WIDTH}
      interval={0}
      tickFormatter={(value: string | number) => truncate(xFormatter(value), MAX_LABEL_CHARS)}
      tick={TICK}
      axisLine={AXIS_LINE}
      tickLine={false}
    />
  ) : (
    <XAxis
      type="category"
      dataKey={xKey}
      tickFormatter={xFormatter}
      interval="preserveStartEnd"
      minTickGap={16}
      tickMargin={8}
      tick={TICK}
      axisLine={AXIS_LINE}
      tickLine={false}
    />
  );
  const numeric = horizontal ? (
    <XAxis
      type="number"
      domain={[0, 'auto']}
      allowDecimals={decimals}
      tickFormatter={yFormatter}
      tick={TICK}
      axisLine={false}
      tickLine={false}
      label={valueLabel}
    />
  ) : (
    <YAxis
      type="number"
      width="auto"
      domain={[0, 'auto']}
      allowDecimals={decimals}
      tickFormatter={yFormatter}
      tick={TICK}
      axisLine={false}
      tickLine={false}
      label={valueLabel}
    />
  );
  const referenceLabel = referenceValue
    ? {
        value: referenceValue.label,
        position: 'insideTopRight' as const,
        fill: CHART_CHROME.text,
        fontSize: 12,
      }
    : undefined;
  // One series whose bars take their colour from the datum (`colorKey`).
  const coloured = (props: BarShapeProps) => {
    const name = colorKey ? data[props.originalDataIndex]?.[colorKey] : undefined;
    return (
      <Rectangle
        {...props}
        fill={typeof name === 'string' ? chartColorVar(name as ChartColor) : props.fill}
      />
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIMENSION}>
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{
          top: valueLabels && !horizontal ? 20 : 8,
          right: valueLabels && horizontal ? 28 : 12,
          bottom: horizontal && yLabel ? 16 : 0,
          left: 0,
        }}
      >
        <CartesianGrid {...GRID_PROPS} vertical={horizontal} horizontal={!horizontal} />
        {category}
        {numeric}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={{ ...TOOLTIP_CURSOR, stroke: undefined }}
          labelFormatter={(label) => formatTooltipLabel(label, xFormatter)}
          formatter={(value) => formatTooltipValue(value, yFormatter)}
        />
        {series.map((item, index) => {
          const isTop = !stacked || index === series.length - 1;
          const radius: [number, number, number, number] = !isTop
            ? [0, 0, 0, 0]
            : horizontal
              ? [0, 4, 4, 0]
              : [4, 4, 0, 0];
          return (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              fill={chartColorVar(item.color)}
              stackId={stacked ? 'stack' : undefined}
              radius={radius}
              maxBarSize={40}
              isAnimationActive={animate}
              shape={colorKey ? coloured : undefined}
            >
              {valueLabels ? (
                <LabelList
                  dataKey={item.key}
                  position={horizontal ? 'right' : 'top'}
                  formatter={(value: unknown) =>
                    typeof value === 'number' ? yFormatter(value) : ''
                  }
                  fill={CHART_CHROME.text}
                  fontSize={12}
                />
              ) : null}
            </Bar>
          );
        })}
        {referenceValue ? (
          <ReferenceLine
            {...(horizontal ? { x: referenceValue.value } : { y: referenceValue.value })}
            stroke={CHART_CHROME.text}
            strokeDasharray="4 4"
            label={referenceLabel}
          />
        ) : null}
      </BarChart>
    </ResponsiveContainer>
  );
}
