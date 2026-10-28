import { findRowAction, rowAction, rowActionNames } from '@/test/rowActions';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { harbour, morgan, statement, statementRows } from '../test/fixtures';
import { callsOf, createBackend, billingHandlers, type BillingBackend } from '../test/handlers';
import { BILLING, renderBillingPage } from '../test/render';
import ClientStatementsPage from './ClientStatementsPage';

const STATEMENTS = `${BILLING}/statements`;
const READ_ONLY = ['organization.read', 'client.read', 'invoice.read', 'payment.read'];

function setup(
  init: Partial<BillingBackend> = {},
  options: { permissions?: string[]; route?: string } = {},
) {
  const backend = createBackend({
    statements: statementRows(),
    statementOf: { [harbour.id]: statement() },
    ...init,
  });
  server.use(...billingHandlers(backend));
  renderBillingPage(<ClientStatementsPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? STATEMENTS,
    path: STATEMENTS,
  });
  return backend;
}

const lists = (backend: BillingBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/statements');
const statementsOf = (backend: BillingBackend, clientId: string) =>
  callsOf(backend, 'GET').filter((call) => call.path === `/clients/${clientId}/statement`);
const sends = (backend: BillingBackend) =>
  callsOf(backend, 'POST').filter((call) => call.path.endsWith('/statement/send'));

const table = async () => {
  const element = await screen.findByRole('table', { name: 'Client statements' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

async function openStatement(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await findRowAction(`Actions for ${name}`, 'View the statement'));
  const dialog = await screen.findByRole('dialog', { name: 'Client statement' });
  const entries = await within(dialog).findByRole('table', { name: `Statement of ${name}` });
  await waitFor(() => expect(entries).not.toHaveAttribute('aria-busy', 'true'));
  return { dialog, entries };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the clients with a statement', () => {
  it('lists them by name with what they owe and the last statement sent', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.get('sort')).toBe('client');
    expect(lists(backend)[0]?.params?.get('order')).toBe('asc');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('A. Morgan');
    expect(rows[0]).toHaveTextContent('£237.60');
    expect(rows[0]).toHaveTextContent('oldest 48 days');
    expect(rows[0]).toHaveTextContent('Never sent');
    expect(rows[0]).toHaveTextContent('No email address');
    expect(rows[1]).toHaveTextContent('Brightside Bakery Ltd');
    expect(rows[1]).toHaveTextContent('£200.00');
    expect(rows[1]).toHaveTextContent('In credit');
    expect(rows[2]).toHaveTextContent('Harbour & Co');
    expect(rows[2]).toHaveTextContent('£332.00');
    expect(rows[2]).toHaveTextContent('05/10/2026');
    expect(rows[2]).toHaveTextContent('to info@harbour.example');

    const figures = screen.getByLabelText('Statement figures');
    expect(figures).toHaveTextContent('Clients3');
    expect(figures).toHaveTextContent('Outstanding£569.60');
    expect(figures).toHaveTextContent('Overdue£569.60');
    expect(figures).toHaveTextContent('Cash on account£200.00');
  });

  it('sorts on the server from the column header', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /^Balance/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('sort')).toBe('balance'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Client statements' }))[0]).toHaveTextContent(
        'Brightside Bakery Ltd',
      ),
    );
  });

  it('narrows to the clients that are overdue, and to those never sent a statement', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter the statements' });
    await user.click(
      within(panel).getByRole('switch', { name: 'Only clients with overdue invoices' }),
    );
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('overdue_only')).toBe('true'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Client statements' }))).toHaveLength(2),
    );

    await user.click(
      within(panel).getByRole('switch', { name: 'Only clients never sent a statement' }),
    );
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('never_sent')).toBe('true'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Client statements' }))).toHaveLength(1),
    );
    expect(screen.getByText(', 2 filters applied')).toBeInTheDocument();
  });

  it('searches by name or code', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.type(screen.getByLabelText('Search clients'), 'harb');
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('q')).toBe('harb'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Client statements' }))).toHaveLength(1),
    );
  });

  it('says when there is nothing to send, and when the filters hide everyone', async () => {
    const user = userEvent.setup();
    setup({ statements: [] });
    expect(await screen.findByText('No statements to send')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search clients'), 'zzz');
    expect(await screen.findByText('No clients match')).toBeInTheDocument();
  });

  it('explains a failed load and tries again', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /statements': { status: 500, code: 'INTERNAL_ERROR', message: 'Boom.' } },
    });
    expect(await screen.findByText('Could not load the statements')).toBeInTheDocument();

    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await table()).toBeInTheDocument();
  });
});

