import { describe, expect, it } from 'vitest';

import { bpToPercentInput, parsePercentToBp } from './vat';

describe('parsePercentToBp', () => {
  it.each([
    ['20', 2000],
    ['17.5', 1750],
    ['5.25', 525],
    ['0', 0],
    ['100', 10_000],
    ['100.00', 10_000],
    ['0.05', 5],
    [' 12.5 % ', 1250],
    ['7%', 700],
  ])('reads %j as %i basis points', (text, bp) => {
    expect(parsePercentToBp(text)).toBe(bp);
  });

  it.each(['', '  ', 'abc', '-1', '101', '100.01', '1.234', '12,5', '1e2', '20 %%'])(
    'refuses %j',
    (text) => {
      expect(parsePercentToBp(text)).toBeNull();
    },
  );
});

describe('bpToPercentInput', () => {
  it.each([
    [2000, '20'],
    [1750, '17.5'],
    [525, '5.25'],
    [0, '0'],
    [5, '0.05'],
    [50, '0.5'],
    [10_000, '100'],
  ])('writes %i basis points as %j', (bp, text) => {
    expect(bpToPercentInput(bp)).toBe(text);
  });

  it('reads back every rate the API accepts as the same rate', () => {
    for (let bp = 0; bp <= 10_000; bp += 1) {
      expect(parsePercentToBp(bpToPercentInput(bp))).toBe(bp);
    }
  });
});
