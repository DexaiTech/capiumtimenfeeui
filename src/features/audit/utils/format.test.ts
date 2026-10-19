import { describe, expect, it } from 'vitest';

import { recordTypeLabel } from '../constants';
import { formatChangeValue, humanizeField, subjectOf } from './format';

describe('humanizeField', () => {
  it('turns a field name into words', () => {
    expect(humanizeField('effective_from')).toBe('Effective from');
    expect(humanizeField('rate')).toBe('Rate');
    expect(humanizeField('changes.locked_through')).toBe('Changes locked through');
    expect(humanizeField('')).toBe('');
  });
});

describe('formatChangeValue', () => {
  const zone = 'Europe/London';

  it('says nothing for a value that is not there', () => {
    expect(formatChangeValue(null, zone)).toBeNull();
    expect(formatChangeValue(undefined, zone)).toBeNull();
    expect(formatChangeValue('', zone)).toBeNull();
    expect(formatChangeValue([], zone)).toBeNull();
  });

  it('writes plain values as they are', () => {
    expect(formatChangeValue('Acme Group', zone)).toBe('Acme Group');
    expect(formatChangeValue(9500, zone)).toBe('9500');
    expect(formatChangeValue(0, zone)).toBe('0');
    expect(formatChangeValue(true, zone)).toBe('Yes');
    expect(formatChangeValue(false, zone)).toBe('No');
  });

  it('uses UK formats for dates and timestamps', () => {
    expect(formatChangeValue('2026-03-31', zone)).toBe('31/03/2026');
    // BST in October: UTC 09:14 is 10:14 in London.
    expect(formatChangeValue('2026-10-05T09:14:07Z', zone)).toBe('05/10/2026 10:14');
    expect(formatChangeValue('2026-10-05T09:14:07Z', 'UTC')).toBe('05/10/2026 09:14');
  });

  it('lists simple arrays and writes anything else as JSON text', () => {
    expect(formatChangeValue(['a', 'b'], zone)).toBe('a, b');
    expect(formatChangeValue([1, 2], zone)).toBe('1, 2');
    expect(formatChangeValue({ role_id: 'r1' }, zone)).toBe('{"role_id":"r1"}');
    expect(formatChangeValue([{ id: 1 }], zone)).toBe('[{"id":1}]');
  });
});

describe('subjectOf', () => {
  it('cuts the label off the front of the summary', () => {
    expect(
      subjectOf({
        label: 'Invoice issued',
        summary: 'Invoice issued: INV-00012 (Babbage Ltd)',
      }),
    ).toBe('INV-00012 (Babbage Ltd)');
    expect(
      subjectOf({ label: 'Payment recorded', summary: 'Payment recorded (Babbage Ltd)' }),
    ).toBe('(Babbage Ltd)');
  });

  it('is empty when the summary is only the label, and whole when it does not start with it', () => {
    expect(subjectOf({ label: 'Signed in', summary: 'Signed in' })).toBe('');
    expect(subjectOf({ label: 'Signed in', summary: 'Something else' })).toBe('Something else');
  });
});

describe('recordTypeLabel', () => {
  it('names the types the application writes and makes up a name for the rest', () => {
    expect(recordTypeLabel('time_entry')).toBe('Time entry');
    expect(recordTypeLabel('wip_write_off')).toBe('WIP write-off');
    expect(recordTypeLabel('widget_part')).toBe('Widget part');
  });
});
