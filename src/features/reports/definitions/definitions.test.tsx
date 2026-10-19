import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import AgedDebtorsReportPage from '../pages/AgedDebtorsReportPage';
import BillingReportPage from '../pages/BillingReportPage';
import ExpensesReportPage from '../pages/ExpensesReportPage';
import JobProfitabilityReportPage from '../pages/JobProfitabilityReportPage';
import MissingTimesheetsReportPage from '../pages/MissingTimesheetsReportPage';
import PaymentsReportPage from '../pages/PaymentsReportPage';
import RecoveryReportPage from '../pages/RecoveryReportPage';
import UtilisationReportPage from '../pages/UtilisationReportPage';
import WipAgeingReportPage from '../pages/WipAgeingReportPage';
import {
  agedRows,
  agedTotals,
  billingByMonth,
  billingByPartner,
  billingTotals,
  expenseTotals,
  expensesByClient,
  expensesByStatus,
  expensesByType,
  IDS,
  jobProfitRows,
  jobProfitTotals,
  jobProfitTotalsWithoutRates,
  missingRows,
  missingTotals,
  paymentsByClient,
  paymentsByMonth,
  paymentTotals,
  recoveryByJob,
  recoveryRows,
  recoveryTotals,
  utilisationRows,
  utilisationTotals,
  withoutRates,
  wipRows,
  wipTotals,
} from '../test/fixtures';
import { createBackend, reportsHandlers, type Answer, type ReportsBackend } from '../test/handlers';
import { REPORTS, renderReportPage } from '../test/render';

function setup(
  page: ReactElement,
  answers: Record<string, Answer>,
  options: { permissions?: string[]; init?: Partial<ReportsBackend> } = {},
) {
  const backend = createBackend({ reports: answers, ...options.init });
  server.use(...reportsHandlers(backend));
  renderReportPage(page, { permissions: options.permissions ?? OWNER_PERMISSIONS, route: REPORTS });
  return backend;
}

const table = async (name: string) => {
  const element = await screen.findByRole('table', { name });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);
const location = () => screen.getByTestId('location');

