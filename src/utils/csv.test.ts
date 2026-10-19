import { describe, expect, it } from 'vitest';

import { csvCell, toCsv } from './csv';

describe('csv', () => {
  it('quotes cells that need it and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('Smith, Jones & Co')).toBe('"Smith, Jones & Co"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell(null)).toBe('');
  });

  it('writes a UTF-8 BOM and CRLF rows', () => {
    expect(
      toCsv([
        ['a', 'b'],
        [1, null],
      ]),
    ).toBe('﻿a,b\r\n1,\r\n');
  });
});
