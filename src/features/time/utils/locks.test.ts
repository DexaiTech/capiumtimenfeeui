import { describe, expect, it } from 'vitest';

import { entry } from '../test/fixtures';
import { entryLockReason, isEntryLocked } from './locks';

const base = { entry_date: '2026-10-12', minutes: 60 };

describe('locks', () => {
  it('treats open, unbilled time outside a locked period as changeable', () => {
    const open = entry(base);
    expect(isEntryLocked(open)).toBe(false);
    expect(entryLockReason(open)).toBeNull();
  });

  it('names the reason, billing first, then the period, then the sheet', () => {
    expect(entryLockReason(entry({ ...base, status: 'submitted' }))).toBe(
      'the timesheet is submitted',
    );
    expect(entryLockReason(entry({ ...base, status: 'approved' }))).toBe('approved time is locked');
    expect(entryLockReason(entry({ ...base, status: 'approved' }), true)).toBe(
      'revoke approval first',
    );
    // Revoking the approval would not unlock the period, so the period is named.
    const locked = { period_locked_through: '2026-10-31' };
    expect(isEntryLocked({ ...entry(base), ...locked })).toBe(true);
    expect(entryLockReason({ ...entry({ ...base, status: 'approved' }), ...locked }, true)).toBe(
      'the period is locked through 31/10/2026',
    );
    expect(entryLockReason(entry({ ...base, billing_status: 'billed' }))).toBe(
      'billed time is locked',
    );
    expect(entryLockReason(entry({ ...base, billing_status: 'in_draft' }))).toBe(
      'it is on a draft invoice',
    );
    expect(entryLockReason(entry({ ...base, billing_status: 'written_off' }))).toBe(
      'it is written off',
    );
  });
});
