import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import {
  createRecurringBackend,
  recurringCalls,
  recurringHandlers,
  scheduleOf,
  type RecurringBackend,
} from '../test/recurring';
import { BILLING, renderBillingPage } from '../test/render';
import RecurringInvoicesPage from './RecurringInvoicesPage';

const RECURRING = `${BILLING}/recurring`;
const READ_ONLY = ['organization.read', 'client.read', 'recurring.read'];

function setup(
  init: Partial<RecurringBackend> = {},
  options: { permissions?: string[]; route?: string } = {},
) {
  const backend = createRecurringBackend(init);
  server.use(...recurringHandlers(backend));
  renderBillingPage(<RecurringInvoicesPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? RECURRING,
    path: RECURRING,
  });
  return backend;
}

const lists = (backend: RecurringBackend) => recurringCalls(backend, 'GET', '/recurring');

const table = async () => {
  const element = await screen.findByRole('table', { name: 'Recurring invoices' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

/** Opens the schedule in the nth row of the list and returns its dialog. */
async function openRow(user: ReturnType<typeof userEvent.setup>, index: number, name: string) {
  const rows = rowsOf(await table());
  await user.click(rows[index] as HTMLElement);
  return screen.findByRole('dialog', { name });
}

const runsOf = async (dialog: HTMLElement) => {
  const element = await within(dialog).findByRole('table', { name: 'Runs of the schedule' });
  return within(element).getAllByRole('row').slice(1);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the schedule list', () => {
  it('lists the schedules with their next and last run, amount and status', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.has('status')).toBe(false);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Monthly bookkeeping');
    expect(rows[0]).toHaveTextContent('Harbour & Co');
    expect(rows[0]).toHaveTextContent('Monthly');
    expect(rows[0]).toHaveTextContent('01/11/2026');
    expect(rows[0]).toHaveTextContent('01/10/2026');
    expect(rows[0]).toHaveTextContent('£250.00');
    expect(rows[0]).toHaveTextContent('Active');
    expect(rows[0]).toHaveTextContent('1 failed run');
    expect(rows[1]).toHaveTextContent('Quarterly');
    expect(rows[1]).toHaveTextContent('Paused');
    expect(rows[1]).not.toHaveTextContent('failed run');
    expect(rows[2]).toHaveTextContent('Annually');
    expect(rows[2]).toHaveTextContent('Ended');
    expect(await screen.findByRole('tab', { name: /^All\s*3$/ })).toBeInTheDocument();
  });

  it('narrows to one status from its tab', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('tab', { name: /^Paused/ }));

    await waitFor(() =>
      expect(lists(backend).at(-1)?.params?.getAll('status')).toEqual(['paused']),
    );
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Recurring invoices' }))).toHaveLength(1),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('tab=paused');
    expect(await screen.findByRole('tab', { name: /^Paused\s*1$/ })).toBeInTheDocument();
  });

  it('searches by name, reference or client', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.type(screen.getByLabelText('Search schedules'), 'vat');

    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('q')).toBe('vat'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Recurring invoices' }))).toHaveLength(1),
    );
  });

  it('filters by client', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter schedules' });
    await user.type(within(panel).getByRole('combobox', { name: 'Client' }), 'Brig');
    await user.click(await within(panel).findByRole('option', { name: /Brightside/ }));

    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('client_id')).toBe('c-bright'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Recurring invoices' }))).toHaveLength(1),
    );
  });

  it('explains that a schedule never issues an invoice when there are none', async () => {
    setup({ schedules: [] });
    expect(await screen.findByText('No recurring invoices yet')).toBeInTheDocument();
    expect(screen.getByText(/It never issues the invoice/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New schedule' }).length).toBeGreaterThan(0);
  });

  it('explains a failed load and tries again', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /recurring': { status: 500, code: 'INTERNAL_ERROR', message: 'Boom.' } },
    });
    expect(await screen.findByText('Could not load the recurring invoices')).toBeInTheDocument();

    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await table()).toBeInTheDocument();
  });

  it('refuses a person who may not read schedules', async () => {
    setup({}, { permissions: ['organization.read', 'invoice.read'] });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('setting up a schedule', () => {
  it('creates a schedule with the template lines as typed', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'New schedule' }));
    const dialog = await screen.findByRole('region', { name: 'New schedule' });
    expect(within(dialog).getByText(/never issued\s+automatically/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-10-18');

    await user.type(within(dialog).getByRole('combobox', { name: 'Client' }), 'Harb');
    await user.click(await within(dialog).findByRole('option', { name: /Harbour & Co/ }));
    await user.type(within(dialog).getByLabelText('Name'), 'Payroll runs');
    await user.selectOptions(within(dialog).getByLabelText('Frequency'), 'weekly');
    fireEvent.change(within(dialog).getByLabelText('Start date'), {
      target: { value: '2026-11-02' },
    });
    fireEvent.change(within(dialog).getByLabelText('End date (optional)'), {
      target: { value: '2027-03-31' },
    });
    await user.type(within(dialog).getByLabelText('Reference (optional)'), 'PAY-1');
    await user.type(within(dialog).getByLabelText('Notes (optional)'), 'Weekly payroll');
    const line = within(within(dialog).getByRole('group', { name: 'Line 1' }));
    await user.type(line.getByLabelText('Description'), 'Payroll processing');
    await user.clear(line.getByLabelText('Quantity'));
    await user.type(line.getByLabelText('Quantity'), '1.5');
    await user.type(line.getByLabelText('Unit price (£)'), '40');

    await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

    expect(await screen.findByText('Schedule created')).toBeInTheDocument();
    expect(recurringCalls(backend, 'POST', '/recurring')[0]?.body).toEqual({
      client_id: 'c-harbour',
      name: 'Payroll runs',
      frequency: 'weekly',
      start_date: '2026-11-02',
      end_date: '2027-03-31',
      reference: 'PAY-1',
      notes: 'Weekly payroll',
      lines: [{ description: 'Payroll processing', quantity: '1.50', unit_amount: 4000 }],
    });
    const detail = await screen.findByRole('dialog', { name: 'Payroll runs' });
    expect(detail).toHaveTextContent('Weekly');
    expect(detail).toHaveTextContent('02/11/2026');
    expect(await within(detail).findByText(/No run yet/)).toBeInTheDocument();
  });

  it('checks the form before it asks the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'New schedule' }));
    const dialog = await screen.findByRole('region', { name: 'New schedule' });
    await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

    expect(await within(dialog).findByText('Choose the client')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a name')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a description')).toBeInTheDocument();
    expect(recurringCalls(backend, 'POST', '/recurring')).toHaveLength(0);
  });

  it('refuses an end date before the start date', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'New schedule' }));
    const dialog = await screen.findByRole('region', { name: 'New schedule' });
    fireEvent.change(within(dialog).getByLabelText('End date (optional)'), {
      target: { value: '2026-01-01' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }));

    expect(
      await within(dialog).findByText('The end date cannot be before the start date'),
    ).toBeInTheDocument();
    expect(recurringCalls(backend, 'POST', '/recurring')).toHaveLength(0);
  });

  it('hides the writing actions from a person who can only read', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: READ_ONLY });
    await table();
    expect(screen.queryByRole('button', { name: 'New schedule' })).not.toBeInTheDocument();

    const dialog = await openRow(user, 0, 'Monthly bookkeeping');
    await runsOf(dialog);
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    for (const name of ['Edit', 'Delete', 'Pause', 'Resume']) {
      expect(within(dialog).queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(within(dialog).queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });
});

