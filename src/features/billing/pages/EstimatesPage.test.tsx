import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import {
  createEstimateBackend,
  estimateCalls,
  estimateHandlers,
  estimateOf,
  type EstimateBackend,
} from '../test/estimates';
import { BILLING, renderBillingPage } from '../test/render';
import EstimatesPage from './EstimatesPage';

const ESTIMATES = `${BILLING}/estimates`;
const READ_ONLY = ['organization.read', 'client.read', 'estimate.read'];
const NO_INVOICE = OWNER_PERMISSIONS.filter((permission) => permission !== 'invoice.create');

function setup(
  init: Partial<EstimateBackend> = {},
  options: { permissions?: string[]; route?: string } = {},
) {
  const backend = createEstimateBackend(init);
  server.use(...estimateHandlers(backend));
  renderBillingPage(<EstimatesPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? ESTIMATES,
    path: ESTIMATES,
  });
  return backend;
}

const lists = (backend: EstimateBackend) => estimateCalls(backend, 'GET', '/estimates');

const table = async () => {
  const element = await screen.findByRole('table', { name: 'Estimates' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

/** Opens the estimate in the nth row of the list and returns its dialog. */
async function openRow(user: ReturnType<typeof userEvent.setup>, index: number, name: string) {
  const rows = rowsOf(await table());
  await user.click(rows[index] as HTMLElement);
  return screen.findByRole('dialog', { name });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the estimate list', () => {
  it('lists every estimate with the status tabs counting them', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.has('status')).toBe(false);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Draft');
    expect(rows[0]).toHaveTextContent('Harbour & Co');
    expect(rows[0]).toHaveTextContent('Year-end accounts');
    expect(rows[0]).toHaveTextContent('30/11/2026');
    expect(rows[0]).toHaveTextContent('£240.00');
    expect(rows[1]).toHaveTextContent('EST-00001');
    expect(rows[1]).toHaveTextContent('Brightside Bakery Ltd');
    expect(rows[1]).toHaveTextContent('01/10/2026');
    expect(rows[1]).toHaveTextContent('31/10/2026');
    expect(rows[1]).toHaveTextContent('£120.00');
    expect(rows[1]).toHaveTextContent('Sent');
    expect(rows[2]).toHaveTextContent('Accepted');
    expect(rows[3]).toHaveTextContent('Declined');
    expect(rows[4]).toHaveTextContent('Expired');

    expect(await screen.findByRole('tab', { name: /^All\s*5$/ })).toBeInTheDocument();
    for (const label of ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired']) {
      expect(screen.getByRole('tab', { name: new RegExp(`^${label}\\s*1$`) })).toBeInTheDocument();
    }
    expect(await screen.findByText(/Open estimates/)).toHaveTextContent('£120.00');
  });

  it('narrows to one status from its tab', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(await screen.findByRole('tab', { name: /^Sent/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.getAll('status')).toEqual(['sent']));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Estimates' }))).toHaveLength(1),
    );
    expect(rowsOf(screen.getByRole('table', { name: 'Estimates' }))[0]).toHaveTextContent(
      'EST-00001',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('tab=sent');

    await user.click(screen.getByRole('tab', { name: /^Expired/ }));
    await waitFor(() =>
      expect(lists(backend).at(-1)?.params?.getAll('status')).toEqual(['expired']),
    );
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Estimates' }))[0]).toHaveTextContent(
        'EST-00004',
      ),
    );
  });

  it('searches by number, reference or client', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.type(screen.getByLabelText('Search estimates'), 'bakery');

    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('q')).toBe('bakery'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Estimates' }))).toHaveLength(1),
    );
    const summaries = estimateCalls(backend, 'GET', '/estimates/summary');
    await waitFor(() => expect(summaries.at(-1)?.params?.get('q')).toBe('bakery'));
  });

  it('filters by client', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter estimates' });
    await user.type(within(panel).getByRole('combobox', { name: 'Client' }), 'Harb');
    await user.click(await within(panel).findByRole('option', { name: /Harbour & Co/ }));

    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('client_id')).toBe('c-harbour'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Estimates' }))).toHaveLength(2),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('client=c-harbour');
  });

  it('says when there are no estimates, and when the filters hide them all', async () => {
    setup({ estimates: [] });
    expect(await screen.findByText('No estimates yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New estimate' }).length).toBeGreaterThan(0);
  });

  it('offers to clear filters that match nothing', async () => {
    const user = userEvent.setup();
    setup({ estimates: [estimateOf()] }, { route: `${ESTIMATES}?tab=declined` });
    expect(await screen.findByText('No estimates match')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('table', { name: 'Estimates' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('tab='));
  });

  it('explains a failed load and tries again', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /estimates': { status: 500, code: 'INTERNAL_ERROR', message: 'Boom.' } },
    });
    expect(await screen.findByText('Could not load the estimates')).toBeInTheDocument();

    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await table()).toBeInTheDocument();
  });

  it('refuses a person who may not read estimates', async () => {
    setup({}, { permissions: ['organization.read', 'invoice.read'] });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('raising an estimate', () => {
  it('creates a draft with the lines as typed', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'New estimate' }));
    const dialog = await screen.findByRole('dialog', { name: 'New estimate' });
    await user.type(within(dialog).getByRole('combobox', { name: 'Client' }), 'Harb');
    await user.click(await within(dialog).findByRole('option', { name: /Harbour & Co/ }));
    await user.type(within(dialog).getByLabelText('Reference (optional)'), 'Audit 2027');
    fireEvent.change(within(dialog).getByLabelText('Expires on (optional)'), {
      target: { value: '2026-12-31' },
    });
    await user.type(within(dialog).getByLabelText('Notes (optional)'), 'Fixed fee');

    const line = within(within(dialog).getByRole('group', { name: 'Line 1' }));
    await user.type(line.getByLabelText('Description'), 'Audit fee');
    await user.clear(line.getByLabelText('Quantity'));
    await user.type(line.getByLabelText('Quantity'), '2');
    await user.type(line.getByLabelText('Unit price (£)'), '150');
    expect(within(dialog).getByText(/priced with VAT when the document is saved/)).toBeVisible();
    await line.findByRole('option', { name: /Zero/ });
    await user.selectOptions(line.getByLabelText('VAT code'), 'vat-zero');
    expect(line.getByText('Line total £300.00 before VAT')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Totals')).toHaveTextContent('£300.00');

    await user.click(within(dialog).getByRole('button', { name: 'Create estimate' }));

    expect(await screen.findByText('Estimate created')).toBeInTheDocument();
    expect(estimateCalls(backend, 'POST', '/estimates')[0]?.body).toEqual({
      client_id: 'c-harbour',
      expiry_date: '2026-12-31',
      reference: 'Audit 2027',
      notes: 'Fixed fee',
      lines: [
        {
          description: 'Audit fee',
          quantity: '2.00',
          unit_amount: 15000,
          vat_rate_id: 'vat-zero',
        },
      ],
    });
    const detail = await screen.findByRole('dialog', { name: 'Draft estimate' });
    expect(detail).toHaveTextContent('Audit fee');
    expect(within(detail).getByLabelText('Totals')).toHaveTextContent('£300.00');
  });

  it('adds and removes lines and keeps at least one', async () => {
    const user = userEvent.setup();
    setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'New estimate' }));
    const dialog = await screen.findByRole('dialog', { name: 'New estimate' });
    expect(within(dialog).getByRole('button', { name: 'Remove line 1' })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: 'Add a line' }));
    expect(within(dialog).getByRole('group', { name: 'Line 2' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Remove line 2' }));
    expect(within(dialog).queryByRole('group', { name: 'Line 2' })).not.toBeInTheDocument();
  });

  it('checks the form before it asks the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'New estimate' }));
    const dialog = await screen.findByRole('dialog', { name: 'New estimate' });
    await user.click(within(dialog).getByRole('button', { name: 'Create estimate' }));

    expect(await within(dialog).findByText('Choose the client')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a description')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Enter an amount such as 120.00 (negative for a discount)'),
    ).toBeInTheDocument();
    expect(estimateCalls(backend, 'POST', '/estimates')).toHaveLength(0);
  });

  it('shows what the API refused in the form', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /estimates': {
          status: 409,
          code: 'ESTIMATE_EMPTY',
          message: 'An estimate needs at least one line.',
        },
      },
    });
    await table();

    await user.click(screen.getByRole('button', { name: 'New estimate' }));
    const dialog = await screen.findByRole('dialog', { name: 'New estimate' });
    await user.type(within(dialog).getByRole('combobox', { name: 'Client' }), 'Harb');
    await user.click(await within(dialog).findByRole('option', { name: /Harbour & Co/ }));
    const line = within(within(dialog).getByRole('group', { name: 'Line 1' }));
    await user.type(line.getByLabelText('Description'), 'Audit fee');
    await user.type(line.getByLabelText('Unit price (£)'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Create estimate' }));

    expect(await within(dialog).findByText('An estimate needs at least one line.')).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'New estimate' })).toBeInTheDocument();
  });

  it('hides the writing actions from a person who can only read', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: READ_ONLY });
    await table();
    expect(screen.queryByRole('button', { name: 'New estimate' })).not.toBeInTheDocument();

    const dialog = await openRow(user, 0, 'Draft estimate');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    for (const name of ['Edit', 'Delete', 'Mark as sent', 'Accept', 'Decline']) {
      expect(within(dialog).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

describe('one estimate', () => {
  it('shows the lines and totals of a sent estimate and what can be done with it', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openRow(user, 1, 'Estimate EST-00001');

    expect(dialog).toHaveTextContent('Brightside Bakery Ltd (C0005)');
    const lines = await within(dialog).findByRole('table', { name: 'Lines of the estimate' });
    expect(within(lines).getAllByRole('row')).toHaveLength(2);
    expect(lines).toHaveTextContent('Payroll set-up');
    expect(lines).toHaveTextContent('£100.00');
    expect(lines).toHaveTextContent('20%');
    expect(within(dialog).getByLabelText('Totals')).toHaveTextContent('£120.00');
    for (const name of ['Accept', 'Decline', 'Convert to invoice']) {
      expect(within(dialog).getByRole('button', { name })).toBeInTheDocument();
    }
    for (const name of ['Edit', 'Delete', 'Mark as sent']) {
      expect(within(dialog).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('notes an estimate past its expiry date', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openRow(user, 4, 'Estimate EST-00004');
    expect(
      await within(dialog).findByText('The expiry date of this estimate has passed.'),
    ).toBeInTheDocument();
  });

  it('explains a failed load of the estimate', async () => {
    const user = userEvent.setup();
    setup({
      refusals: { 'GET /estimates/id': { status: 500, code: 'INTERNAL_ERROR', message: 'Boom.' } },
    });
    const rows = rowsOf(await table());
    await user.click(rows[0] as HTMLElement);
    expect(await screen.findByText('Could not load the estimate')).toBeInTheDocument();
  });

  it('numbers a draft and marks it as sent after a confirmation', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 0, 'Draft estimate');

    await user.click(await within(dialog).findByRole('button', { name: 'Mark as sent' }));
    const confirm = await screen.findByRole('dialog', { name: 'Mark as sent?' });
    expect(confirm).toHaveTextContent('It is not emailed from here');
    await user.click(within(confirm).getByRole('button', { name: 'Mark as sent' }));

    expect(await screen.findByText('Estimate EST-00005 marked as sent')).toBeInTheDocument();
    expect(estimateCalls(backend, 'POST', '/estimates/est-1/send')[0]?.body).toEqual({});
    const sent = await screen.findByRole('dialog', { name: 'Estimate EST-00005' });
    expect(await within(sent).findByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(within(sent).queryByRole('button', { name: 'Mark as sent' })).not.toBeInTheDocument();
  });

  it('keeps the confirmation open and says why a send was refused', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /estimates/send': {
          status: 409,
          code: 'ESTIMATE_EMPTY',
          message: 'The estimate has no lines to send.',
        },
      },
    });
    const dialog = await openRow(user, 0, 'Draft estimate');
    await user.click(await within(dialog).findByRole('button', { name: 'Mark as sent' }));
    const confirm = await screen.findByRole('dialog', { name: 'Mark as sent?' });
    await user.click(within(confirm).getByRole('button', { name: 'Mark as sent' }));

    expect(await within(confirm).findByText('The estimate has no lines to send.')).toBeVisible();
  });

  it('records that the client accepted', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 1, 'Estimate EST-00001');

    await user.click(await within(dialog).findByRole('button', { name: 'Accept' }));

    expect(await screen.findByText('Estimate accepted')).toBeInTheDocument();
    expect(estimateCalls(backend, 'POST', '/estimates/est-2/accept')).toHaveLength(1);
    await waitFor(() => expect(dialog).toHaveTextContent('Accepted'));
    expect(within(dialog).queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Estimates' }))[1]).toHaveTextContent(
        'Accepted',
      ),
    );
  });

  it('records that the client declined', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 1, 'Estimate EST-00001');

    await user.click(await within(dialog).findByRole('button', { name: 'Decline' }));

    expect(await screen.findByText('Estimate declined')).toBeInTheDocument();
    expect(estimateCalls(backend, 'POST', '/estimates/est-2/decline')).toHaveLength(1);
    await waitFor(() => expect(dialog).toHaveTextContent('Declined'));
  });

  it('shows the API’s refusal when an answer is not allowed', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /estimates/accept': {
          status: 409,
          code: 'ESTIMATE_NOT_SENT',
          message: 'Only a sent estimate can be answered.',
        },
      },
    });
    const dialog = await openRow(user, 1, 'Estimate EST-00001');
    await user.click(await within(dialog).findByRole('button', { name: 'Accept' }));

    expect(await within(dialog).findByText('Only a sent estimate can be answered.')).toBeVisible();
  });

  it('converts an accepted estimate into a draft invoice and links to it', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 2, 'Estimate EST-00002');

    await user.click(await within(dialog).findByRole('button', { name: 'Convert to invoice' }));
    const confirm = await screen.findByRole('dialog', { name: 'Convert to an invoice?' });
    expect(confirm).toHaveTextContent('nothing is issued automatically');
    await user.click(within(confirm).getByRole('button', { name: 'Convert to invoice' }));

    expect(await screen.findByText('Draft invoice created')).toBeInTheDocument();
    expect(estimateCalls(backend, 'POST', '/estimates/est-3/convert')).toHaveLength(1);
    const converted = await screen.findByRole('dialog', { name: 'Estimate EST-00002' });
    const link = await within(converted).findByRole('link', { name: 'View the draft invoice' });
    expect(link).toHaveAttribute('href', '/acme/billing/invoices/inv-from-est');
    expect(within(converted).queryByRole('button', { name: 'Convert to invoice' })).toBeNull();

    await user.click(link);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/acme/billing/invoices/inv-from-est',
      ),
    );
  });

  it('says why a conversion was refused', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /estimates/convert': {
          status: 409,
          code: 'ESTIMATE_ALREADY_CONVERTED',
          message: 'This estimate is already an invoice.',
        },
      },
    });
    const dialog = await openRow(user, 2, 'Estimate EST-00002');
    await user.click(await within(dialog).findByRole('button', { name: 'Convert to invoice' }));
    const confirm = await screen.findByRole('dialog', { name: 'Convert to an invoice?' });
    await user.click(within(confirm).getByRole('button', { name: 'Convert to invoice' }));

    expect(await within(confirm).findByText('This estimate is already an invoice.')).toBeVisible();
  });

  it('does not offer the conversion without the right to create invoices', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: NO_INVOICE });
    const dialog = await openRow(user, 1, 'Estimate EST-00001');

    expect(await within(dialog).findByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Convert to invoice' })).toBeNull();
  });

  it('changes the header of a draft and sends only what changed', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 0, 'Draft estimate');

    await user.click(await within(dialog).findByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit estimate' });
    expect(within(form).getByLabelText('Reference (optional)')).toHaveValue('Year-end accounts');
    expect(within(form).getByLabelText('Expires on (optional)')).toHaveValue('2026-11-30');
    const line = within(within(form).getByRole('group', { name: 'Line 1' }));
    expect(line.getByLabelText('Description')).toHaveValue('Year-end accounts');
    expect(line.getByLabelText('Unit price (£)')).toHaveValue('200.00');

    const reference = within(form).getByLabelText('Reference (optional)');
    await user.clear(reference);
    await user.type(reference, 'Revised');
    fireEvent.change(within(form).getByLabelText('Expires on (optional)'), {
      target: { value: '' },
    });
    await user.click(within(form).getByRole('button', { name: 'Save estimate' }));

    expect(await screen.findByText('Estimate saved')).toBeInTheDocument();
    expect(estimateCalls(backend, 'PATCH', '/estimates/est-1')[0]?.body).toEqual({
      expiry_date: null,
      reference: 'Revised',
    });
    const back = await screen.findByRole('dialog', { name: 'Draft estimate' });
    expect(back).toHaveTextContent('Revised');
  });

  it('replaces the lines when one of them changes', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 0, 'Draft estimate');

    await user.click(await within(dialog).findByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit estimate' });
    const line = within(within(form).getByRole('group', { name: 'Line 1' }));
    const quantity = line.getByLabelText('Quantity');
    await user.clear(quantity);
    await user.type(quantity, '3');
    await user.click(within(form).getByRole('button', { name: 'Save estimate' }));

    expect(await screen.findByText('Estimate saved')).toBeInTheDocument();
    expect(estimateCalls(backend, 'PATCH', '/estimates/est-1')[0]?.body).toEqual({
      lines: [
        {
          description: 'Year-end accounts',
          quantity: '3.00',
          unit_amount: 20000,
          vat_rate_id: 'vat-std',
        },
      ],
    });
    const back = await screen.findByRole('dialog', { name: 'Draft estimate' });
    await waitFor(() => expect(within(back).getByLabelText('Totals')).toHaveTextContent('£720.00'));
  });

  it('deletes a draft after a confirmation', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openRow(user, 0, 'Draft estimate');

    await user.click(await within(dialog).findByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete draft estimate?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete draft' }));

    expect(await screen.findByText('Draft deleted')).toBeInTheDocument();
    expect(estimateCalls(backend, 'DELETE', '/estimates/est-1')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Estimates' }))).toHaveLength(4),
    );
  });

  it('says why a delete was refused', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'DELETE /estimates/id': {
          status: 409,
          code: 'ESTIMATE_NOT_DRAFT',
          message: 'Only a draft estimate can be deleted.',
        },
      },
    });
    const dialog = await openRow(user, 0, 'Draft estimate');
    await user.click(await within(dialog).findByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete draft estimate?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete draft' }));

    expect(await within(confirm).findByText('Only a draft estimate can be deleted.')).toBeVisible();
  });
});
