import { findRowAction } from '@/test/rowActions';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { http } from 'msw';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';
import type { Organization } from '@/types/organization';

import { harbour } from '../test/fixtures';
import {
  createPrepareBackend,
  harbourSummary,
  jobBilling,
  postsOf,
  prepareHandlers,
  timeItem,
  wipOf,
  type PrepareBackend,
} from '../test/prepare';
import { BILLING, renderBillingPage } from '../test/render';
import type { JobBilling } from '../types';
import PrepareInvoicePage from './PrepareInvoicePage';

const PREPARE = `${BILLING}/prepare`;
const NO_ISSUE = OWNER_PERMISSIONS.filter((permission) => permission !== 'invoice.issue');

function setup(
  init: Partial<PrepareBackend> = {},
  options: { permissions?: string[]; organization?: Partial<Organization>; route?: string } = {},
) {
  const backend = createPrepareBackend(init);
  server.use(...prepareHandlers(backend));
  renderBillingPage(<PrepareInvoicePage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    organization: options.organization,
    route: options.route ?? `${PREPARE}?client=${harbour.id}`,
    path: PREPARE,
  });
  return backend;
}

const work = async () => {
  const element = await screen.findByRole('table', { name: 'Work in progress of Harbour & Co' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);
const rowOf = (element: HTMLElement, name: RegExp) => within(element).getByRole('row', { name });

async function choose(user: ReturnType<typeof userEvent.setup>, ...names: RegExp[]) {
  const table = await work();
  for (const name of names) {
    await user.click(within(rowOf(table, name)).getByRole('checkbox'));
  }
}

async function review(user: ReturnType<typeof userEvent.setup>, ...names: RegExp[]) {
  await choose(user, ...names);
  await user.click(screen.getByRole('button', { name: 'Review the lines' }));
  return screen.findByRole('table', { name: 'Lines of the invoice' });
}

async function toDetails(user: ReturnType<typeof userEvent.setup>, ...names: RegExp[]) {
  await review(user, ...names);
  await user.click(screen.getByRole('button', { name: 'Dates and notes' }));
  return screen.findByRole('form', { name: 'Invoice details' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('choosing the client', () => {
  it('asks for a client first', async () => {
    setup({}, { route: PREPARE });
    expect(await screen.findByText('Choose a client')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Steps' })).not.toBeInTheDocument();
  });

  it('opens the work of the client chosen in the picker', async () => {
    const user = userEvent.setup();
    setup({}, { route: PREPARE });

    await user.type(await screen.findByRole('combobox', { name: 'Client' }), 'Harb');
    await user.click(await screen.findByRole('option', { name: /Harbour & Co/ }));

    expect(await work()).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(`client=${harbour.id}`);
  });

  it('refuses a person who cannot prepare invoices', async () => {
    setup({}, { permissions: ['organization.read', 'client.read', 'wip.read', 'invoice.read'] });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('the work to bill', () => {
  it('lists the time, the disbursement and the fixed fee, and sets aside what cannot be billed', async () => {
    const backend = setup();
    const table = await work();

    const rows = rowsOf(table);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent('31/08/2026');
    expect(rows[0]).toHaveTextContent('Fixed fee');
    expect(rows[0]).toHaveTextContent('Partnership accounts');
    expect(rows[0]).toHaveTextContent('Fee £2,400.00, £400.00 billed so far');
    expect(rows[0]).toHaveTextContent('£2,000.00');
    expect(rows[1]).toHaveTextContent('Bookkeeping 2026/27');
    expect(rows[1]).toHaveTextContent('Bank reconciliation');
    expect(rows[1]).toHaveTextContent('Grace Hopper');
    expect(rows[1]).toHaveTextContent('1.50');
    expect(rows[1]).toHaveTextContent('£180.00');
    expect(rows[3]).toHaveTextContent('Disbursement');
    expect(rows[3]).toHaveTextContent('Filing fee · Companies House');
    // The time behind a recognised fixed fee is billed through the fee.
    expect(within(table).queryByText('Draft accounts')).not.toBeInTheDocument();

    expect(screen.getByText(/Harbour & Co has £/)).toHaveTextContent(
      'Harbour & Co has £2,665.40 of work in progress: 10.00 hours of time (£600.00) and £34.00 of disbursements.',
    );
    expect(
      screen.getByText('1 item in work in progress cannot be invoiced yet'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Train to Bath (Expense claim lines cannot be invoiced yet)'),
    ).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')).toHaveLength(0);
  });

  it('narrows to one job and keeps what was chosen out of sight', async () => {
    const user = userEvent.setup();
    setup();
    const table = await work();
    await user.click(within(rowOf(table, /Bank reconciliation/)).getByRole('checkbox'));

    await user.selectOptions(screen.getByLabelText('Job'), 'VAT returns 2026/27');
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: /Work in progress/ }))).toHaveLength(1),
    );
    expect(screen.getByText('1 item chosen, £180.00 of work in progress.')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Select VAT returns 2026\/27/ }));
    expect(screen.getByText('2 items chosen, £240.00 of work in progress.')).toBeInTheDocument();
  });

  it('adds up what is chosen and offers the review only once something is', async () => {
    const user = userEvent.setup();
    setup();
    await work();
    expect(screen.getByText('Nothing chosen yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review the lines' })).toBeDisabled();

    await choose(user, /Bank reconciliation/, /Payroll queries/);
    expect(screen.getByText('2 items chosen, £300.00 of work in progress.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review the lines' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Clear choice' }));
    expect(screen.getByText('Nothing chosen yet.')).toBeInTheDocument();
  });

  it('warns that time on a fixed-fee job bills the fee', async () => {
    const user = userEvent.setup();
    setup({
      wip: {
        [harbour.id]: wipOf([
          timeItem({
            id: 't-9',
            job: { id: 'j-fix', number: 'J00009', name: 'Annual accounts', billing_basis: 'fixed' },
            component: 'fixed_fee',
            description: 'Trial balance',
          }),
        ]),
      },
    });
    const table = await work();
    expect(within(table).getByText('Fixed-fee time')).toBeInTheDocument();

    await user.click(within(rowOf(table, /Trial balance/)).getByRole('checkbox'));
    expect(
      screen.getByText(/bills the job's fixed fee less what is already billed/),
    ).toBeInTheDocument();
  });

  it('says when the client has nothing to bill', async () => {
    setup({ wip: { [harbour.id]: wipOf([]) } });
    expect(await screen.findByText('Nothing to bill')).toBeInTheDocument();
  });

  it('explains a failed load and tries again', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /clients/wip': { status: 500, code: 'INTERNAL_ERROR', message: 'Boom.' } },
    });
    expect(await screen.findByText('Could not load the work in progress')).toBeInTheDocument();

    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await work()).toBeInTheDocument();
  });
});

describe('reviewing the lines', () => {
  it('drafts one line per job with the hours, the work in progress and an estimate of VAT', async () => {
    const user = userEvent.setup();
    setup();
    const lines = await review(user, /Bank reconciliation/, /Payroll queries/);

    expect(screen.getByRole('list', { name: 'Steps' })).toBeInTheDocument();
    const rows = rowsOf(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Bookkeeping 2026/27 (7 Sep 2026 to 8 Sep 2026)');
    expect(rows[0]).toHaveTextContent('2.50');
    expect(rows[0]).toHaveTextContent('£300.00');
    expect(rows[0]).toHaveTextContent('20%');

    const totals = screen.getByLabelText('Invoice totals');
    expect(totals).toHaveTextContent('Net£300.00');
    expect(totals).toHaveTextContent('VAT (estimate)£60.00');
    expect(totals).toHaveTextContent('Total£360.00');
    expect(totals).toHaveTextContent('Work in progress cleared£300.00');
    expect(totals).toHaveTextContent('Written on or off£0.00');
  });

  it('groups the time another way', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/, /Payroll queries/);

    await user.selectOptions(screen.getByLabelText('Group the time'), 'One line per time entry');
    const rows = rowsOf(screen.getByRole('table', { name: 'Lines of the invoice' }));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('7 Sep 2026: Bank reconciliation');
    expect(rows[1]).toHaveTextContent('8 Sep 2026: Payroll queries');

    await user.selectOptions(screen.getByLabelText('Group the time'), 'One line for all time');
    expect(rowsOf(screen.getByRole('table', { name: 'Lines of the invoice' }))).toHaveLength(1);
  });

  it('puts a disbursement on a line of its own', async () => {
    const user = userEvent.setup();
    setup();
    const lines = await review(user, /Bank reconciliation/, /Filing fee/);
    const rows = rowsOf(lines);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent('Filing fee (Companies House)');
    expect(rows[1]).toHaveTextContent('£34.00');
    expect(screen.getByLabelText('Invoice totals')).toHaveTextContent('Net£214.00');
  });

  it('prices a fixed fee as the fee less what is billed already', async () => {
    const user = userEvent.setup();
    setup();
    const lines = await review(user, /Partnership accounts/);

    const rows = rowsOf(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Partnership accounts (fixed fee)');
    expect(rows[0]).toHaveTextContent('£2,000.00');
    expect(screen.getByLabelText('Invoice totals')).toHaveTextContent('Net£2,000.00');
    expect(screen.queryByText(/priced when the draft is made/)).not.toBeInTheDocument();
  });

  it('writes work off when a line bills less than it is worth, and undoes the change', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/, /Payroll queries/);

    await user.click(
      await findRowAction(
        'Actions for Bookkeeping 2026/27 (7 Sep 2026 to 8 Sep 2026)',
        'Edit the line',
      ),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit the line' });
    const amount = within(dialog).getByLabelText('Amount to bill (£)');
    await user.clear(amount);
    await user.type(amount, '250');
    await user.click(within(dialog).getByRole('button', { name: 'Save line' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Invoice totals')).toHaveTextContent('Written off£50.00'),
    );
    const row = rowsOf(screen.getByRole('table', { name: 'Lines of the invoice' }))[0];
    expect(row).toHaveTextContent('£250.00');
    expect(row).toHaveTextContent('-£50.00');
    expect(screen.getByLabelText('Invoice totals')).toHaveTextContent('Net£250.00');

    await user.click(
      await findRowAction(
        'Actions for Bookkeeping 2026/27 (7 Sep 2026 to 8 Sep 2026)',
        'Undo the changes',
      ),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Invoice totals')).toHaveTextContent('Net£300.00'),
    );
  });

  it('changes the wording and the VAT code of a line', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/);

    await user.click(await findRowAction(/^Actions for Bookkeeping 2026\/27/, 'Edit the line'));
    const dialog = await screen.findByRole('dialog', { name: 'Edit the line' });
    const description = within(dialog).getByLabelText('Description');
    await user.clear(description);
    await user.type(description, 'Quarterly bookkeeping');
    await user.selectOptions(within(dialog).getByLabelText('VAT code'), 'Zero (0%)');
    await user.click(within(dialog).getByRole('button', { name: 'Save line' }));

    const row = rowsOf(await screen.findByRole('table', { name: 'Lines of the invoice' }))[0];
    await waitFor(() => expect(row).toHaveTextContent('Quarterly bookkeeping'));
    expect(row).toHaveTextContent('0%');
    expect(screen.getByLabelText('Invoice totals')).toHaveTextContent('VAT (estimate)£0.00');
  });

  it('refuses an amount that is not money', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/);

    await user.click(await findRowAction(/^Actions for Bookkeeping 2026\/27/, 'Edit the line'));
    const dialog = await screen.findByRole('dialog', { name: 'Edit the line' });
    const amount = within(dialog).getByLabelText('Amount to bill (£)');
    await user.clear(amount);
    await user.type(amount, 'lots');
    await user.click(within(dialog).getByRole('button', { name: 'Save line' }));

    expect(
      await within(dialog).findByText('Enter the amount to bill, such as 120.00 (0 or more)'),
    ).toBeInTheDocument();
  });

  it('goes back to the work with the choice kept', async () => {
    const user = userEvent.setup();
    setup();
    await review(user, /Bank reconciliation/);

    await user.click(screen.getByRole('button', { name: 'Back to the work' }));
    await work();
    expect(screen.getByText('1 item chosen, £180.00 of work in progress.')).toBeInTheDocument();
  });
});

