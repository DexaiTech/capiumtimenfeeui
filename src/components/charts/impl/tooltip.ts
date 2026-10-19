import type { ReactNode } from 'react';

/** Tooltip value formatter shared by the Cartesian charts. */
export function formatTooltipValue(value: unknown, yFormatter: (value: number) => string): string {
  if (typeof value === 'number') return yFormatter(value);
  return typeof value === 'string' ? value : '';
}

/** Tooltip heading formatter: runs the category through `xFormatter` when it is a string or number. */
export function formatTooltipLabel(
  label: ReactNode,
  xFormatter: (value: string | number) => string,
): ReactNode {
  return typeof label === 'string' || typeof label === 'number' ? xFormatter(label) : label;
}
