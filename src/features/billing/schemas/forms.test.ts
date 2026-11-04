import { describe, expect, it } from 'vitest';

import { MAX_DOCUMENT_LINES } from '../constants';
import { newGridLine } from '../utils/lineGrid';
import { draftLinesSchema, prepareLinesSchema, type GridLineValues } from './forms';

/** A row of work billing £100: one per time entry, as "one line per entry" drafts them. */
const workRow = (index: number): GridLineValues => ({
  ...newGridLine(`Time entry ${index + 1}`),
  key: `entry:${index}`,
  wip: true,
  net_amount: '100.00',
});

const typedRow = (index: number): GridLineValues => ({
  ...newGridLine(`Fee ${index + 1}`),
  unit_amount: '10',
});

const rows = (count: number, row: (index: number) => GridLineValues) =>
  Array.from({ length: count }, (_, index) => row(index));

describe('the lines of an invoice in the grid (APT75)', () => {
  it('takes any number of lines of work: one per entry over 200 entries', () => {
    const lines = [...rows(450, workRow), ...rows(3, typedRow)];
    expect(prepareLinesSchema.safeParse({ lines }).success).toBe(true);
    expect(draftLinesSchema.safeParse({ lines }).success).toBe(true);
  });

  it('takes at most 200 lines typed in', () => {
    const lines = [...rows(5, workRow), ...rows(MAX_DOCUMENT_LINES + 1, typedRow)];
    for (const schema of [prepareLinesSchema, draftLinesSchema]) {
      const result = schema.safeParse({ lines });
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.message)).toEqual([
        `Add at most ${MAX_DOCUMENT_LINES} lines that bill no work`,
      ]);
    }
    expect(
      prepareLinesSchema.safeParse({ lines: rows(MAX_DOCUMENT_LINES, typedRow) }).success,
    ).toBe(true);
  });
});
