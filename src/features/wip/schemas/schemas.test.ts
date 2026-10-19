import { describe, expect, it } from 'vitest';

import {
  adjustmentDefaults,
  adjustmentSchema,
  positivePence,
  toAdjustmentInput,
  toTransferInput,
  toWriteOffInput,
  transferDefaults,
  transferSchema,
  writeOffSchema,
} from './wip';

const issues = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]),
  );

describe('positivePence', () => {
  it('reads pounds as typed, and refuses zero, negatives, rubbish and too much', () => {
    expect(positivePence('2,500.00')).toBe(250000);
    expect(positivePence('£12')).toBe(1200);
    expect(positivePence('0')).toBeNull();
    expect(positivePence('-5')).toBeNull();
    expect(positivePence('abc')).toBeNull();
    expect(positivePence('')).toBeNull();
    expect(positivePence('10000000000.01')).toBeNull();
    expect(positivePence('10000000000')).toBe(1_000_000_000_000);
  });
});

describe('an adjustment', () => {
  const valid = {
    ...adjustmentDefaults(),
    client_id: 'c-1',
    amount: '250.00',
    reason: 'Goodwill',
  };

  it('asks for the client, an amount above zero and a reason', () => {
    expect(adjustmentSchema.safeParse(valid).success).toBe(true);
    const found = issues(adjustmentSchema.safeParse(adjustmentDefaults()));
    expect(found.client_id).toBe('Choose the client');
    expect(found.amount).toMatch(/Enter an amount above zero/);
    expect(found.reason).toBe('Say why the WIP is adjusted');
  });

  it('refuses a reason longer than the API takes', () => {
    const found = issues(adjustmentSchema.safeParse({ ...valid, reason: 'x'.repeat(501) }));
    expect(found.reason).toBe('Use at most 500 characters');
  });

  it('sends only what was given, so the API chooses the rest', () => {
    expect(toAdjustmentInput(valid)).toEqual({
      client_id: 'c-1',
      kind: 'write_off',
      amount: 25000,
      reason: 'Goodwill',
    });
    expect(
      toAdjustmentInput({
        ...valid,
        job_id: 'j-1',
        kind: 'write_on',
        component: 'fixed_fee',
        effective_date: '2026-10-01',
      }),
    ).toEqual({
      client_id: 'c-1',
      job_id: 'j-1',
      kind: 'write_on',
      amount: 25000,
      reason: 'Goodwill',
      component: 'fixed_fee',
      effective_date: '2026-10-01',
    });
  });
});

describe('a transfer', () => {
  const valid = {
    ...transferDefaults(),
    client_id: 'c-1',
    from_job_id: 'j-1',
    to_job_id: 'j-2',
    amount: '360',
    reason: 'Wrong job',
  };

  it('asks for the client, both jobs and a reason', () => {
    const found = issues(transferSchema.safeParse(transferDefaults()));
    expect(found.client_id).toBe('Choose the client');
    expect(found.from_job_id).toBe('Choose the job the WIP leaves');
    expect(found.to_job_id).toBe('Choose the job the WIP goes to');
    expect(found.reason).toBe('Say why the WIP is moved');
  });

  it('refuses the same job on both sides', () => {
    const found = issues(transferSchema.safeParse({ ...valid, to_job_id: 'j-1' }));
    expect(found.to_job_id).toBe('Choose a different job from the one the WIP leaves');
  });

  it('needs an amount in the amount mode and items in the items mode', () => {
    expect(issues(transferSchema.safeParse({ ...valid, amount: '' })).amount).toMatch(
      /Enter an amount above zero/,
    );
    expect(
      issues(transferSchema.safeParse({ ...valid, mode: 'items', item_keys: [] })).item_keys,
    ).toBe('Choose at least one item');
    expect(transferSchema.safeParse(valid).success).toBe(true);
    expect(
      transferSchema.safeParse({ ...valid, mode: 'items', item_keys: ['time:t-1'] }).success,
    ).toBe(true);
  });

  it('sends an amount or items, never both', () => {
    expect(toTransferInput(valid, [])).toEqual({
      from_job_id: 'j-1',
      to_job_id: 'j-2',
      reason: 'Wrong job',
      amount: 36000,
    });
    const items = [{ kind: 'time' as const, id: 't-1' }];
    expect(
      toTransferInput(
        { ...valid, mode: 'items', component: 'time', effective_date: '2026-10-02' },
        items,
      ),
    ).toEqual({
      from_job_id: 'j-1',
      to_job_id: 'j-2',
      reason: 'Wrong job',
      items,
      effective_date: '2026-10-02',
    });
  });
});

describe('a write-off', () => {
  it('needs a reason, and leaves the date out when it is empty', () => {
    expect(issues(writeOffSchema.safeParse({ reason: ' ', written_off_on: '' })).reason).toBe(
      'Say why the WIP is written off',
    );
    expect(
      toWriteOffInput({ reason: 'Goodwill', written_off_on: '' }, 'c-1', [
        { time_entry_id: 't-1' },
      ]),
    ).toEqual({ client_id: 'c-1', items: [{ time_entry_id: 't-1' }], reason: 'Goodwill' });
    expect(
      toWriteOffInput({ reason: 'Goodwill', written_off_on: '2026-10-01' }, 'c-1', [])
        .written_off_on,
    ).toBe('2026-10-01');
  });
});
