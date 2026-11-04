import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { orgApiPath } from '@/test/renderInOrg';
import { apiPath, fail, ok, server } from '@/test/server';

import { harbour } from '../test/fixtures';
import { serviceOptions, vatCodes } from '../test/prepare';
import { BILLING, renderBillingPage } from '../test/render';
import type { InvoiceDetail, InvoiceLine } from '../types';
import InvoiceDetailPage from './InvoiceDetailPage';

const INVOICES = `${BILLING}/invoices`;

function line(overrides: Partial<InvoiceLine>): InvoiceLine {
  return {
    id: 'l-x',
    position: 1,
    kind: 'manual',
    description: 'Line',
    job_id: null,
    service_id: null,
    quantity: '1.00',
    unit_amount: 0,
    net_amount: 0,
    vat_rate_id: 'vat-std',
    vat_rate_bp: 2000,
    vat_amount: 0,
    gross_amount: 0,
    wip: null,
    is_advance: false,
    advance: null,
    ...overrides,
  };
}

/** Time billed from WIP (2.5 hours, £300), a licence (£50) and a discount (-£10), all at 20%. */
const lines = (): InvoiceLine[] => [
  line({
    id: 'l-1',
    kind: 'time',
    description: 'Bookkeeping 2026/27',
    quantity: '2.50',
    unit_amount: 12000,
    net_amount: 30000,
    vat_amount: 6000,
    wip: {
      item_count: 2,
      time_entry_ids: ['t-1', 't-2'],
      disbursement_ids: [],
      wip_value: 30000,
      billed_value: 30000,
      adjustment: 0,
    },
  }),
  line({
    id: 'l-2',
    position: 2,
    description: 'Software licence',
    unit_amount: 5000,
    net_amount: 5000,
    vat_amount: 1000,
    service_id: 'svc-advice',
  }),
  line({
    id: 'l-3',
    position: 3,
    description: 'Old discount',
    unit_amount: -1000,
    net_amount: -1000,
    vat_amount: -200,
  }),
];

function draft(draftLines: InvoiceLine[], overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: 'inv-1',
    number: null,
    status: 'draft',
    display_status: 'draft',
    client: harbour,
    issue_date: null,
    due_date: null,
    reference: null,
    currency: 'GBP',
    net_total: 0,
    vat_total: 0,
    gross_total: 0,
    paid_total: 0,
    credited_total: 0,
    balance: 0,
    approval_required: false,
    sent_at: null,
    created_at: '2026-10-01T09:00:00Z',
    notes: null,
    issued_at: null,
    issued_by: null,
    voided_at: null,
    void_reason: null,
    deleted_at: null,
    email_recipients: [],
    created_by: null,
    approvals: [],
    can_approve: false,
    lines: draftLines,
    vat_summary: [],
    wip: { wip_value: 0, billed_value: 0, adjustment: 0 },
    payments: [],
    credit_notes: [],
    ...overrides,
  } as unknown as InvoiceDetail;
}

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

/**
 * The invoice page of `invoice`; returns the line requests it makes, in order. Saving answers
 * `reply` when given, else the invoice.
 */
function openInvoice(invoice: InvoiceDetail, reply?: () => Response): Call[] {
  const calls: Call[] = [];
  const record = async (request: Request) => {
    const body: unknown = request.method === 'DELETE' ? undefined : await request.json();
    calls.push({ method: request.method, path: new URL(request.url).pathname, body });
    return reply ? reply() : ok(invoice);
  };
  server.use(
    http.get(orgApiPath('/invoices/inv-1'), () => ok(invoice)),
    http.put(orgApiPath('/invoices/inv-1/lines'), ({ request }) => record(request)),
    http.post(orgApiPath('/invoices/inv-1/lines'), ({ request }) => record(request)),
    http.patch(orgApiPath('/invoices/inv-1/lines/:lineId'), ({ request }) => record(request)),
    http.delete(orgApiPath('/invoices/inv-1/lines/:lineId'), ({ request }) => record(request)),
    http.get(orgApiPath('/vat-rates'), () => ok(vatCodes)),
    http.get(orgApiPath('/services'), () => ok(serviceOptions)),
    http.get(orgApiPath('/clients/:clientId'), () => ok({ ...harbour, default_vat_rate_id: null })),
    http.get(apiPath('/organizations/:organizationId/*'), () => ok([])),
  );
  renderBillingPage(<InvoiceDetailPage />, {
    route: `${INVOICES}/inv-1`,
    path: `${INVOICES}/:invoiceId`,
  });
  return calls;
}

const textbox = (scope: HTMLElement, name: string) =>
  within(scope).getByRole('textbox', { name: new RegExp(`^${name}`) });

