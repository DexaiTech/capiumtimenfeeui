/** The ten tag colours shared with the design tokens (`--color-tag-*`). */
export const TAG_CHART_COLORS = [
  'slate',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'violet',
  'pink',
] as const;

/** Semantic theme colours usable in a chart. */
export const SEMANTIC_CHART_COLORS = [
  'primary',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'muted',
] as const;

/** A colour a chart series may use: a tag colour name or a semantic colour name. */
export type ChartColor = (typeof TAG_CHART_COLORS)[number] | (typeof SEMANTIC_CHART_COLORS)[number];

const SEMANTIC_VARS: Record<(typeof SEMANTIC_CHART_COLORS)[number], string> = {
  primary: 'var(--color-primary)',
  accent: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  muted: 'var(--color-text-muted)',
};

function isSemantic(color: ChartColor): color is (typeof SEMANTIC_CHART_COLORS)[number] {
  return (SEMANTIC_CHART_COLORS as readonly string[]).includes(color);
}

/** Maps a chart colour name to its CSS variable reference, so light and dark themes apply automatically. */
export function chartColorVar(color: ChartColor): string {
  return isSemantic(color) ? SEMANTIC_VARS[color] : `var(--color-tag-${color})`;
}

/** Structural axis, grid and tooltip colours, all theme variables. */
export const CHART_CHROME = {
  grid: 'var(--color-border)',
  axis: 'var(--color-border)',
  text: 'var(--color-text-muted)',
  tooltipBackground: 'var(--color-surface-raised)',
  tooltipBorder: 'var(--color-border)',
  tooltipText: 'var(--color-text)',
  surface: 'var(--color-surface)',
} as const;
