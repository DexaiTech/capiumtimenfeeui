import { describe, expect, it } from 'vitest';

import { wipItems } from '../test/workspaceFixtures';
import { ageingBucket, ageingOf, groupByJob } from './wip';

const TODAY = '2026-06-15';

describe('ageingBucket', () => {
  it.each([
    ['2026-06-15', '0_30'],
    ['2026-05-16', '0_30'],
    ['2026-05-15', '31_60'],
    ['2026-04-16', '31_60'],
    ['2026-04-15', '61_90'],
    ['2026-03-17', '61_90'],
    ['2026-03-16', '90_plus'],
    ['2025-01-01', '90_plus'],
  ] as const)('puts an item of %s in %s', (date, bucket) => {
    expect(ageingBucket(date, TODAY)).toBe(bucket);
  });

  it('counts an item dated in the future as new', () => {
    expect(ageingBucket('2026-06-20', TODAY)).toBe('0_30');
  });
});

describe('ageingOf', () => {
  it('adds up the value of the items in each bucket', () => {
    expect(ageingOf(wipItems, TODAY)).toEqual({
      '0_30': 14250 + 1300,
      '31_60': 19000,
      '61_90': 9500,
      '90_plus': 4750,
    });
  });

  it('is all zeros for no items', () => {
    expect(ageingOf([], TODAY)).toEqual({ '0_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 });
  });
});

describe('groupByJob', () => {
  it('sums each job, the biggest first, and puts items without a job last', () => {
    const groups = groupByJob(wipItems);
    expect(
      groups.map((group) => [group.job?.number ?? null, group.items, group.minutes, group.value]),
    ).toEqual([
      ['J-0001', 2, 210, 14250 + 19000],
      ['J-0003', 2, 90, 9500 + 4750],
      [null, 1, 0, 1300],
    ]);
    expect(groups.at(-1)?.key).toBe('none');
  });

  it('keeps the expense row last even when it is the biggest', () => {
    const [first] = wipItems;
    if (!first) throw new Error('no fixture');
    const groups = groupByJob([
      { ...first, job: null, value: 999999, minutes: null },
      ...wipItems.slice(2, 3),
    ]);
    expect(groups.map((group) => group.key)).toEqual([wipItems[2]?.job?.id, 'none']);
  });

  it('is empty for no items', () => {
    expect(groupByJob([])).toEqual([]);
  });
});