describe('the lines of a draft invoice', () => {
  it('edits, adds and removes lines in the grid and saves every change', async () => {
    const user = userEvent.setup();
    const calls = openInvoice(draft(lines()));
    const grid = await screen.findByRole('form', { name: 'Lines of the draft' });
    const table = within(grid).getByRole('table', { name: 'Invoice lines' });
    const totals = within(grid).getByLabelText('Totals');
    // The services have arrived: a saved line shows its own.
    await within(table).findByText('Tax advice');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(totals).toHaveTextContent('Net£340.00VAT£68.00Total£408.00');

    // The line of work keeps its hours and rate; what it bills is typed, against the work.
    const work = within(table).getAllByRole('row')[1] as HTMLElement;
    expect(work).toHaveTextContent('2.50');
    expect(work).toHaveTextContent('£120.00');
    expect(work).toHaveTextContent('billed from 2 WIP items');
    expect(within(grid).queryByRole('textbox', { name: /^Quantity of line 1/ })).toBeNull();
    expect(within(grid).queryByRole('textbox', { name: /^Unit price of line 1/ })).toBeNull();
    expect(textbox(grid, 'Amount to bill of line 1')).toHaveValue('300.00');
    // A saved line keeps its service.
    expect(within(grid).queryByRole('combobox', { name: /^Service of line 2/ })).toBeNull();

    await user.clear(textbox(grid, 'Amount to bill of line 1'));
    await user.type(textbox(grid, 'Amount to bill of line 1'), '250');
    expect(work).toHaveTextContent('Work £300.00, write-off £50.00');

    await user.clear(textbox(grid, 'Quantity of line 2'));
    await user.type(textbox(grid, 'Quantity of line 2'), '3');
    await user.clear(textbox(grid, 'Unit price of line 2'));
    await user.type(textbox(grid, 'Unit price of line 2'), '60');
    await user.selectOptions(
      within(grid).getByRole('combobox', { name: /^VAT code of line 2/ }),
      'vat-zero',
    );
    await user.click(within(grid).getByRole('button', { name: 'Remove line 3' }));
    await user.click(within(grid).getByRole('button', { name: 'Add row' }));
    await user.type(textbox(grid, 'Description of line 3'), 'Filing fee');
    await user.type(textbox(grid, 'Unit price of line 3'), '34');

    // £250 + £180 + £34; VAT £50 + £0 + £6.80.
    expect(totals).toHaveTextContent('Net£464.00VAT£56.80Total£520.80');
    // The draft is issued as saved: not before the changes are saved or discarded.
    expect(screen.getByRole('button', { name: 'Issue invoice' })).toBeDisabled();
    expect(calls).toHaveLength(0);

    await user.click(within(grid).getByRole('button', { name: 'Save lines' }));
    expect(await screen.findByText('Lines saved')).toBeInTheDocument();
    // One request, all or nothing: the lines kept with their changes (l-3 is not listed, so it
    // is removed) and the new ones.
    expect(
      calls.map((call) => `${call.method} ${call.path.replace(/^.*\/invoices\//, '')}`),
    ).toEqual(['PUT inv-1/lines']);
    expect(calls[0]?.body).toEqual({
      lines: [
        { id: 'l-1', net_amount: 25000 },
        { id: 'l-2', quantity: '3.00', unit_amount: 6000, vat_rate_id: 'vat-zero' },
      ],
      new_lines: [{ description: 'Filing fee', quantity: '1.00', unit_amount: 3400 }],
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Issue invoice' })).toBeEnabled(),
    );
  });

  it('keeps the code a line was saved with, and names the code "Default" would give it', async () => {
    const user = userEvent.setup();
    // Saved at Standard; its service's code is Zero (APT63).
    const saved = line({
      id: 'l-9',
      description: 'Monthly bookkeeping',
      unit_amount: 10000,
      net_amount: 10000,
      vat_amount: 2000,
      service_id: 'svc-books',
    });
    const calls = openInvoice(draft([saved]));
    const grid = await screen.findByRole('form', { name: 'Lines of the draft' });
    const vat = within(grid).getByRole('combobox', { name: /^VAT code of line 1/ });
    const row = () => within(grid).getAllByRole('row')[1] as HTMLElement;
    await within(grid).findByText('Bookkeeping');
    expect(vat).toHaveValue('vat-std');
    expect(row()).toHaveTextContent('£20.0020%Standard');
    expect(row()).not.toHaveTextContent('chosen');
    expect(
      within(vat).getByRole('option', { name: 'Default: Zero (0%), the service’s code' }),
    ).toBeInTheDocument();

    // Rewording the line keeps its code.
    await user.type(textbox(grid, 'Description of line 1'), ' 2026');
    expect(row()).toHaveTextContent('20%Standard');
    await user.selectOptions(vat, '');
    expect(row()).toHaveTextContent('£0.000%Zero, the service’s code');
    await user.click(within(grid).getByRole('button', { name: 'Save lines' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({
      lines: [{ id: 'l-9', description: 'Monthly bookkeeping 2026', vat_rate_id: null }],
      new_lines: [],
    });
  });

  it('makes a saved line typed in fees in advance, line by line', async () => {
    const user = userEvent.setup();
    const calls = openInvoice(draft(lines()));
    const grid = await screen.findByRole('form', { name: 'Lines of the draft' });
    const advance = (line: number) =>
      within(grid).queryByRole('checkbox', { name: `Fees in advance on line ${line}` });

    // A line of work is never fees in advance; a discount cannot be, and says why.
    expect(advance(1)).toBeNull();
    expect(advance(2)).not.toBeChecked();
    expect(advance(3)).toBeDisabled();
    expect(advance(3)).toHaveAccessibleDescription(
      'Only a line of more than zero can be fees in advance',
    );
    await user.click(within(grid).getByRole('button', { name: 'Add row' }));
    await user.type(textbox(grid, 'Description of line 4'), 'Filing fee');
    await user.type(textbox(grid, 'Unit price of line 4'), '34');
    expect(advance(4)).not.toBeChecked();

    await user.click(advance(2) as HTMLElement);
    await user.click(within(grid).getByRole('button', { name: 'Save lines' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({
      lines: [{ id: 'l-1' }, { id: 'l-2', is_advance: true }, { id: 'l-3' }],
      new_lines: [{ description: 'Filing fee', quantity: '1.00', unit_amount: 3400 }],
    });
  });

  it('keeps every change in the grid when the save is refused', async () => {
    const user = userEvent.setup();
    const calls = openInvoice(draft(lines()), () =>
      fail(422, 'INVOICE_TOTAL_NEGATIVE', 'The invoice total cannot be negative.'),
    );
    const grid = await screen.findByRole('form', { name: 'Lines of the draft' });

    await user.click(within(grid).getByRole('button', { name: 'Remove line 1' }));
    await user.click(within(grid).getByRole('button', { name: 'Save lines' }));

    expect(await within(grid).findByText('The invoice total cannot be negative.')).toBeVisible();
    expect(calls.map((call) => call.method)).toEqual(['PUT']);
    // Nothing was saved: the grid still holds the change, to correct or discard.
    expect(within(grid).getAllByRole('row')).toHaveLength(3);
    expect(within(grid).getByText(/Changes not saved yet/)).toBeInTheDocument();
    expect(within(grid).getByRole('button', { name: 'Save lines' })).toBeEnabled();
    expect(within(grid).getByRole('button', { name: 'Discard changes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Issue invoice' })).toBeDisabled();
  });

  it('asks for what each row needs before saving anything', async () => {
    const user = userEvent.setup();
    const calls = openInvoice(draft(lines()));
    const grid = await screen.findByRole('form', { name: 'Lines of the draft' });

    await user.clear(textbox(grid, 'Amount to bill of line 1'));
    await user.clear(textbox(grid, 'Description of line 2'));
    await user.click(within(grid).getByRole('button', { name: 'Add row' }));
    await user.click(within(grid).getByRole('button', { name: 'Save lines' }));

    expect(
      await within(grid).findByText('Enter the amount to bill, such as 120.00 (0 or more)'),
    ).toBeInTheDocument();
    expect(within(grid).getAllByText('Enter a description')).toHaveLength(2);
    expect(
      within(grid).getByText('Enter an amount such as 120.00 (negative for a discount)'),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await user.click(within(grid).getByRole('button', { name: 'Discard changes' }));
    expect(textbox(grid, 'Amount to bill of line 1')).toHaveValue('300.00');
    expect(within(grid).getAllByRole('row')).toHaveLength(4);
    expect(within(grid).getByRole('button', { name: 'Save lines' })).toBeDisabled();
  });

  it('lists every line of a long draft, long descriptions included', async () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      line({
        id: `l-${index + 1}`,
        position: index + 1,
        description: `Monthly bookkeeping, month ${index + 1}: bank reconciliation, VAT records and the management accounts pack with commentary`,
        unit_amount: 10000,
        net_amount: 10000,
        vat_amount: 2000,
      }),
    );
    openInvoice(draft(many));
    const grid = await screen.findByRole('form', { name: 'Lines of the draft' });

    expect(within(grid).getAllByRole('row')).toHaveLength(61);
    expect(textbox(grid, 'Description of line 60')).toHaveValue(
      'Monthly bookkeeping, month 60: bank reconciliation, VAT records and the management accounts pack with commentary',
    );
    expect(within(grid).getByLabelText('Totals')).toHaveTextContent(
      'Net£6,000.00VAT£1,200.00Total£7,200.00',
    );
  });

  it('shows the lines of an issued invoice as they are', async () => {
    openInvoice(draft(lines(), { status: 'issued', display_status: 'issued', number: 'INV-1' }));
    const table = await screen.findByRole('table', { name: 'Invoice lines' });

    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save lines' })).toBeNull();
  });
});
