import { describe, expect, it } from 'vitest';

import { isoParam, monthEnd, monthStart, monthsAway, presetOf, rangePresets } from './period';

describe('isoParam', () => {
  it('keeps a calendar date written as YYYY-MM-DD, and nothing else', () => {
    expect(isoParam('2026-10-18')).toBe('2026-10-18');
    expect(isoParam('18/10/2026')).toBe('');
    expect(isoParam('2026-10-18T10:00:00Z')).toBe('');
    expect(isoParam('')).toBe('');
    expect(isoParam(null)).toBe('');
  });
});

describe('months', () => {
  it('finds the first and the last day of a month, leap years included', () => {
    expect(monthStart('2026-10-18')).toBe('2026-10-01');
    expect(monthEnd('2026-10-18')).toBe('2026-10-31');
    expect(monthEnd('2026-02-10')).toBe('2026-02-28');
    expect(monthEnd('2028-02-10')).toBe('2028-02-29');
    expect(monthEnd('2026-04-01')).toBe('2026-04-30');
  });

  it('moves to the first of another month, across years', () => {
    expect(monthsAway('2026-10-18', -1)).toBe('2026-09-01');
    expect(monthsAway('2026-01-15', -2)).toBe('2025-11-01');
    expect(monthsAway('2026-11-30', 2)).toBe('2027-01-01');
    expect(monthsAway('2026-10-18', 0)).toBe('2026-10-01');
  });
});

describe('the period presets', () => {
  it('works out the ranges the select offers from today', () => {
    expect(rangePresets('2026-10-18')).toEqual([
      { value: 'this-month', label: 'This month', from: '2026-10-01', to: '2026-10-18' },
      { value: 'last-month', label: 'Last month', from: '2026-09-01', to: '2026-09-30' },
      { value: 'last-3-months', label: 'Last 3 months', from: '2026-08-01', to: '2026-10-18' },
      { value: 'this-year', label: 'This year', from: '2026-01-01', to: '2026-10-18' },
      { value: 'last-12-months', label: 'Last 12 months', from: '2025-10-19', to: '2026-10-18' },
    ]);
  });

  it('puts last month on the right days at the start of a year', () => {
    const last = rangePresets('2026-01-05').find((preset) => preset.value === 'last-month');
    expect(last).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('names the preset a range matches, and calls any other range custom', () => {
    const presets = rangePresets('2026-10-18');
    expect(presetOf('2026-09-01', '2026-09-30', presets)).toBe('last-month');
    expect(presetOf('2026-01-01', '2026-10-18', presets)).toBe('this-year');
    expect(presetOf('2026-09-02', '2026-09-30', presets)).toBe('custom');
    expect(presetOf('', '', presets)).toBe('custom');
  });
});