describe('a client\u2019s statement', () => {
  it('shows the period, the totals and every entry with the running balance', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    const { dialog, entries } = await openStatement(user, 'Harbour & Co');
    expect(await screen.findByTestId('location')).toHaveTextContent(
      `/acme/billing/statements?statement=${harbour.id}`,
    );
    expect(within(dialog).getByLabelText('From')).toHaveValue('2026-07-01');
    expect(within(dialog).getByLabelText('To')).toHaveValue('2026-10-18');
    expect(statementsOf(backend, harbour.id)[0]?.params?.get('date_from')).toBe('2026-07-01');
    expect(statementsOf(backend, harbour.id)[0]?.params?.get('date_to')).toBe('2026-10-18');

    const totals = within(dialog).getByLabelText('Statement totals');
    expect(totals).toHaveTextContent('Brought forward£0.00');
    expect(totals).toHaveTextContent('Invoiced£432.00');
    expect(totals).toHaveTextContent('Paid£100.00');
    expect(totals).toHaveTextContent('Closing balance£332.00');

    const rows = rowsOf(entries);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('01/07/2026');
    expect(rows[0]).toHaveTextContent('Balance brought forward');
    expect(rows[1]).toHaveTextContent('Invoice');
    expect(rows[1]).toHaveTextContent('INV-00002');
    expect(rows[1]).toHaveTextContent('£432.00');
    expect(within(rows[1] as HTMLElement).getByRole('link', { name: 'INV-00002' })).toHaveAttribute(
      'href',
      '/acme/billing/invoices/inv-2',
    );
    expect(rows[2]).toHaveTextContent('Payment');
    expect(rows[2]).toHaveTextContent('-£100.00');
    expect(rows[2]).toHaveTextContent('£332.00');
  });

  it('opens from a link with the client in the address, and closes by removing it', async () => {
    const user = userEvent.setup();
    setup({}, { route: `${STATEMENTS}?statement=${harbour.id}` });

    const dialog = await screen.findByRole('dialog', { name: 'Client statement' });
    expect(await within(dialog).findByText('Harbour & Co')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/acme/billing/statements'),
    );
    expect(screen.getByTestId('location')).not.toHaveTextContent('statement=');
  });

  it('reads the statement again for another period', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();
    const { dialog } = await openStatement(user, 'Harbour & Co');

    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2026-09-01' } });
    await waitFor(() =>
      expect(statementsOf(backend, harbour.id).at(-1)?.params?.get('date_from')).toBe('2026-09-01'),
    );
    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '2026-09-30' } });
    await waitFor(() =>
      expect(statementsOf(backend, harbour.id).at(-1)?.params?.get('date_to')).toBe('2026-09-30'),
    );
  });

  it('refuses a period that ends before it starts', async () => {
    const user = userEvent.setup();
    setup();
    await table();
    const { dialog } = await openStatement(user, 'Harbour & Co');

    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '2026-06-30' } });
    expect(
      await within(dialog).findByText('The start of the period is after its end.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Download PDF' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Email the statement' })).toBeDisabled();
  });

  it('says when nothing happened in the period', async () => {
    const user = userEvent.setup();
    setup({ statementOf: { [harbour.id]: statement({ entries: [], invoiced: 0, paid: 0 }) } });
    await table();
    const { dialog } = await openStatement(user, 'Harbour & Co');
    expect(
      within(dialog).getByText('Nothing was invoiced, credited or paid in this period.'),
    ).toBeInTheDocument();
  });

  it('downloads the PDF of the period on show', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:statement');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    const backend = setup();
    await table();
    const { dialog } = await openStatement(user, 'Harbour & Co');

    await user.click(within(dialog).getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(names).toEqual(['statement-C0002-2026-10-18.pdf']));
    const pdf = callsOf(backend, 'GET').find(
      (call) => call.path === `/clients/${harbour.id}/statement/pdf`,
    );
    expect(pdf?.params?.get('date_from')).toBe('2026-07-01');
    expect(pdf?.params?.get('date_to')).toBe('2026-10-18');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('downloads the PDF straight from the row actions', async () => {
    const user = userEvent.setup();
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:statement'),
      revokeObjectURL: vi.fn(),
    });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    setup();
    await table();

    await user.click(await findRowAction('Actions for Harbour & Co', 'Download the PDF'));
    await waitFor(() => expect(names).toEqual(['statement-C0002-2026-10-18.pdf']));
  });

  it('shows what the API refuses when the statement cannot be read', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'GET /clients/statement': { status: 500, code: 'INTERNAL_ERROR', message: 'Boom.' },
      },
    });
    await table();

    await user.click(await findRowAction('Actions for Harbour & Co', 'View the statement'));
    expect(await screen.findByText('Could not load the statement')).toBeInTheDocument();
  });
});

