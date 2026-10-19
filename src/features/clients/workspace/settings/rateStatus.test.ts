import { describe, expect, it } from 'vitest';

import type { ClientRateRead } from '../../types';
import { canEndRate, rateAudience, rateStatus } from './rateStatus';

const TODAY = '2026-06-15';
const rate = (from: string, to: string | null): ClientRateRead => ({
  id: 'r1',
  client_id: 'c1',
  user_id: null,
  user_name: null,
  hourly_rate: 9500,
  effective_from: from,
  effective_to: to,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

describe('rateStatus', () => {
  it.each([
    ['2000-01-01', null, 'current'],
    ['2026-06-15', null, 'current'],
    ['2026-06-15', '2026-06-15', 'current'],
    ['2026-01-01', '2026-06-15', 'current'],
    ['2026-01-01', '2026-06-14', 'ended'],
    ['2026-06-16', null, 'future'],
    ['2026-06-16', '2026-12-31', 'future'],
  ] as const)('a rate from %s to %s is %s', (from, to, status) => {
    expect(rateStatus(rate(from, to), TODAY)).toBe(status);
  });
});

describe('canEndRate', () => {
  it('lets a rate that has not ended be end-dated', () => {
    expect(canEndRate(rate('2000-01-01', null), TODAY)).toBe(true);
    expect(canEndRate(rate('2026-06-16', null), TODAY)).toBe(true);
    expect(canEndRate(rate('2000-01-01', '2026-06-15'), TODAY)).toBe(true);
  });

  it('does not let an ended rate be end-dated', () => {
    expect(canEndRate(rate('2000-01-01', '2026-06-14'), TODAY)).toBe(false);
  });
});

describe('rateAudience', () => {
  it('names everyone, a person or a person who has left', () => {
    expect(rateAudience({ user_id: null, user_name: null })).toBe('Everyone');
    expect(rateAudience({ user_id: 'u1', user_name: 'Grace Hopper' })).toBe('Grace Hopper');
    expect(rateAudience({ user_id: 'u1', user_name: null })).toBe('Former member');
  });
});
