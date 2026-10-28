import { describe, expect, it } from 'vitest';

import { formatSequenceNumber, previewNumbers } from './numbering';

describe('formatSequenceNumber', () => {
  it.each([
    ['INV-', 42, 5, 'INV-00042'],
    ['', 7, 3, '007'],
    ['ACME/', 120, 6, 'ACME/000120'],
    // A number wider than the padding is never cut.
    ['CN-', 123_456, 5, 'CN-123456'],
    ['APT', 63, 1, 'APT63'],
  ])('prints %j %i padded to %i as %j', (prefix, number, padding, expected) => {
    expect(formatSequenceNumber(prefix, number, padding)).toBe(expected);
  });
});

describe('previewNumbers', () => {
  it('gives the next numbers of a valid draft', () => {
    expect(previewNumbers({ prefix: 'INV-', padding: '5', next_number: '42' }, 3)).toEqual([
      'INV-00042',
      'INV-00043',
      'INV-00044',
    ]);
    expect(previewNumbers({ prefix: ' EST- ', padding: ' 4 ', next_number: ' 9 ' })).toEqual([
      'EST-0009',
    ]);
  });

  it('prints the suffix after the number, and refuses one with characters that are not allowed', () => {
    expect(
      previewNumbers({ prefix: 'INV-', suffix: '/26', padding: '5', next_number: '42' }, 2),
    ).toEqual(['INV-00042/26', 'INV-00043/26']);
    expect(previewNumbers({ prefix: 'INV-', suffix: 'a b', padding: '5', next_number: '1' })).toBe(
      null,
    );
  });

  it.each([
    ['padding below 1', { prefix: 'A', padding: '0', next_number: '1' }],
    ['padding above 10', { prefix: 'A', padding: '11', next_number: '1' }],
    ['padding that is not a number', { prefix: 'A', padding: 'x', next_number: '1' }],
    ['next number 0', { prefix: 'A', padding: '5', next_number: '0' }],
    ['next number that is not a number', { prefix: 'A', padding: '5', next_number: '1.5' }],
    ['next number above the limit', { prefix: 'A', padding: '5', next_number: '2000000001' }],
    ['prefix with a space', { prefix: 'A B', padding: '5', next_number: '1' }],
    ['prefix longer than 12', { prefix: 'ABCDEFGHIJKLM', padding: '5', next_number: '1' }],
  ])('gives nothing for %s', (_label, draft) => {
    expect(previewNumbers(draft)).toBeNull();
  });
});
