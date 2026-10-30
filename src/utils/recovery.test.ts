import { describe, expect, it } from 'vitest';

import type { RecoveryFigures } from '@/types';

import {
  compareRecovery,
  describeRecovery,
  describeShortfall,
  recoveryBasisPoints,
  recoveryLines,
} from './recovery';

// The ticket's example: a £1,500 fixed fee for 20 hours; £100 an hour is the usual task rate, the
// staff member's own rate is £80 and they cost £35 (£1,050 at cost plus 50%).
const potentials = {
  minutes: 1200,
  task_value: 200000,
  staff_value: 160000,
  cost_value: 70000,
  cost_plus_value: 105000,
};

describe('compareRecovery', () => {
  it('says how much each basis leaves on the table against the invoice', () => {
    const lines = compareRecovery(potentials, 150000, 5000);
    expect(
      lines.map((line) => [line.label, line.potential, line.shortfall, line.recoveryBp]),
    ).toEqual([
      ['At the task rate', 200000, 50000, 7500],
      ['At staff rates', 160000, 10000, 9375],
      ['Cost plus 50%', 105000, -45000, 14286],
    ]);
  });

  it('leaves cost plus out when cost is hidden', () => {
    const hidden = { ...potentials, cost_value: null, cost_plus_value: null };
    const lines = compareRecovery(hidden, 0, 5000);
    expect(lines.map((line) => line.basis)).toEqual(['task', 'staff']);
    expect(lines[0]?.recoveryBp).toBe(0);
  });

  it('values two people at their own rates as the API does: £500 + £1,500', () => {
    const twoPeople = { ...potentials, staff_value: 50000 + 150000 };
    const [, staff] = compareRecovery(twoPeople, 150000, 5000);
    expect(staff?.potential).toBe(200000);
    expect(staff?.shortfall).toBe(50000);
  });
});

describe('recoveryLines', () => {
  it('takes the shortfalls and the recovery the API worked out', () => {
    const figures: RecoveryFigures = {
      ...potentials,
      invoiced_value: 150000,
      to_bill_value: 0,
      invoice_value: 150000,
      task_shortfall: 50000,
      task_recovery_bp: 7500,
      staff_shortfall: 10000,
      staff_recovery_bp: 9375,
      cost_plus_shortfall: -45000,
      cost_plus_recovery_bp: 14286,
      margin_value: 80000,
      margin_bp: 5333,
    };
    const lines = recoveryLines(figures, 5000);
    expect(lines).toHaveLength(3);
    expect(lines[2]).toMatchObject({
      label: 'Cost plus 50%',
      potential: 105000,
      shortfall: -45000,
    });
  });
});

describe('the words', () => {
  it('name what was left on the table, or the over-recovery', () => {
    expect(describeShortfall(50000, 'GBP')).toBe('£500.00 left on the table');
    expect(describeShortfall(-45000, 'GBP')).toBe('£450.00 over');
    expect(describeShortfall(0, 'GBP')).toBe('Matches the invoice');
    expect(describeRecovery(7500)).toBe('75% recovered');
    expect(describeRecovery(null)).toBeNull();
  });

  it('round the recovery half away from zero, as the API does', () => {
    expect(recoveryBasisPoints(1, 3)).toBe(3333);
    expect(recoveryBasisPoints(2, 3)).toBe(6667);
    expect(recoveryBasisPoints(-1, 8)).toBe(-1250);
    expect(recoveryBasisPoints(5, 0)).toBeNull();
  });
});
