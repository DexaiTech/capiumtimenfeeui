import { describe, expect, it } from 'vitest';

import { bpToMultiplierInput, formatMultiplier, parseMultiplierToBp } from './multiplier';

describe('parseMultiplierToBp', () => {
  it.each([
    ['1.5', 15_000],
    ['2', 20_000],
    ['1', 10_000],
    ['10', 100_000],
    ['1.25', 12_500],
    ['1.2345', 12_345],
    [' 1.5x ', 15_000],
    ['×1.5', 15_000],
    ['1.5×', 15_000],
  ])('reads %s as %d', (text, bp) => {
    expect(parseMultiplierToBp(text)).toBe(bp);
  });

  it.each(['', 'x', '0.9', '10.5', '11', '-1.5', '1,5', '1.50000', '1.5.1', '1.5 x 2'])(
    'refuses %j',
    (text) => {
      expect(parseMultiplierToBp(text)).toBeNull();
    },
  );
});

describe('showing a multiplier', () => {
  it('writes it without trailing zeros', () => {
    expect(bpToMultiplierInput(15_000)).toBe('1.5');
    expect(bpToMultiplierInput(20_000)).toBe('2');
    expect(bpToMultiplierInput(12_500)).toBe('1.25');
    expect(formatMultiplier(15_000)).toBe('1.5×');
  });
});
