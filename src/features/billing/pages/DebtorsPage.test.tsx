import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import {
  bright,
  debtorInvoice,
  debtorRows,
  harbour,
  morgan,
  north,
  northInvoices,
  reminderEntry,
} from '../test/fixtures';
import { callsOf, createBackend, billingHandlers, type BillingBackend } from '../test/handlers';
import { BILLING, renderBillingPage } from '../test/render';
import DebtorsPage from './DebtorsPage';

const DEBTORS = `${BILLING}/debtors`;
const READ_ONLY = ['organization.read', 'client.read', 'invoice.read', 'payment.read'];

const invoicesOf = () => ({
  [north.id]: northInvoices(),
  [harbour.id]: [
    debtorInvoice({
      id: 'inv-2',
      number: 'INV-00002',
      due_date: '2026-10-01',
      days_overdue: 17,
      bucket: 'days_1_30',
      gross_total: 43200,
      paid: 10000,
      outstanding: 33200,
      last_reminder_at: '2026-10-10T09:00:00Z',
      reminder_count: 1,
    }),
  ],
  [morgan.id]: [
    debtorInvoice({
      id: 'inv-7',
      number: 'INV-00007',
      due_date: '2026-08-31',
      days_overdue: 48,
      bucket: 'days_31_60',
      gross_total: 23760,
      outstanding: 23760,
    }),
  ],
  [bright.id]: [
    debtorInvoice({
      id: 'inv-5',
      number: 'INV-00005',
      due_date: '2026-11-09',
      days_overdue: 0,
      bucket: 'current',
      gross_total: 30060,
      outstanding: 30060,
      display_status: 'issued',
    }),
  ],
});

function setup(
  init: Partial<BillingBackend> = {},
  options: { permissions?: string[]; route?: string } = {},
) {
  const backend = createBackend({
    debtors: debtorRows(),
    debtorInvoices: invoicesOf(),
    ...init,
  });
  server.use(...billingHandlers(backend));
  renderBillingPage(<DebtorsPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? DEBTORS,
    path: DEBTORS,
  });
  return backend;
}

const lists = (backend: BillingBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/debtors');

const table = async () => {
  const element = await screen.findByRole('table', { name: 'Debtors' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

async function openActions(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the debtors', () => {
  it('lists who owes what, largest first, with the totals of every client', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.get('sort')).toBe('total');
    expect(lists(backend)[0]?.params?.get('order')).toBe('desc');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('Northgate Dental LLP');
    expect(rows[0]).toHaveTextContent('£1,482.00');
    expect(rows[0]).toHaveTextContent('£690.00');
    expect(rows[0]).toHaveTextContent('£792.00');
    expect(rows[0]).toHaveTextContent('140 days overdue');
    expect(rows[0]).toHaveTextContent('Never');
    expect(rows[1]).toHaveTextContent('Harbour & Co');
    expect(rows[1]).toHaveTextContent('10/10/2026');

    const figures = screen.getByLabelText('Debtor figures');
    expect(figures).toHaveTextContent('Total owed£2,352.20');
    expect(figures).toHaveTextContent('4 clients, 5 invoices');
    expect(figures).toHaveTextContent('Overdue£2,051.60');
    expect(figures).toHaveTextContent('Current£300.60');
    expect(figures).toHaveTextContent('Over 90 days overdue£792.00');
    expect(screen.getByRole('img', { name: /^Ageing of what is owed/ })).toBeInTheDocument();
  });

  it('sorts on the server from the column header', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /^Client/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('sort')).toBe('client'));
    expect(lists(backend).at(-1)?.params?.get('order')).toBe('asc');
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Debtors' }))[0]).toHaveTextContent(
        'A. Morgan',
      ),
    );
  });

  it('narrows to the clients owing at least an amount', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter the debtors' });
    await user.type(within(panel).getByLabelText('Owing at least (£)'), '500{Enter}');

    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('min_balance')).toBe('50000'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Debtors' }))).toHaveLength(1),
    );
    expect(screen.getByText(', 1 filters applied')).toBeInTheDocument();
  });

  it('reads the balances as at another day and comes back to today', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();
    expect(lists(backend)[0]?.params?.has('as_at')).toBe(false);

    const date = screen.getByLabelText('As at date');
    expect(date).toHaveAttribute('max', '2026-10-18');
    fireEvent.change(date, { target: { value: '2026-09-30' } });
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('as_at')).toBe('2026-09-30'));

    await user.click(await screen.findByRole('button', { name: 'Today' }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.has('as_at')).toBe(false));
  });

  it('says when nobody owes anything, and when the filters hide everyone', async () => {
    setup({ debtors: [] });
    expect(await screen.findByText('Nobody owes anything')).toBeInTheDocument();
  });

  it('explains a failed load and tries again', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /debtors': { status: 500, code: 'INTERNAL_ERROR', message: 'Boom.' } },
    });
    expect(await screen.findByText('Could not load the debtors')).toBeInTheDocument();

    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await table()).toBeInTheDocument();
  });
});