describe('emailing statements', () => {
  it('sends one client the statement for the period, to the addresses on the client', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(await findRowAction('Actions for Harbour & Co', 'Email the statement'));
    const dialog = await screen.findByRole('dialog', { name: 'Email the statement' });
    expect(dialog).toHaveTextContent('Harbour & Co');
    expect(within(dialog).getByLabelText('From')).toHaveValue('2026-07-01');
    expect(within(dialog).getByLabelText('To')).toHaveValue('2026-10-18');

    await user.click(within(dialog).getByRole('button', { name: 'Send email' }));
    expect(await screen.findByText('Statement email queued')).toBeInTheDocument();
    expect(screen.getByText('The PDF goes to info@harbour.example.')).toBeInTheDocument();
    expect(sends(backend)).toHaveLength(1);
    expect(sends(backend)[0]?.path).toBe(`/clients/${harbour.id}/statement/send`);
    expect(sends(backend)[0]?.body).toEqual({ date_from: '2026-07-01', date_to: '2026-10-18' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends to the addresses typed instead', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(await findRowAction('Actions for Harbour & Co', 'Email the statement'));
    const dialog = await screen.findByRole('dialog', { name: 'Email the statement' });
    await user.type(
      within(dialog).getByLabelText('Send to'),
      'ann@harbour.example, bob@harbour.example',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Send email' }));

    await waitFor(() => expect(sends(backend)).toHaveLength(1));
    expect(sends(backend)[0]?.body).toMatchObject({
      to: ['ann@harbour.example', 'bob@harbour.example'],
    });
  });

  it('asks for an address when the client has none, and refuses a wrong one', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(await findRowAction('Actions for A. Morgan', 'Email the statement'));
    const dialog = await screen.findByRole('dialog', { name: 'Email the statement' });
    expect(
      within(dialog).getByText('This client has no email address: enter the addresses to send to.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Send email' }));
    expect(
      await within(dialog).findByText('This client has no email address: enter one to send to.'),
    ).toBeInTheDocument();
    expect(sends(backend)).toHaveLength(0);

    await user.type(within(dialog).getByLabelText('Send to'), 'not-an-address');
    await user.click(within(dialog).getByRole('button', { name: 'Send email' }));
    expect(
      await within(dialog).findByText('Enter up to 10 valid email addresses, separated by commas'),
    ).toBeInTheDocument();
    expect(sends(backend)).toHaveLength(0);

    await user.clear(within(dialog).getByLabelText('Send to'));
    await user.type(within(dialog).getByLabelText('Send to'), 'morgan@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Send email' }));
    await waitFor(() => expect(sends(backend)).toHaveLength(1));
    expect(sends(backend)[0]?.body).toMatchObject({ to: ['morgan@example.com'] });
  });

  it('emails the statement shown in the dialog, for its period', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();
    const { dialog } = await openStatement(user, 'Harbour & Co');

    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2026-09-01' } });
    await waitFor(() =>
      expect(statementsOf(backend, harbour.id).at(-1)?.params?.get('date_from')).toBe('2026-09-01'),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Email the statement' }));

    const sendDialog = await screen.findByRole('dialog', { name: 'Email the statement' });
    expect(within(sendDialog).getByLabelText('From')).toHaveValue('2026-09-01');
    await user.click(within(sendDialog).getByRole('button', { name: 'Send email' }));
    await waitFor(() => expect(sends(backend)).toHaveLength(1));
    expect(sends(backend)[0]?.body).toEqual({ date_from: '2026-09-01', date_to: '2026-10-18' });
  });

  it('sends the statements of the clients selected, skipping those without an address', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('checkbox', { name: 'Select A. Morgan' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Harbour & Co' }));
    expect(screen.getByText('2 clients selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Email statements' }));

    const dialog = await screen.findByRole('dialog', { name: 'Email statements' });
    expect(dialog).toHaveTextContent('2 clients');
    expect(dialog).toHaveTextContent('1 client has an email address.');
    expect(dialog).toHaveTextContent('1 client without one will be skipped.');
    await user.click(within(dialog).getByRole('button', { name: 'Send 1 email' }));

    const results = await within(dialog).findByRole('list', { name: 'Results' });
    expect(results).toHaveTextContent('Harbour & CoQueued for info@harbour.example');
    expect(results).toHaveTextContent('A. MorganSkipped: no email address on the client');
    expect(sends(backend)).toHaveLength(1);
    expect(sends(backend)[0]?.path).toBe(`/clients/${harbour.id}/statement/send`);

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The client sent to leaves the selection; the one skipped stays selected.
    expect(screen.getByText('1 client selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select A. Morgan' })).toBeChecked();
  });

  it('reports the clients whose email could not be queued', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /clients/statement/send': {
          status: 409,
          code: 'STATEMENT_NOT_AVAILABLE',
          message: 'The statement cannot be sent now.',
        },
      },
    });
    await table();

    await user.click(screen.getByRole('checkbox', { name: 'Select Harbour & Co' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Brightside Bakery Ltd' }));
    await user.click(screen.getByRole('button', { name: 'Email statements' }));
    const dialog = await screen.findByRole('dialog', { name: 'Email statements' });
    await user.click(within(dialog).getByRole('button', { name: 'Send 2 emails' }));

    const results = await within(dialog).findByRole('list', { name: 'Results' });
    expect(results).toHaveTextContent('Failed: The statement cannot be sent now.');
  });

  it('keeps the dialog open with what the API refuses for one client', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: {
        'POST /clients/statement/send': {
          status: 403,
          code: 'PERMISSION_DENIED',
          message: 'You cannot send statements.',
        },
      },
    });
    await table();

    await user.click(await findRowAction('Actions for Harbour & Co', 'Email the statement'));
    const dialog = await screen.findByRole('dialog', { name: 'Email the statement' });
    await user.click(within(dialog).getByRole('button', { name: 'Send email' }));

    expect(await within(dialog).findByText('You cannot send statements.')).toBeInTheDocument();
    expect(sends(backend)).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Email the statement' })).toBeInTheDocument();
  });
});

describe('the permissions', () => {
  it('shows a reader the statements without a way to email them', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: READ_ONLY });
    await table();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    expect(
      await findRowAction('Actions for Harbour & Co', 'View the statement'),
    ).toBeInTheDocument();
    expect(rowActionNames('Actions for Harbour & Co')).not.toContain('Email the statement');
    await user.click(rowAction('Actions for Harbour & Co', 'View the statement'));

    const dialog = await screen.findByRole('dialog', { name: 'Client statement' });
    expect(await within(dialog).findByText('Harbour & Co')).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Email the statement' }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });

  it('refuses a person who can read invoices but not payments', async () => {
    setup({}, { permissions: ['organization.read', 'invoice.read'] });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('refuses a person with no way to read invoices or payments', async () => {
    setup({}, { permissions: ['organization.read'] });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });

  it('opens the client from the actions', async () => {
    const user = userEvent.setup();
    setup();
    await table();

    await user.click(await findRowAction('Actions for A. Morgan', 'Open the client'));
    expect(await screen.findByTestId('location')).toHaveTextContent(`/acme/clients/${morgan.id}`);
  });
});