describe('one schedule', () => {
  it('shows the template lines and says what the schedule does', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openRow(user, 0, 'Monthly bookkeeping');

    expect(dialog).toHaveTextContent('Harbour & Co (C0002)');
    expect(dialog).toHaveTextContent('never issues an invoice');
    const lines = await within(dialog).findByRole('table', {
      name: 'Template lines of the schedule',
    });
    expect(lines).toHaveTextContent('Monthly bookkeeping');
    expect(lines).toHaveTextContent('£250.00');
    expect(within(dialog).getByText('Net per invoice').nextElementSibling).toHaveTextContent(
      '£250.00',
    );
  });

  it('pauses an active schedule and resumes it', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 0, 'Monthly bookkeeping');

    await user.click(await within(dialog).findByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('Schedule paused')).toBeInTheDocument();
    expect(recurringCalls(backend, 'POST', '/recurring/sch-1/pause')).toHaveLength(1);
    expect(await within(dialog).findByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        rowsOf(screen.getByRole('table', { name: 'Recurring invoices' }))[0],
      ).toHaveTextContent('Paused'),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Resume' }));
    expect(await screen.findByText('Schedule resumed')).toBeInTheDocument();
    expect(recurringCalls(backend, 'POST', '/recurring/sch-1/resume')).toHaveLength(1);
    expect(await within(dialog).findByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('shows the API’s refusal when a schedule cannot be paused', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /recurring/pause': {
          status: 409,
          code: 'SCHEDULE_NOT_ACTIVE',
          message: 'Only an active schedule can be paused.',
        },
      },
    });
    const dialog = await openRow(user, 0, 'Monthly bookkeeping');
    await user.click(await within(dialog).findByRole('button', { name: 'Pause' }));

    expect(await within(dialog).findByText('Only an active schedule can be paused.')).toBeVisible();
  });

  it('offers no editing or pausing of an ended schedule', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openRow(user, 2, 'Annual accounts');

    expect(
      await within(dialog).findByText(/has ended and can no longer be changed/),
    ).toBeInTheDocument();
    for (const name of ['Edit', 'Pause', 'Resume']) {
      expect(within(dialog).queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('changes the name and the lines, and sends only what changed', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 0, 'Monthly bookkeeping');

    await user.click(await within(dialog).findByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('region', { name: 'Edit schedule' });
    expect(within(form).getByLabelText('Name')).toHaveValue('Monthly bookkeeping');
    expect(within(form).queryByLabelText('Start date')).not.toBeInTheDocument();
    expect(within(form).queryByRole('combobox', { name: 'Client' })).not.toBeInTheDocument();

    const name = within(form).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Bookkeeping');
    await user.selectOptions(within(form).getByLabelText('Frequency'), 'quarterly');
    const unit = within(within(form).getByRole('group', { name: 'Line 1' })).getByLabelText(
      'Unit price (£)',
    );
    await user.clear(unit);
    await user.type(unit, '300');
    await user.click(within(form).getByRole('button', { name: 'Save schedule' }));

    expect(await screen.findByText('Schedule saved')).toBeInTheDocument();
    expect(recurringCalls(backend, 'PATCH', '/recurring/sch-1')[0]?.body).toEqual({
      name: 'Bookkeeping',
      frequency: 'quarterly',
      lines: [
        {
          description: 'Monthly bookkeeping',
          quantity: '1.00',
          unit_amount: 30000,
          vat_rate_id: 'vat-std',
        },
      ],
    });
    const back = await screen.findByRole('dialog', { name: 'Bookkeeping' });
    await waitFor(() => expect(back).toHaveTextContent('Quarterly'));
  });

  it('clears the end date with a null', async () => {
    const user = userEvent.setup();
    const backend = setup({
      schedules: [scheduleOf({ end_date: '2027-03-31' })],
    });
    const dialog = await openRow(user, 0, 'Monthly bookkeeping');

    await user.click(await within(dialog).findByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('region', { name: 'Edit schedule' });
    expect(within(form).getByLabelText('End date (optional)')).toHaveValue('2027-03-31');
    fireEvent.change(within(form).getByLabelText('End date (optional)'), { target: { value: '' } });
    await user.click(within(form).getByRole('button', { name: 'Save schedule' }));

    await screen.findByText('Schedule saved');
    expect(recurringCalls(backend, 'PATCH', '/recurring/sch-1')[0]?.body).toEqual({
      end_date: null,
    });
  });
});

describe('the runs of a schedule', () => {
  it('lists the runs with their invoices and the error of a failed one', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openRow(user, 0, 'Monthly bookkeeping');
    const runs = await runsOf(dialog);

    expect(runs).toHaveLength(3);
    expect(runs[0]).toHaveTextContent('01/10/2026');
    expect(runs[0]).toHaveTextContent('Succeeded');
    expect(
      within(runs[0] as HTMLElement).getByRole('link', { name: 'Draft invoice' }),
    ).toHaveAttribute('href', '/acme/billing/invoices/inv-draft-1');
    expect(runs[1]).toHaveTextContent('01/09/2026');
    expect(runs[1]).toHaveTextContent('Failed');
    expect(runs[1]).toHaveTextContent('The client has no default VAT code.');
    expect(within(runs[1] as HTMLElement).queryByRole('link')).not.toBeInTheDocument();
    expect(within(runs[2] as HTMLElement).getByRole('link', { name: 'INV-00042' })).toHaveAttribute(
      'href',
      '/acme/billing/invoices/inv-issued-1',
    );
    expect(within(dialog).getAllByRole('button', { name: /^Retry the run of/ })).toHaveLength(1);
  });

  it('opens the drafted invoice from its run', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openRow(user, 0, 'Monthly bookkeeping');
    const runs = await runsOf(dialog);

    await user.click(within(runs[0] as HTMLElement).getByRole('link', { name: 'Draft invoice' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/acme/billing/invoices/inv-draft-1',
      ),
    );
  });

  it('retries a failed run and shows the invoice it drafted', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 0, 'Monthly bookkeeping');
    await runsOf(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Retry the run of 01/09/2026' }));

    expect(await screen.findByText('Invoice drafted')).toBeInTheDocument();
    expect(recurringCalls(backend, 'POST', '/recurring/runs/run-2/retry')).toHaveLength(1);
    await waitFor(async () => {
      const runs = await runsOf(dialog);
      expect(runs[1]).toHaveTextContent('Succeeded');
    });
    expect(within(dialog).queryByRole('button', { name: /^Retry the run of/ })).toBeNull();
    // The schedule no longer awaits a retry.
    await waitFor(() =>
      expect(
        rowsOf(screen.getByRole('table', { name: 'Recurring invoices' }))[0],
      ).not.toHaveTextContent('failed run'),
    );
  });

  it('says when the retry failed again', async () => {
    const user = userEvent.setup();
    const backend = setup({ retryResult: 'failed' });
    const dialog = await openRow(user, 0, 'Monthly bookkeeping');
    await runsOf(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Retry the run of 01/09/2026' }));

    expect(await screen.findByText('The run failed again')).toBeInTheDocument();
    expect(screen.getAllByText('The client still has no VAT code.').length).toBeGreaterThan(0);
    expect(recurringCalls(backend, 'POST', '/recurring/runs/run-2/retry')).toHaveLength(1);
    await waitFor(async () => {
      const runs = await runsOf(dialog);
      expect(runs[1]).toHaveTextContent('Failed');
      expect(runs[1]).toHaveTextContent('2');
    });
  });

  it('says when a schedule has not run yet', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openRow(user, 1, 'Quarterly VAT returns');
    expect(await within(dialog).findByText(/No run yet/)).toBeInTheDocument();
  });
});

describe('deleting a schedule', () => {
  it('deletes a schedule that never ran', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 1, 'Quarterly VAT returns');

    await user.click(await within(dialog).findByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete schedule?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete schedule' }));

    expect(await screen.findByText('Schedule deleted')).toBeInTheDocument();
    expect(recurringCalls(backend, 'DELETE', '/recurring/sch-2')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Recurring invoices' }))).toHaveLength(2),
    );
  });

  it('explains that a schedule that already ran cannot be deleted', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 0, 'Monthly bookkeeping');

    await user.click(await within(dialog).findByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete schedule?' });
    expect(confirm).toHaveTextContent('pause it, or set an end date, instead');
    await user.click(within(confirm).getByRole('button', { name: 'Delete schedule' }));

    expect(
      await within(confirm).findByText(
        'This schedule has already run. Pause it or set an end date instead.',
      ),
    ).toBeVisible();
    expect(recurringCalls(backend, 'DELETE', '/recurring/sch-1')).toHaveLength(1);
    expect(backend.schedules).toHaveLength(3);
    expect(screen.getByRole('dialog', { name: 'Delete schedule?' })).toBeInTheDocument();
  });
});
