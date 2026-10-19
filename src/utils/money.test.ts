import { describe, expect, it } from 'vitest';

import {
  currencySymbol,
  formatBasisPoints,
  formatMoney,
  parsePounds,
  penceToDecimalString,
  penceToPoundsInput,
} from './money';

describe('formatMoney', () => {
  it('formats pence as pounds with the symbol and thousands separators', () => {
    expect(formatMoney(123456)).toBe('£1,234.56');
    expect(formatMoney(0)).toBe('£0.00');
    expect(formatMoney(5)).toBe('£0.05');
    expect(formatMoney(100)).toBe('£1.00');
    expect(formatMoney(123456789012)).toBe('£1,234,567,890.12');
  });

  it('formats negative amounts (credits, discounts)', () => {
    expect(formatMoney(-123456)).toBe('-£1,234.56');
    expect(formatMoney(-5)).toBe('-£0.05');
  });

  it('is exact where a float would drift', () => {
    // 0.1 + 0.2 style traps: 10 + 20 pence must read 30p exactly.
    expect(formatMoney(10 + 20)).toBe('£0.30');
    expect(formatMoney(4_503_599_627_370_495)).toBe('£45,035,996,273,704.95');
  });

  it('formats other currencies', () => {
    expect(formatMoney(123456, 'EUR')).toBe('€1,234.56');
    expect(formatMoney(1234, 'JPY')).toBe('JP¥1,234');
  });

  it('gives an empty string for a missing amount', () => {
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(undefined)).toBe('');
  });

  it('refuses fractional pence', () => {
    expect(() => formatMoney(1.5)).toThrow(RangeError);
  });
});

describe('parsePounds', () => {
  it('parses typed amounts into whole pence', () => {
    expect(parsePounds('1,234.5')).toBe(123450);
    expect(parsePounds('1234.56')).toBe(123456);
    expect(parsePounds('12')).toBe(1200);
    expect(parsePounds('0.01')).toBe(1);
    expect(parsePounds('.5')).toBe(50);
    expect(parsePounds('7.')).toBe(700);
  });

  it('ignores the symbol, spaces and separators', () => {
    expect(parsePounds('£1,234.56')).toBe(123456);
    expect(parsePounds('  £ 99.99 ')).toBe(9999);
    expect(parsePounds('1 000 000')).toBe(100000000);
  });

  it('parses negative amounts', () => {
    expect(parsePounds('-3.25')).toBe(-325);
    expect(parsePounds('-£3.25')).toBe(-325);
    expect(parsePounds('-0')).toBe(0);
  });

  it('never drifts like floating point', () => {
    // parseFloat('1.15') * 100 === 114.99999999999999
    expect(parsePounds('1.15')).toBe(115);
    expect(parsePounds('4.35')).toBe(435);
    expect(parsePounds('1005.03')).toBe(100503);
  });

  it('rejects what is not an amount', () => {
    expect(parsePounds('')).toBeNull();
    expect(parsePounds('abc')).toBeNull();
    expect(parsePounds('1.234')).toBeNull();
    expect(parsePounds('1.2.3')).toBeNull();
    expect(parsePounds('.')).toBeNull();
    expect(parsePounds('1e3')).toBeNull();
  });

  it('round-trips with penceToPoundsInput', () => {
    for (const pence of [0, 1, 99, 100, 123456, -325, 9_999_999_999]) {
      expect(parsePounds(penceToPoundsInput(pence))).toBe(pence);
    }
  });
});

describe('penceToDecimalString and penceToPoundsInput', () => {
  it('writes the exact decimal', () => {
    expect(penceToDecimalString(123456)).toBe('1234.56');
    expect(penceToDecimalString(5)).toBe('0.05');
    expect(penceToDecimalString(-5)).toBe('-0.05');
    expect(penceToDecimalString(1234, 'JPY')).toBe('1234');
    expect(penceToPoundsInput(9500)).toBe('95.00');
    expect(penceToPoundsInput(null)).toBe('');
  });
});

describe('currencySymbol and formatBasisPoints', () => {
  it('names the currency symbol', () => {
    expect(currencySymbol('GBP')).toBe('£');
  });

  it('formats basis points as percentages', () => {
    expect(formatBasisPoints(2000)).toBe('20%');
    expect(formatBasisPoints(1750)).toBe('17.5%');
    expect(formatBasisPoints(525)).toBe('5.25%');
    expect(formatBasisPoints(0)).toBe('0%');
    expect(formatBasisPoints(null)).toBe('—');
  });
});
