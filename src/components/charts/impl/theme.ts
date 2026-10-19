import type { CSSProperties } from 'react';

import { CHART_CHROME } from '../colors';
import type { ChartDatum, SeriesDef } from '../types';

/** Text style of axis ticks: 12px (`--text-xs`) in the muted text colour. */
export const TICK = { fill: CHART_CHROME.text, fontSize: 12 } as const;

export const AXIS_LINE = { stroke: CHART_CHROME.axis } as const;

export const GRID_PROPS = {
  stroke: CHART_CHROME.grid,
  strokeDasharray: '3 3',
  vertical: false,
} as const;

export const TOOLTIP_STYLE: CSSProperties = {
  background: CHART_CHROME.tooltipBackground,
  border: `1px solid ${CHART_CHROME.tooltipBorder}`,
  borderRadius: 8,
  color: CHART_CHROME.tooltipText,
  fontSize: 12,
  padding: '8px 12px',
};

export const TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: CHART_CHROME.tooltipText,
  fontWeight: 600,
  marginBottom: 4,
};

export const TOOLTIP_ITEM_STYLE: CSSProperties = { color: CHART_CHROME.tooltipText, padding: 0 };

export const TOOLTIP_CURSOR = {
  stroke: CHART_CHROME.axis,
  fill: 'var(--color-surface-hover)',
  fillOpacity: 0.5,
} as const;

export const INITIAL_DIMENSION = { width: 320, height: 180 } as const;

export const Y_AXIS_LABEL_STYLE = {
  fill: CHART_CHROME.text,
  fontSize: 12,
  textAnchor: 'middle',
} as const;

/** True when any value of any series has a fractional part, so the axis should allow decimal ticks. */
export function hasFractions(data: ChartDatum[], series: SeriesDef[]): boolean {
  return data.some((datum) =>
    series.some((item) => {
      const value = datum[item.key];
      return typeof value === 'number' && !Number.isInteger(value);
    }),
  );
}

/** Shortens a long category label for a narrow axis; the tooltip keeps the full text. */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}
