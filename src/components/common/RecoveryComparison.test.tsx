import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { compareRecovery } from '@/utils/recovery';

import { RecoveryComparison } from './RecoveryComparison';

// The ticket's example: £1,500 fixed for 20 hours, £100 an hour task rate (the recovery rate),
// £80 staff rate.
const lines = compareRecovery(
  {
    minutes: 1200,
    recovery_value: 200000,
    client_job_minutes: 0,
    task_minutes: 1200,
    staff_rate_minutes: 0,
    staff_value: 160000,
    cost_value: 70000,
    cost_plus_value: 105000,
    markup_bp: 5000,
  },
  150000,
);

describe('RecoveryComparison', () => {
  it('sets the invoice value against each basis with what is left on the table', () => {
    render(
      <RecoveryComparison
        title="Recovery"
        invoiceLabel="Invoice value"
        invoiceValue={150000}
        invoiceHint="£1,500.00 invoiced"
        lines={lines}
        currency="GBP"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Recovery' });
    expect(panel).toHaveTextContent('Invoice value£1,500.00£1,500.00 invoiced');
    expect(panel).toHaveTextContent(
      'Potential recovery£2,000.00£500.00 left on the table75% recovered',
    );
    expect(panel).toHaveTextContent(
      'At staff rates£1,600.00£100.00 left on the table93.75% recovered',
    );
    expect(panel).toHaveTextContent('Cost plus 50%£1,050.00£450.00 over142.86% recovered');
    expect(screen.getByText('£500.00 left on the table')).toHaveClass('text-danger');
    expect(screen.getByText('£450.00 over')).toHaveClass('text-success');
  });
});
