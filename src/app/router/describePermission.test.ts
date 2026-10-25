import { describe, expect, it } from 'vitest';

import { describePermission } from './describePermission';

describe('describePermission', () => {
  it('puts a permission code in words', () => {
    expect(describePermission('timesheet.approve')).toBe('Approve timesheet');
    expect(describePermission('client.read')).toBe('View client');
    expect(describePermission('time.log')).toBe('Record time');
    expect(describePermission('credit_note.create')).toBe('Add credit note');
  });

  it('falls back to the code’s own words for an action it does not know', () => {
    expect(describePermission('wip.write_off')).toBe('wip: write off');
  });
});