async function drill(user: ReturnType<typeof userEvent.setup>, row: string, item: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${row}` }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Utilisation', () => {
  const answers = () => ({ utilisation: { rows: utilisationRows(), totals: utilisationTotals() } });

  it('shows capacity, chargeable time and utilisation against the target', async () => {
    setup(<UtilisationReportPage />, answers());
    const rows = rowsOf(await table('Utilisation'));

    const figures = screen.getByLabelText('Utilisation figures');
    expect(figures).toHaveTextContent('Capacity375:00');
    expect(figures).toHaveTextContent('20 working days');
    expect(figures).toHaveTextContent('Chargeable280:00');
    expect(figures).toHaveTextContent('335:00 recorded in all');
    expect(figures).toHaveTextContent('Utilisation74.67%');
    expect(figures).toHaveTextContent('Chargeable time over capacity. Target 75%');
    expect(figures).toHaveTextContent('Against target-0.33%');

    expect(rows).toHaveLength(3);
    for (const text of [
      'Ada Lovelace',
      '150:00',
      '120:00',
      '100:00',
      '20:00',
      '66.67%',
      '75%',
      '-8.33%',
    ]) {
      expect(rows[0]).toHaveTextContent(text);
    }
    expect(rows[1]).toHaveTextContent('+11.67%');
    expect(rows[2]).toHaveTextContent('Cara Diaz');
    expect(rows[2]).toHaveTextContent('left');
  });

  it('draws utilisation against the target', async () => {
    setup(<UtilisationReportPage />, answers());
    expect(
      await screen.findByRole('heading', { name: 'Utilisation against target' }),
    ).toBeInTheDocument();
  });
});

describe('Job Profitability', () => {
  const answers = () => ({
    'job-profitability': { rows: jobProfitRows(), totals: jobProfitTotals() },
  });

  it('shows what each job logged, cost, billed and its margin', async () => {
    setup(<JobProfitabilityReportPage />, answers());
    const rows = rowsOf(await table('Job Profitability'));

    const figures = screen.getByLabelText('Job Profitability figures');
    expect(figures).toHaveTextContent('Time value£3,800.00');
    expect(figures).toHaveTextContent('40:00 logged');
    expect(figures).toHaveTextContent('Billed£2,050.00');
    expect(figures).toHaveTextContent('£2,000.00 of it time');
    expect(figures).toHaveTextContent('Written off£100.00');
    expect(figures).toHaveTextContent('Margin£800.00');
    expect(figures).toHaveTextContent('40% of the time billed');

    expect(rows).toHaveLength(2);
    for (const text of [
      'J00001 Year-end accounts',
      'Acme Ltd',
      'In progress',
      'Hourly',
      '30:00',
      '£2,850.00',
      '£900.00',
      '£2,050.00',
      '£100.00',
      '£1,100.00',
      '55%',
      '75% of hours',
    ]) {
      expect(rows[0]).toHaveTextContent(text);
    }
    for (const text of ['J00002 Audit', 'On hold', 'Fixed', '£950.00', '-£300.00', '19% of fee']) {
      expect(rows[1]).toHaveTextContent(text);
    }
  });

  it('leaves out cost and margin for someone who may not see rates', async () => {
    setup(
      <JobProfitabilityReportPage />,
      {
        'job-profitability': {
          rows: withoutRates(jobProfitRows()),
          totals: jobProfitTotalsWithoutRates(),
        },
      },
      { permissions: ['organization.read', 'report.financial'] },
    );
    const body = await table('Job Profitability');

    expect(within(body).queryByRole('columnheader', { name: /^Cost/ })).not.toBeInTheDocument();
    expect(within(body).queryByRole('columnheader', { name: /^Margin/ })).not.toBeInTheDocument();
    expect(within(body).getByRole('columnheader', { name: /^Billed/ })).toBeInTheDocument();
    const figures = screen.getByLabelText('Job Profitability figures');
    expect(figures).not.toHaveTextContent('Margin');
  });

  it('opens the job', async () => {
    const user = userEvent.setup();
    setup(<JobProfitabilityReportPage />, answers());
    await table('Job Profitability');

    await drill(user, 'J00001 Year-end accounts', 'Open the job');
    expect(location()).toHaveTextContent('/acme/jobs/j-1');
  });

  it('is for those who may see financial reports only', async () => {
    const backend = setup(<JobProfitabilityReportPage />, answers(), {
      permissions: ['organization.read', 'report.read'],
    });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.path === '/reports/job-profitability')).toHaveLength(
      0,
    );
  });
});

describe('WIP & Ageing', () => {
  const answers = () => ({ wip: { rows: wipRows(), totals: wipTotals() } });

  it('shows the unbilled work of each client and job by age', async () => {
    setup(<WipAgeingReportPage />, answers());
    const rows = rowsOf(await table('WIP & Ageing'));

    const figures = screen.getByLabelText('WIP & Ageing figures');
    expect(figures).toHaveTextContent('Work in progress£1,950.00');
    expect(figures).toHaveTextContent('25:00 of time recorded');
    expect(figures).toHaveTextContent('Time£1,900.00');
    expect(figures).toHaveTextContent('Disbursements£50.00');
    expect(figures).toHaveTextContent('Over 90 days old£50.00');
    expect(figures).toHaveTextContent('2.56% of the work in progress');

    for (const text of [
      'Acme Ltd',
      'Year-end accounts',
      'J00001',
      '£1,500.00',
      '20:00',
      '£1,550.00',
      '£800.00',
      '£500.00',
      '£200.00',
      '£50.00',
      '20/06/2026',
    ]) {
      expect(rows[0]).toHaveTextContent(text);
    }
    expect(rows[1]).toHaveTextContent('Globex plc');
    expect(rows[1]).toHaveTextContent('No job');
    expect(rows[1]).toHaveTextContent('05/10/2026');
    expect(
      await screen.findByRole('heading', { name: 'Work in progress by age' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/A past date is frozen the first time it is read/)).toBeInTheDocument();
  });

  it('opens the items of a client, and of a job', async () => {
    const user = userEvent.setup();
    setup(<WipAgeingReportPage />, answers());
    await table('WIP & Ageing');

    await drill(user, 'Acme Ltd, Year-end accounts', 'See the items');
    expect(location()).toHaveTextContent(`/acme/wip/details?client_id=${IDS.acme}&job_id=j-1`);
  });

  it('downloads a CSV file only', async () => {
    const user = userEvent.setup();
    setup(<WipAgeingReportPage />, answers());
    await table('WIP & Ageing');

    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(await screen.findByRole('button', { name: 'CSV (.csv)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excel (.xlsx)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'PDF (.pdf)' })).not.toBeInTheDocument();
  });
});

describe('Recovery', () => {
  const answers = () => ({ recoverability: { rows: recoveryRows(), totals: recoveryTotals() } });

  it('shows how much of the work done was billed', async () => {
    setup(<RecoveryReportPage />, answers());
    const rows = rowsOf(await table('Recovery'));

    const figures = screen.getByLabelText('Recovery figures');
    expect(figures).toHaveTextContent('Recovery96.72%');
    expect(figures).toHaveTextContent('Work cleared£3,050.00');
    expect(figures).toHaveTextContent('Billed£2,950.00');
    expect(figures).toHaveTextContent('Written off£100.00');
    expect(figures).toHaveTextContent('£50.00 written on or down on billing');

    for (const text of [
      'Acme Ltd',
      'ACME',
      '£2,000.00',
      '£1,950.00',
      '£50.00',
      '£100.00',
      '97.5%',
    ]) {
      expect(rows[0]).toHaveTextContent(text);
    }
    expect(rows[1]).toHaveTextContent('100%');
    expect(rows[2]).toHaveTextContent('Unassigned');
    expect(rows[2]).toHaveTextContent('0%');
  });

  it('groups by client, job or person, naming the first column after it', async () => {
    const user = userEvent.setup();
    setup(<RecoveryReportPage />, answers(), {
      init: {
        grouped: { recoverability: { job: { rows: recoveryByJob(), totals: recoveryTotals() } } },
      },
    });
    const body = await table('Recovery');
    expect(within(body).getByRole('columnheader', { name: /Client/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Group by'), 'Job');
    await waitFor(() =>
      expect(screen.getByRole('table', { name: 'Recovery' })).toHaveTextContent(
        'J00001 · Acme Ltd',
      ),
    );
    expect(
      within(screen.getByRole('table', { name: 'Recovery' })).getByRole('columnheader', {
        name: /Job/,
      }),
    ).toBeInTheDocument();
  });

  it('opens the invoices of the client for the dates on screen', async () => {
    const user = userEvent.setup();
    setup(<RecoveryReportPage />, answers());
    await table('Recovery');

    await drill(user, 'Acme Ltd', 'See the invoices');
    expect(location()).toHaveTextContent(
      `/acme/billing/invoices?client=${IDS.acme}&from=2026-01-01&to=2026-10-18`,
    );
  });
});

describe('Billing', () => {
  const answers = () => ({
    'billing-summary': { rows: billingByMonth(), totals: billingTotals() },
  });

  it('shows what was invoiced, credited and received, month by month', async () => {
    setup(<BillingReportPage />, answers());
    const rows = rowsOf(await table('Billing'));

    const figures = screen.getByLabelText('Billing figures');
    expect(figures).toHaveTextContent('Net billed£7,500.00');
    expect(figures).toHaveTextContent('Invoiced less credit notes, before VAT');
    expect(figures).toHaveTextContent('Invoiced£9,600.00');
    expect(figures).toHaveTextContent('5 invoices, including VAT');
    expect(figures).toHaveTextContent('Credited£600.00');
    expect(figures).toHaveTextContent('1 credit note');
    expect(figures).toHaveTextContent('Receipts£6,500.00');

    for (const text of [
      'Sep 2026',
      '£5,000.00',
      '£1,000.00',
      '£6,000.00',
      '£500.00',
      '£4,500.00',
      '£4,000.00',
    ]) {
      expect(rows[0]).toHaveTextContent(text);
    }
    expect(rows[1]).toHaveTextContent('Oct 2026');
    expect(rows[1]).toHaveTextContent('£3,600.00');
    expect(
      await screen.findByRole('heading', { name: 'Billed and received by month' }),
    ).toBeInTheDocument();
  });

  it('opens the invoices of a month', async () => {
    const user = userEvent.setup();
    setup(<BillingReportPage />, answers());
    await table('Billing');

    await drill(user, 'Sep 2026', 'See the invoices');
    expect(location()).toHaveTextContent('/acme/billing/invoices?from=2026-09-01&to=2026-09-30');
  });

  it('has no records to open behind a partner', async () => {
    const user = userEvent.setup();
    setup(<BillingReportPage />, answers(), {
      init: {
        grouped: {
          'billing-summary': { partner: { rows: billingByPartner(), totals: billingTotals() } },
        },
      },
    });
    await table('Billing');

    await user.selectOptions(screen.getByLabelText('Group by'), 'Partner');
    await waitFor(() =>
      expect(screen.getByRole('table', { name: 'Billing' })).toHaveTextContent('Ada Lovelace'),
    );
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
  });
});

describe('Expenses', () => {
  const answers = () => ({ expenses: { rows: expensesByType(), totals: expenseTotals() } });

  it('shows the expense lines by type', async () => {
    setup(<ExpensesReportPage />, answers());
    const rows = rowsOf(await table('Expenses'));

    const figures = screen.getByLabelText('Expenses figures');
    expect(figures).toHaveTextContent('Gross£170.00');
    expect(figures).toHaveTextContent('3 expense lines');
    expect(figures).toHaveTextContent('Net£150.00');
    expect(figures).toHaveTextContent('£20.00 VAT');
    expect(figures).toHaveTextContent('To recharge clients£50.00');
    expect(figures).toHaveTextContent('£0.00 already invoiced');
    expect(figures).toHaveTextContent('To reimburse£170.00');

    for (const text of ['Mileage', 'MILEAGE', '£50.00']) expect(rows[0]).toHaveTextContent(text);
    for (const text of ['Travel', '£100.00', '£20.00', '£120.00']) {
      expect(rows[1]).toHaveTextContent(text);
    }
    expect(
      await screen.findByRole('heading', { name: 'Expenses by expense type' }),
    ).toBeInTheDocument();
  });

  it('is open to those who may read reports, and to those who may see the financial ones', async () => {
    setup(<ExpensesReportPage />, answers(), { permissions: ['organization.read', 'report.read'] });
    expect(rowsOf(await table('Expenses'))).toHaveLength(2);
  });

  it('names the claim status in words', async () => {
    const user = userEvent.setup();
    setup(<ExpensesReportPage />, answers(), {
      init: {
        grouped: { expenses: { status: { rows: expensesByStatus(), totals: expenseTotals() } } },
      },
    });
    await table('Expenses');

    await user.selectOptions(screen.getByLabelText('Group by'), 'Claim status');
    await waitFor(() =>
      expect(screen.getByRole('table', { name: 'Expenses' })).toHaveTextContent('Submitted'),
    );
    expect(
      within(screen.getByRole('table', { name: 'Expenses' })).getByRole('columnheader', {
        name: /Claim status/,
      }),
    ).toBeInTheDocument();
  });

  it('opens the claims of a client, and has none to open behind a row without one', async () => {
    const user = userEvent.setup();
    setup(<ExpensesReportPage />, answers(), {
      init: {
        grouped: { expenses: { client: { rows: expensesByClient(), totals: expenseTotals() } } },
      },
    });
    await table('Expenses');

    await user.selectOptions(screen.getByLabelText('Group by'), 'Client');
    await waitFor(() =>
      expect(screen.getByRole('table', { name: 'Expenses' })).toHaveTextContent('No client'),
    );
    expect(screen.getAllByRole('button', { name: /^Actions for/ })).toHaveLength(1);

    await drill(user, 'Acme Ltd', 'See the claims');
    expect(location()).toHaveTextContent(
      `/acme/expenses?client_id=${IDS.acme}&date_from=2026-01-01&date_to=2026-10-18`,
    );
  });
});

describe('Aged Debtors', () => {
  const answers = () => ({ 'aged-debtors': { rows: agedRows(), totals: agedTotals() } });

  it('shows what each client owes by how late it is', async () => {
    setup(<AgedDebtorsReportPage />, answers());
    const rows = rowsOf(await table('Aged Debtors'));

    const figures = screen.getByLabelText('Aged Debtors figures');
    expect(figures).toHaveTextContent('Total owed£1,900.00');
    expect(figures).toHaveTextContent('3 invoices');
    expect(figures).toHaveTextContent('Overdue£900.00');
    expect(figures).toHaveTextContent('47.37% of what is owed');
    expect(figures).toHaveTextContent('Not yet due£1,000.00');
    expect(figures).toHaveTextContent('Over 90 days overdue£400.00');
    expect(figures).toHaveTextContent('21.05% of what is owed');

    for (const text of ['Acme Ltd', 'ACME', '£1,000.00', '£500.00', '£1,500.00', '20/09/2026']) {
      expect(rows[0]).toHaveTextContent(text);
    }
    expect(rows[1]).toHaveTextContent('Globex plc');
    expect(rows[1]).toHaveTextContent('£400.00');
    expect(rows[1]).toHaveTextContent('30/06/2026');
    expect(
      await screen.findByRole('heading', { name: 'What is owed, by how late it is' }),
    ).toBeInTheDocument();
  });

  it('opens the debtor', async () => {
    const user = userEvent.setup();
    setup(<AgedDebtorsReportPage />, answers());
    await table('Aged Debtors');

    await drill(user, 'Acme Ltd', 'See the debtor');
    expect(location()).toHaveTextContent(`/acme/billing/debtors?client=${IDS.acme}`);
  });
});

describe('Payments', () => {
  const answers = () => ({ payments: { rows: paymentsByMonth(), totals: paymentTotals() } });

  it('shows what was received, what is allocated and what is on account', async () => {
    setup(<PaymentsReportPage />, answers());
    const rows = rowsOf(await table('Payments'));

    const figures = screen.getByLabelText('Payments figures');
    expect(figures).toHaveTextContent('Received£5,500.00');
    expect(figures).toHaveTextContent('5 payments');
    expect(figures).toHaveTextContent('Allocated£5,000.00');
    expect(figures).toHaveTextContent('To invoices');
    expect(figures).toHaveTextContent('On account£500.00');
    expect(figures).toHaveTextContent('Received, not allocated');
    expect(figures).toHaveTextContent('Voided or reversed£200.00');
    expect(figures).toHaveTextContent('1 payment');

    for (const text of ['Sep 2026', '£3,000.00']) expect(rows[0]).toHaveTextContent(text);
    for (const text of ['Oct 2026', '£2,500.00', '£2,000.00', '£500.00', '£200.00', '1 payment']) {
      expect(rows[1]).toHaveTextContent(text);
    }
    expect(await screen.findByRole('heading', { name: 'Received by month' })).toBeInTheDocument();
  });

  it('opens the payments of a month', async () => {
    const user = userEvent.setup();
    setup(<PaymentsReportPage />, answers());
    await table('Payments');

    await drill(user, 'Sep 2026', 'See the payments');
    expect(location()).toHaveTextContent('/acme/billing/payments?from=2026-09-01&to=2026-09-30');
  });

  it('opens the payments of a client for the dates on screen, and draws no chart by client', async () => {
    const user = userEvent.setup();
    setup(<PaymentsReportPage />, answers(), {
      init: {
        grouped: { payments: { client: { rows: paymentsByClient(), totals: paymentTotals() } } },
      },
    });
    await table('Payments');

    await user.selectOptions(screen.getByLabelText('Group by'), 'Client');
    await waitFor(() =>
      expect(screen.getByRole('table', { name: 'Payments' })).toHaveTextContent('Acme Ltd'),
    );
    expect(screen.queryByRole('heading', { name: 'Received by month' })).not.toBeInTheDocument();

    await drill(user, 'Acme Ltd', 'See the payments');
    expect(location()).toHaveTextContent(
      `/acme/billing/payments?client=${IDS.acme}&from=2026-01-01&to=2026-10-18`,
    );
  });
});

describe('Missing Timesheets', () => {
  const answers = () => ({
    'missing-timesheets': { rows: missingRows(), totals: missingTotals() },
  });

  it('shows who has not submitted a timesheet, and what they logged against what was expected', async () => {
    setup(<MissingTimesheetsReportPage />, answers());
    const rows = rowsOf(await table('Missing Timesheets'));

    const figures = screen.getByLabelText('Missing Timesheets figures');
    expect(figures).toHaveTextContent('Timesheets missing2');
    expect(figures).toHaveTextContent('2 people, 1 week');
    expect(figures).toHaveTextContent('Nothing started1');
    expect(figures).toHaveTextContent('1 open, 0 returned');
    expect(figures).toHaveTextContent('Short by39:00');
    expect(figures).toHaveTextContent('36:00 logged of 75:00');
    expect(figures).toHaveTextContent('Days with nothing5');

    for (const text of [
      'Ben Carter',
      'Week of 12/10/2026',
      'Open, not submitted',
      '36:00',
      '37:30',
      '1:30',
      'Never',
    ]) {
      expect(rows[0]).toHaveTextContent(text);
    }
    for (const text of [
      'Cara Diaz',
      'No login',
      'Nothing started',
      '0:00',
      '37:30',
      '14/10/2026',
    ]) {
      expect(rows[1]).toHaveTextContent(text);
    }
  });

  it('opens the time entries of the week', async () => {
    const user = userEvent.setup();
    setup(<MissingTimesheetsReportPage />, answers(), {
      permissions: ['organization.read', 'report.read'],
    });
    await table('Missing Timesheets');

    await drill(user, 'Ben Carter, Week of 12/10/2026', 'See the time entries');
    expect(location()).toHaveTextContent(
      `/acme/time/entries?person=${IDS.ben}&from=2026-10-12&to=2026-10-18`,
    );
  });

  it('says so when everyone has submitted', async () => {
    setup(<MissingTimesheetsReportPage />, {
      'missing-timesheets': { rows: [], totals: { ...missingTotals(), timesheets: 0 } },
    });
    expect(await screen.findByText('No missing timesheets')).toBeInTheDocument();
    expect(
      screen.getByText('Everyone has submitted a timesheet for the weeks chosen.'),
    ).toBeInTheDocument();
  });
});
