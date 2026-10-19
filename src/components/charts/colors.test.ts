import { describe, expect, it } from 'vitest';

import { chartColorVar, SEMANTIC_CHART_COLORS, TAG_CHART_COLORS } from './colors';

describe('chartColorVar', () => {
  it('maps tag colour names to tag tokens', () => {
    expect(chartColorVar('blue')).toBe('var(--color-tag-blue)');
    expect(chartColorVar('slate')).toBe('var(--color-tag-slate)');
  });

  it('maps semantic names to theme tokens', () => {
    expect(chartColorVar('primary')).toBe('var(--color-primary)');
    expect(chartColorVar('danger')).toBe('var(--color-danger)');
    expect(chartColorVar('muted')).toBe('var(--color-text-muted)');
  });

  it('covers every colour with a css variable and never a hex value', () => {
    expect(TAG_CHART_COLORS).toHaveLength(10);
    for (const color of [...TAG_CHART_COLORS, ...SEMANTIC_CHART_COLORS]) {
      const value = chartColorVar(color);
      expect(value).toMatch(/^var\(--color-[a-z-]+\)$/);
      expect(value).not.toContain('#');
    }
  });
});
