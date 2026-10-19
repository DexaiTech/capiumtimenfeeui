import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { CHART_CHROME } from '../colors';
import { INITIAL_DIMENSION, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from './theme';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  /** A CSS colour (a theme variable reference). */
  color: string;
  /** The slice's share of the total, already formatted ("25%"). */
  share: string;
}

export interface DonutChartImplProps {
  slices: DonutSlice[];
  valueFormatter: (value: number) => string;
  centreLabel?: { value: string; label: string };
  animate: boolean;
}

/** Recharts donut with an optional HTML label in the middle. Loaded lazily by `DonutChart`. */
export default function DonutChartImpl({
  slices,
  valueFormatter,
  centreLabel,
  animate,
}: DonutChartImplProps) {
  const pie = slices.map((slice) => ({
    name: slice.label,
    value: slice.value,
    key: slice.key,
    fill: slice.color,
  }));
  return (
    <div className="relative size-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIMENSION}>
        <PieChart>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(value, name) => {
              const amount = typeof value === 'number' ? value : 0;
              const share = slices.find((slice) => slice.label === name)?.share;
              return [`${valueFormatter(amount)}${share ? ` (${share})` : ''}`, name];
            }}
          />
          <Pie
            data={pie}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            stroke={CHART_CHROME.surface}
            strokeWidth={2}
            isAnimationActive={animate}
          ></Pie>
        </PieChart>
      </ResponsiveContainer>
      {centreLabel ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-semibold text-text tabular-nums">{centreLabel.value}</span>
          <span className="text-xs text-text-muted">{centreLabel.label}</span>
        </div>
      ) : null}
    </div>
  );
}