describe('the invoices behind a debtor', () => {
  it('opens a client\u2019s open invoices with the days overdue and the reminders', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const rows = rowsOf(await table());

    await user.click(rows[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog', { name: 'Open invoices' });
    expect(dialog).toHaveTextContent('Northgate Dental LLP, as at 18/10/2026');
    const list = await within(dialog).findByRole('table', {
      name: 'Open invoices of Northgate Dental LLP',
    });
    await waitFor(() => expect(list).not.toHaveAttribute('aria-busy', 'true'));
    const invoices = rowsOf(list);
    expect(invoices).toHaveLength(2);
    expect(invoices[0]).toHaveTextContent('INV-00004');
    expect(invoices[0]).toHaveTextContent('140 days overdue');
    expect(invoices[0]).toHaveTextContent('£792.00');
    expect(invoices[0]).toHaveTextContent('None');
    expect(invoices[1]).toHaveTextContent('2, last 01/10/2026');
    expect(
      callsOf(backend, 'GET').find((call) => call.path === `/debtors/${north.id}/invoices`),
    ).toBeTruthy();
  });
});

describe('payment reminders', () => {
  it('previews the email and queues it after a confirmation', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await openActions(user, 'Northgate Dental LLP');
    await user.click(await screen.findByRole('menuitem', { name: 'Send a reminder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send payment reminders' });
    const email = await within(dialog).findByRole('region', {
      name: 'Email to Northgate Dental LLP',
    });
    expect(email).toHaveTextContent('To: jo@example.com');
    expect(email).toHaveTextContent('£1,482.00 overdue');
    expect(email).toHaveTextContent('INV-00004, due 31/05/2026 (140 days overdue)');
    expect(within(dialog).getByText('1 email will go out.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Send 1 email' }));
    expect(await screen.findByText('1 reminder queued')).toBeInTheDocument();
    expect(screen.getByText('2 invoices reminded.')).toBeInTheDocument();

    const posts = callsOf(backend, 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0]?.body).toMatchObject({
      client_ids: [north.id],
      template: 'client_payment_reminder',
      dry_run: true,
    });
    expect(posts[1]?.body).toMatchObject({ client_ids: [north.id], dry_run: false });
    expect(backend.reminders).toHaveLength(2);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('previews the final notice when it is chosen', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await openActions(user, 'Northgate Dental LLP');
    await user.click(await screen.findByRole('menuitem', { name: 'Send a reminder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send payment reminders' });
    await within(dialog).findByText('1 email will go out.');
    await user.selectOptions(within(dialog).getByLabelText('Email to send'), 'Final notice');

    await waitFor(() =>
      expect(callsOf(backend, 'POST').at(-1)?.body).toMatchObject({
        template: 'client_payment_final_notice',
        dry_run: true,
      }),
    );
  });

  it('says why a client cannot be reminded and sends nothing', async () => {
    const user = userEvent.setup();
    setup();
    await table();

    await openActions(user, 'A. Morgan');
    await user.click(await screen.findByRole('menuitem', { name: 'Send a reminder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send payment reminders' });
    expect(
      await within(dialog).findByText('Nothing can be sent: every invoice was skipped.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('INV-00007: No email address on the client'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Send emails' })).toBeDisabled();
  });

  it('offers no reminder for a client that is not overdue', async () => {
    const user = userEvent.setup();
    setup();
    await table();

    await openActions(user, 'Brightside Bakery Ltd');
    expect(await screen.findByRole('menuitem', { name: 'See the invoices' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Send a reminder' })).not.toBeInTheDocument();
  });

  it('reminds about the invoices chosen in the drill-down', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const rows = rowsOf(await table());

    await user.click(rows[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog', { name: 'Open invoices' });
    const list = await within(dialog).findByRole('table', {
      name: 'Open invoices of Northgate Dental LLP',
    });
    await waitFor(() => expect(within(list).getAllByRole('row')).toHaveLength(3));
    await user.click(within(list).getByRole('checkbox', { name: 'Select INV-00003' }));
    await user.click(within(dialog).getByRole('button', { name: 'Remind about 1 invoice' }));

    const reminder = await screen.findByRole('dialog', { name: 'Send payment reminders' });
    expect(await within(reminder).findByText('1 email will go out.')).toBeInTheDocument();
    const posts = callsOf(backend, 'POST');
    expect(posts.at(-1)?.body).toMatchObject({ invoice_ids: ['inv-3'], dry_run: true });
    expect(posts.at(-1)?.body).not.toHaveProperty('client_ids');
  });

  it('reminds the clients selected in the table', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('checkbox', { name: 'Select Northgate Dental LLP' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Harbour & Co' }));
    expect(screen.getByText('2 clients selected, £1,814.00 owed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send reminders' }));

    const dialog = await screen.findByRole('dialog', { name: 'Send payment reminders' });
    expect(await within(dialog).findByText('2 emails will go out.')).toBeInTheDocument();
    expect(callsOf(backend, 'POST').at(-1)?.body).toMatchObject({
      client_ids: [north.id, harbour.id],
      dry_run: true,
    });
  });

  it('shows what the API refuses in the dialog and keeps it open', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /debtors/reminders': {
          status: 403,
          code: 'PERMISSION_DENIED',
          message: 'You cannot send reminders.',
        },
      },
    });
    await table();

    await openActions(user, 'Northgate Dental LLP');
    await user.click(await screen.findByRole('menuitem', { name: 'Send a reminder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send payment reminders' });
    expect(await within(dialog).findByText('You cannot send reminders.')).toBeInTheDocument();
  });
});

describe('the reminders sent', () => {
  const REMINDERS = `${DEBTORS}?view=reminders`;

  it('lists them with their status, source and what was owed', async () => {
    const backend = setup(
      {
        reminders: [
          reminderEntry(),
          reminderEntry({
            id: 'rem-2',
            client: north,
            invoice: { id: 'inv-4', number: 'INV-00004' },
            source: 'scheduled',
            status: 'failed',
            sent_by: null,
            to: ['jo@example.com'],
            error: 'Mailbox full',
            days_overdue: 140,
            amount_due: 79200,
          }),
        ],
      },
      { route: REMINDERS },
    );
    const element = await screen.findByRole('table', { name: 'Payment reminders sent' });
    await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));

    const rows = rowsOf(element);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Harbour & Co');
    expect(rows[0]).toHaveTextContent('INV-00002');
    expect(rows[0]).toHaveTextContent('Payment reminder');
    expect(rows[0]).toHaveTextContent('Sent');
    expect(rows[0]).toHaveTextContent('Ada Smith');
    expect(rows[1]).toHaveTextContent('Failed');
    expect(rows[1]).toHaveTextContent('Mailbox full');
    expect(rows[1]).toHaveTextContent('Scheduled');
    expect(callsOf(backend, 'GET').some((call) => call.path === '/debtors/reminders')).toBe(true);
  });

  it('narrows by status', async () => {
    const user = userEvent.setup();
    const backend = setup({ reminders: [reminderEntry()] }, { route: REMINDERS });
    await screen.findByRole('table', { name: 'Payment reminders sent' });

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter the reminders' });
    await user.selectOptions(within(panel).getByLabelText('Status'), 'Failed');
    await waitFor(() =>
      expect(
        callsOf(backend, 'GET')
          .filter((call) => call.path === '/debtors/reminders')
          .at(-1)
          ?.params?.get('status'),
      ).toBe('failed'),
    );
    expect(await screen.findByText('No reminders match')).toBeInTheDocument();
  });

  it('says when none were sent', async () => {
    setup({ reminders: [] }, { route: REMINDERS });
    expect(await screen.findByText('No reminders sent yet')).toBeInTheDocument();
  });

  it('switches between the debtors and the reminders', async () => {
    const user = userEvent.setup();
    setup({ reminders: [reminderEntry()] });
    await table();
    await user.click(screen.getByRole('button', { name: 'Reminders sent' }));
    expect(
      await screen.findByRole('table', { name: 'Payment reminders sent' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Debtors' }));
    expect(await screen.findByRole('table', { name: 'Debtors' })).toBeInTheDocument();
  });
});

describe('the permissions', () => {
  it('shows a reader the debtors without a way to send reminders', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: READ_ONLY });
    await table();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    await openActions(user, 'Northgate Dental LLP');
    expect(await screen.findByRole('menuitem', { name: 'See the invoices' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Send a reminder' })).not.toBeInTheDocument();
  });

  it('opens the statement of a client from the actions', async () => {
    const user = userEvent.setup();
    setup();
    await table();

    await openActions(user, 'Harbour & Co');
    await user.click(await screen.findByRole('menuitem', { name: 'View the statement' }));
    expect(await screen.findByTestId('location')).toHaveTextContent(
      `/acme/billing/statements?statement=${harbour.id}`,
    );
  });

  it('refuses a person with no way to read invoices or payments', async () => {
    setup({}, { permissions: ['organization.read'] });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
