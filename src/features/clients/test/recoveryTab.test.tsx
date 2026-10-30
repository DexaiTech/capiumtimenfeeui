import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';
import type { RecoveryFigures } from '@/types/recovery';

import { techwave } from './fixtures';
import { RecoveryTab } from '../workspace/tabs/RecoveryTab';
import type { ClientRecovery } from '../workspace/types';

const NAME = 'Techwave Innovations Ltd';

// The ticket's example: £1,500 fixed for 20 hours; £100 an hour is the usual task rate, the
// staff member's own rate is £80, they cost £35 (£1,050 at cost plus 50%).
const accounts: RecoveryFigures = {
  minutes: 1200,
  task_value: 200000,
  staff_value: 160000,
  cost_value: 70000,
  cost_plus_value: 105000,
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

function recovery(overrides: Partial<ClientRecovery> = {}): ClientRecovery {
  return {
    client: { id: techwave.id, code: techwave.code, name: NAME },
    jobs: [
      {
        ...accounts,
        job_id: 'j-accounts',
        number: 'J-0001',
        name: 'Annual accounts',
        status: 'completed',
        billing_basis: 'fixed',
        fixed_fee: 150000,
        hourly_rate: null,
        terms: 'Fixed fee of £1,500.00',
      },
    ],
    totals: accounts,
    markup_bp: 5000,
    show_cost: true,
    ...overrides,
  };
}

function renderTab(answer: ClientRecovery | null, permissions = OWNER_PERMISSIONS) {
  server.use(
    http.get(orgApiPath(`/clients/${techwave.id}/recovery`), () =>
      answer ? ok(answer) : fail(500, 'INTERNAL_ERROR', 'Boom'),
    ),
  );
  return renderInOrg(<RecoveryTab clientId={techwave.id} clientName={NAME} />, {
    route: `/acme/clients/${techwave.id}/recovery`,
    context: contextWith(permissions),
  });
}

describe('RecoveryTab', () => {
  it('sets the invoices against the task rate, the staff rates and cost plus', async () => {
    renderTab(recovery());

    const panel = await screen.findByRole('region', { name: 'Recovery for the client' });
    expect(panel).toHaveTextContent('Invoice value£1,500.00');
    expect(panel).toHaveTextContent('£1,500.00 invoiced, £0.00 still to bill');
    expect(panel).toHaveTextContent('At the task rate£2,000.00£500.00 left on the table');
    expect(panel).toHaveTextContent('At staff rates£1,600.00£100.00 left on the table');
    expect(panel).toHaveTextContent('Cost plus 50%£1,050.00£450.00 over');

    const table = screen.getByRole('table', { name: `Recovery by job for ${NAME}` });
    const [row] = within(table).getAllByRole('row').slice(1);
    expect(row).toHaveTextContent('J-0001');
    expect(row).toHaveTextContent('Fixed fee of £1,500.00');
    expect(row).toHaveTextContent('20:00');
    expect(row).toHaveTextContent('£500.00 left on the table');
    expect(row).toHaveTextContent('75% recovered');
    expect(within(table).getByRole('columnheader', { name: 'Cost plus 50%' })).toBeInTheDocument();
  });

  it('leaves cost plus out for someone who may not see cost', async () => {
    const hidden = {
      ...accounts,
      cost_value: null,
      cost_plus_value: null,
      cost_plus_shortfall: null,
      cost_plus_recovery_bp: null,
      margin_value: null,
      margin_bp: null,
    };
    const data = recovery({ show_cost: false, totals: hidden });
    data.jobs = data.jobs.map((job) => ({ ...job, ...hidden }));
    renderTab(data);

    const panel = await screen.findByRole('region', { name: 'Recovery for the client' });
    expect(panel).not.toHaveTextContent('Cost plus');
    const table = screen.getByRole('table', { name: `Recovery by job for ${NAME}` });
    expect(within(table).queryByRole('columnheader', { name: /Cost plus/ })).toBeNull();
  });

  it('says so when no billable work has been logged', async () => {
    renderTab(recovery({ jobs: [] }));
    expect(await screen.findByText('No billable work yet')).toBeInTheDocument();
  });

  it('says when the recovery cannot be loaded', async () => {
    renderTab(null);
    expect(await screen.findByText('Could not load the recovery')).toBeInTheDocument();
  });
});