describe('making the draft', () => {
  it('saves a draft with the work chosen, the dates from the client\u2019s terms and the notes', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const form = await toDetails(user, /Bank reconciliation/, /Payroll queries/);

    expect(within(form).getByLabelText('Issue date')).toHaveValue('2026-10-18');
    expect(within(form).getByLabelText('Due date')).toHaveValue('2026-11-17');
    await user.type(within(form).getByLabelText('Reference'), 'PO-1234');
    await user.type(within(form).getByLabelText('Notes'), 'Thank you.');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('Draft invoice saved')).toBeInTheDocument();
    expect(screen.getByText('£360.00 to Harbour & Co')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')[0]?.body).toEqual({
      client_id: harbour.id,
      time_entry_ids: ['t-1', 't-2'],
      disbursement_ids: [],
      group_by: 'job',
      overrides: [],
      valuation_basis: 'contract',
      issue_date: '2026-10-18',
      due_date: '2026-11-17',
      reference: 'PO-1234',
      notes: 'Thank you.',
    });
    expect(postsOf(backend, '/invoices/inv-new-1/issue')).toHaveLength(0);
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/acme/billing/invoices/inv-new-1',
    );
  });

  it('sends only what the person changed as overrides, and the grouping chosen', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await review(user, /Bank reconciliation/, /Payroll queries/, /Filing fee/);
    await user.selectOptions(screen.getByLabelText('Group the time'), 'One line per time entry');

    await user.click(
      await findRowAction('Actions for 7 Sep 2026: Bank reconciliation', 'Edit the line'),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit the line' });
    const amount = within(dialog).getByLabelText('Amount to bill (£)');
    await user.clear(amount);
    await user.type(amount, '150.00');
    await user.click(within(dialog).getByRole('button', { name: 'Save line' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Invoice totals')).toHaveTextContent('Written off£30.00'),
    );

    await user.click(screen.getByRole('button', { name: 'Dates and notes' }));
    await user.click(await screen.findByRole('button', { name: 'Save as draft' }));
    await screen.findByText('Draft invoice saved');
    expect(postsOf(backend, '/invoices')[0]?.body).toMatchObject({
      time_entry_ids: ['t-1', 't-2'],
      disbursement_ids: ['d-1'],
      group_by: 'entry',
      overrides: [{ time_entry_id: 't-1', net_amount: 15000 }],
    });
  });

  it('bills a fixed fee through the time entries of its job', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await toDetails(user, /Partnership accounts/);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    await screen.findByText('Draft invoice saved');
    expect(postsOf(backend, '/invoices')[0]?.body).toMatchObject({
      time_entry_ids: ['t-5', 't-6'],
      disbursement_ids: [],
      overrides: [],
    });
  });

  it('issues the invoice straight away when the person can issue', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await toDetails(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Save and issue' }));

    expect(await screen.findByText('Invoice INV-00099 issued')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')).toHaveLength(1);
    expect(postsOf(backend, '/invoices/inv-new-1/issue')[0]?.body).toEqual({
      issue_date: '2026-10-18',
      due_date: '2026-11-17',
    });
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/acme/billing/invoices/inv-new-1',
    );
  });

  it('emails the issued invoice too when the box is ticked', async () => {
    const user = userEvent.setup();
    const sent: string[] = [];
    const backend = setup();
    server.use(
      http.post(orgApiPath('/invoices/:invoiceId/send'), ({ params }) => {
        sent.push(String(params.invoiceId));
        return ok({
          invoice_id: String(params.invoiceId),
          to: ['a@harbour.example'],
          queued: true,
        });
      }),
    );
    await toDetails(user, /Bank reconciliation/);
    // The client has no invoice email, so the box starts empty.
    const box = screen.getByRole('checkbox', { name: /Email it to the client/ });
    expect(box).not.toBeChecked();
    await user.click(box);
    await user.click(screen.getByRole('button', { name: 'Save, issue and send' }));

    expect(await screen.findByText('Invoice email queued')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices/inv-new-1/issue')).toHaveLength(1);
    expect(sent).toEqual(['inv-new-1']);
  });

  it('sends the draft for approval when the practice approves invoices first', async () => {
    const user = userEvent.setup();
    const backend = setup(
      {},
      { organization: { invoice_approval_required: true, invoice_approval_threshold: 0 } },
    );
    await toDetails(user, /Bank reconciliation/);

    expect(screen.queryByRole('button', { name: 'Save and issue' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/approves invoices before they are issued: the draft is sent for approval/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save and send for approval' }));

    expect(await screen.findByText('Draft sent for approval')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices/inv-new-1/submit')).toHaveLength(1);
    expect(postsOf(backend, '/invoices/inv-new-1/issue')).toHaveLength(0);
  });

  it('offers only the draft to a person who cannot issue', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: NO_ISSUE });
    await toDetails(user, /Bank reconciliation/);

    expect(screen.getByRole('button', { name: 'Save as draft' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save and issue' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save and send for approval' }),
    ).not.toBeInTheDocument();
  });

  it('refuses a due date before the issue date and sends nothing', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const form = await toDetails(user, /Bank reconciliation/);

    fireEvent.change(within(form).getByLabelText('Due date'), { target: { value: '2026-10-01' } });
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(
      await within(form).findByText('The due date cannot be before the issue date'),
    ).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')).toHaveLength(0);
  });

  it('shows what the API refuses and stays on the step', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: {
        'POST /invoices': {
          status: 409,
          code: 'WIP_NOT_AVAILABLE',
          message: 'Some of the work has been billed since you opened this page.',
        },
      },
    });
    await toDetails(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(
      await screen.findByText('Some of the work has been billed since you opened this page.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Invoice details' })).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')).toHaveLength(1);
    expect(screen.getByTestId('location')).toHaveTextContent('/acme/billing/prepare');
  });

  it('carries on from the draft when it was saved but could not be issued', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /invoices/issue': {
          status: 409,
          code: 'PERIOD_LOCKED',
          message: 'The period is locked.',
        },
      },
    });
    await toDetails(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Save and issue' }));

    expect(await screen.findByText('The draft was saved but not issued')).toBeInTheDocument();
    expect(screen.getByText('The period is locked.')).toBeInTheDocument();
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/acme/billing/invoices/inv-new-1',
    );
  });
});

describe('the billing summary', () => {
  const jobsTable = async () => {
    const element = await screen.findByRole('table', { name: 'Jobs of the client' });
    return element;
  };

  it('lists each job with its terms and the hours spent, before anything is chosen', async () => {
    setup();
    await work();

    const rows = rowsOf(await jobsTable());
    expect(rows).toHaveLength(2);
    // Most work ready to bill first.
    expect(rows[0]).toHaveTextContent('Partnership accounts');
    expect(rows[0]).toHaveTextContent('Fixed £2,400.00');
    expect(rows[0]).toHaveTextContent('5:00');
    expect(rows[1]).toHaveTextContent('Bookkeeping 2026/27');
    expect(rows[1]).toHaveTextContent('Hourly');
    expect(rows[1]).toHaveTextContent('7:00');
    expect(rows[1]).toHaveTextContent('+1:00 awaiting approval');
  });

  it('totals the client above the jobs', async () => {
    setup();
    await work();

    const totals = screen.getByLabelText('Totals for the client');
    expect(totals).toHaveTextContent('Hours logged12:00');
    expect(totals).toHaveTextContent('Ready to bill8:00');
    expect(totals).toHaveTextContent('£2,394.00');
  });

  it('keeps the detailed figures behind Show/Hide Columns', async () => {
    const user = userEvent.setup();
    setup();
    await work();

    const table = await jobsTable();
    expect(
      within(table).queryByRole('columnheader', { name: /Non-billable/ }),
    ).not.toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Actual cost/ })).toBeInTheDocument();

    const summary = screen.getByRole('region', { name: 'Billing summary' });
    await user.click(within(summary).getByRole('button', { name: 'Show/Hide Columns' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Time at company rates' }));

    const books = rowsOf(table)[1] as HTMLElement;
    expect(books).toHaveTextContent('£120.00');
  });

  it('shows five jobs at first, with search and a way to see the rest', async () => {
    const user = userEvent.setup();
    const summary = harbourSummary();
    const template = summary.jobs[0] as JobBilling;
    summary.jobs = Array.from({ length: 12 }, (_, index) => ({
      ...template,
      job_id: `j-${String(index)}`,
      number: `J${String(100 + index)}`,
      name: `Client job ${String(index + 1)}`,
      breakdown: { ...template.breakdown, ready_minutes: index === 11 ? 600 : 0 },
    }));
    setup({ summary: { [harbour.id]: summary } });
    await work();

    const table = await jobsTable();
    expect(rowsOf(table)).toHaveLength(5);
    // Sorted by work ready to bill: the one with work comes first.
    expect(rowsOf(table)[0]).toHaveTextContent('Client job 12');
    expect(screen.getByText('12 jobs')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show 7 more' }));
    expect(rowsOf(await jobsTable())).toHaveLength(12);

    await user.type(screen.getByRole('searchbox', { name: 'Search jobs' }), 'job 3');
    expect(rowsOf(await jobsTable())).toHaveLength(1);
  });

  it('can be limited to the jobs with work ready to bill', async () => {
    const user = userEvent.setup();
    const summary = harbourSummary();
    const idle = jobBilling({
      job_id: 'j-idle',
      number: 'J00009',
      name: 'Idle job',
      breakdown: { ...(summary.jobs[0] as JobBilling).breakdown, ready_minutes: 0, other_costs: 0 },
    });
    summary.jobs = [...summary.jobs, idle];
    setup({ summary: { [harbour.id]: summary } });
    await work();

    expect(rowsOf(await jobsTable())).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Work ready to bill only' }));
    expect(rowsOf(await jobsTable())).toHaveLength(2);
  });

  it('shows the hours even when there is nothing to bill', async () => {
    const empty = wipOf([]);
    const summary = harbourSummary();
    setup({ wip: { [harbour.id]: empty }, summary: { [harbour.id]: summary } });

    expect(await screen.findByText('Nothing to bill')).toBeInTheDocument();
    expect(rowsOf(await jobsTable())[0]).toHaveTextContent('Partnership accounts');
  });

  it('offers the three bases with what each would bill', async () => {
    setup();
    await work();

    const picker = screen.getByRole('group', { name: 'Value the invoice on' });
    expect(within(picker).getByRole('button', { name: /Contract value £2,394.00/ })).toBeVisible();
    expect(within(picker).getByRole('button', { name: /Job value £2,534.00/ })).toBeVisible();
    expect(within(picker).getByRole('button', { name: /Team value £354.00/ })).toBeVisible();
  });

  it('bills the cost of the team when the team value is chosen', async () => {
    const user = userEvent.setup();
    setup();
    await work();

    await user.click(screen.getByRole('button', { name: /Team value/ }));
    const lines = await review(user, /Bank reconciliation/, /Payroll queries/);

    // 1.5 hours cost £60 and 1 hour £40: the line bills the cost, not the £300 of the rates.
    const rows = rowsOf(lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('£100.00');
    expect(screen.getByLabelText('Invoice totals')).toHaveTextContent('Net£100.00');
  });

  it('bills the value set for the job when the job value is chosen', async () => {
    const user = userEvent.setup();
    setup();
    await work();

    await user.click(screen.getByRole('button', { name: /Job value/ }));
    const lines = await review(user, /Bank reconciliation/);

    // The fee budget of £500, less nothing billed so far: the time line bills that.
    expect(rowsOf(lines)[0]).toHaveTextContent('£500.00');
  });

  it('sends the basis the invoice was valued on with the draft', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await work();

    await user.click(screen.getByRole('button', { name: /Team value/ }));
    await toDetails(user, /Bank reconciliation/);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    await screen.findByText('Draft invoice saved');
    expect(postsOf(backend, '/invoices')[0]?.body).toMatchObject({ valuation_basis: 'team' });
  });

  it('keeps the contract value as the default, which changes nothing', async () => {
    const user = userEvent.setup();
    setup();
    const lines = await review(user, /Bank reconciliation/);
    expect(rowsOf(lines)[0]).toHaveTextContent('£180.00');
  });

  it('does not offer the team value to someone who cannot see cost', async () => {
    const summary = harbourSummary();
    summary.show_cost = false;
    summary.time_costs = null;
    summary.totals.basis_values.team = null;
    setup({ summary: { [harbour.id]: summary } });
    await work();

    const picker = screen.getByRole('group', { name: 'Value the invoice on' });
    expect(within(picker).queryByRole('button', { name: /Team value/ })).not.toBeInTheDocument();
  });
});

describe('time picked on the Time Entries page', () => {
  it('opens with that time already chosen', async () => {
    setup({}, { route: `${PREPARE}?client=${harbour.id}&time=t-1,t-2` });

    const table = await work();
    await waitFor(() =>
      expect(screen.getByText('2 items chosen, £300.00 of work in progress.')).toBeInTheDocument(),
    );
    expect(within(rowOf(table, /Bank reconciliation/)).getByRole('checkbox')).toBeChecked();
    expect(within(rowOf(table, /Payroll queries/)).getByRole('checkbox')).toBeChecked();
    expect(within(rowOf(table, /VAT workings/)).getByRole('checkbox')).not.toBeChecked();
  });

  it('chooses nothing for time that is not in the client’s work in progress', async () => {
    setup({}, { route: `${PREPARE}?client=${harbour.id}&time=somebody-else` });

    await work();
    expect(screen.getByText('Nothing chosen yet.')).toBeInTheDocument();
  });
});
