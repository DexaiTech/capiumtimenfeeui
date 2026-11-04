import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { orgApiPath } from '@/test/renderInOrg';
import { apiPath, ok, server } from '@/test/server';

import { harbour } from '../test/fixtures';
import {
  createPrepareBackend,
  harbourItems,
  postsOf,
  type PrepareBackend,
  prepareHandlers,
  wipOf,
} from '../test/prepare';
import { BILLING, renderBillingPage } from '../test/render';
import type { InvoiceDetail, InvoiceLine, InvoiceLineAdvance } from '../types';
import InvoiceDetailPage from './InvoiceDetailPage';
import PrepareInvoicePage from './PrepareInvoicePage';

const INVOICES = `${BILLING}/invoices`;

/** "Fees in advance 2026/27": £6,000.00 + VAT, with what the assigned work has used of it. */
function advanceLine(advance: Partial<InvoiceLineAdvance> = {}): InvoiceLine {
  return {
    id: 'l-adv',
    position: 1,
    kind: 'manual',
    description: 'Fees in advance 2026/27',
    job_id: null,
    service_id: null,
    quantity: '1.00',
    unit_amount: 600000,
    net_amount: 600000,
    vat_rate_id: 'vat-std',
    vat_rate_bp: 2000,
    vat_amount: 120000,
    gross_amount: 720000,
    wip: null,
    is_advance: true,
    advance: {
      amount: 600000,
      used: 0,
      remaining: 600000,
      wip_value: 0,
      written_off: 0,
      items: [],
      ...advance,
    },
  };
}

function detail(lines: InvoiceLine[], overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: 'inv-1',
    number: 'INV-00010',
    status: 'issued',
    display_status: 'paid',
    client: harbour,
    issue_date: '2026-04-01',
    due_date: '2026-05-01',
    reference: null,
    currency: 'GBP',
    net_total: 600000,
    vat_total: 120000,
    gross_total: 720000,
    paid_total: 720000,
    credited_total: 0,
    balance: 0,
    approval_required: false,
    sent_at: null,
    created_at: '2026-04-01T09:00:00Z',
    notes: null,
    issued_at: '2026-04-01T09:00:00Z',
    issued_by: null,
    voided_at: null,
    void_reason: null,
    deleted_at: null,
    email_recipients: [],
    created_by: null,
    approvals: [],
    can_approve: false,
    lines,
    vat_summary: [{ vat_rate_bp: 2000, net: 600000, vat: 120000 }],
    wip: { wip_value: 0, billed_value: 0, adjustment: 0 },
    payments: [],
    credit_notes: [],
    ...overrides,
  } as unknown as InvoiceDetail;
}

interface Posted {
  path: string;
  body: unknown;
}

/** The invoice page of `invoice`, with Harbour's WIP to assign; returns what was posted. */
function openInvoice(invoice: InvoiceDetail): Posted[] {
  const posted: Posted[] = [];
  const record = async (request: Request) => {
    posted.push({ path: new URL(request.url).pathname, body: await request.json() });
    return ok(invoice);
  };
  server.use(
    http.get(orgApiPath('/invoices/inv-1'), () => ok(invoice)),
    http.get(orgApiPath('/clients/:clientId/wip'), () => ok(wipOf(harbourItems()))),
    http.post(orgApiPath('/invoices/inv-1/lines/:lineId/assign'), ({ request }) => record(request)),
    http.post(orgApiPath('/invoices/inv-1/lines/:lineId/unassign'), ({ request }) =>
      record(request),
    ),
    http.post(orgApiPath('/invoices/inv-1/lines'), ({ request }) => record(request)),
    http.get(apiPath('/organizations/:organizationId/*'), () => ok([])),
  );
  renderBillingPage(<InvoiceDetailPage />, {
    route: `${INVOICES}/inv-1`,
    path: `${INVOICES}/:invoiceId`,
  });
  return posted;
}

/** The preparation of Harbour's invoice at its lines, after "Bill fees in advance". */
async function openAdvanceGrid(backend: PrepareBackend): Promise<HTMLElement> {
  const user = userEvent.setup();
  server.use(...prepareHandlers(backend));
  renderBillingPage(<PrepareInvoicePage />, {
    route: `${BILLING}/prepare?client=${harbour.id}`,
    path: `${BILLING}/prepare`,
  });
  await user.click(await screen.findByRole('button', { name: 'Bill fees in advance' }));
  return screen.findByRole('form', { name: 'Lines to draft' });
}

/** From the lines to the draft: "Dates and notes", then "Save as draft". */
async function saveDraft(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Dates and notes' }));
  await user.click(await screen.findByRole('button', { name: 'Save as draft' }));
}

describe('billing fees in advance', () => {
  it('drafts an advance invoice on several lines from the preparation', async () => {
    const user = userEvent.setup();
    const backend = createPrepareBackend();
    const panel = await openAdvanceGrid(backend);
    const field = (name: string) => within(panel).getByRole('textbox', { name: new RegExp(name) });
    const totals = within(panel).getByLabelText('Totals');
    // Nothing chosen to bill: the lines typed in are fees in advance.
    expect(within(panel).getByRole('checkbox', { name: /Fees in advance/ })).toBeChecked();
    expect(field('Description of line 1')).toHaveValue('Fees in advance');

    await user.clear(field('Description of line 1'));
    await user.type(field('Description of line 1'), 'Accounts 2026/27');
    await user.type(field('Unit price of line 1'), '3000');
    // "Default" charges the practice's standard code.
    expect(totals).toHaveTextContent('Net£3,000.00VAT£600.00Total£3,600.00');

    await user.click(within(panel).getByRole('button', { name: 'Add row' }));
    await user.type(field('Description of line 2'), 'Payroll 2026/27');
    await user.clear(field('Quantity of line 2'));
    await user.type(field('Quantity of line 2'), '12');
    await user.type(field('Unit price of line 2'), '125');
    await user.click(within(panel).getByRole('button', { name: 'Add row' }));
    await user.type(field('Description of line 3'), 'Filing fees');
    await user.clear(field('Quantity of line 3'));
    await user.type(field('Quantity of line 3'), '2.5');
    await user.type(field('Unit price of line 3'), '33.33');
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: /VAT code of line 3/ }),
      'vat-zero',
    );

    const rows = within(panel).getAllByRole('row');
    expect(rows[2]).toHaveTextContent('£300.00');
    expect(rows[2]).toHaveTextContent('£1,500.00');
    // 2.5 x £33.33 = £83.325, rounded as the API does.
    expect(rows[3]).toHaveTextContent('£83.33');
    expect(totals).toHaveTextContent('Net£4,583.33VAT£900.00Total£5,483.33');

    await user.click(within(panel).getByRole('button', { name: 'Remove line 3' }));
    expect(within(panel).queryByRole('textbox', { name: /line 3/ })).toBeNull();
    expect(totals).toHaveTextContent('Net£4,500.00VAT£900.00Total£5,400.00');

    await saveDraft(user);
    await waitFor(() => expect(postsOf(backend, '/invoices')).toHaveLength(1));
    const body = postsOf(backend, '/invoices')[0]?.body;
    expect(body).toEqual(
      expect.objectContaining({
        client_id: harbour.id,
        time_entry_ids: [],
        disbursement_ids: [],
        overrides: [],
        manual_lines: [
          {
            description: 'Accounts 2026/27',
            quantity: '1.00',
            unit_amount: 300000,
            is_advance: true,
          },
          {
            description: 'Payroll 2026/27',
            quantity: '12.00',
            unit_amount: 12500,
            is_advance: true,
          },
        ],
      }),
    );
    expect(body).not.toHaveProperty('advance');
    expect(body).not.toHaveProperty('advance_lines');
    expect(await screen.findByTestId('location')).toHaveTextContent(`${INVOICES}/inv-new-1`);
  });

  it('fills an advance line from the service chosen for it', async () => {
    const user = userEvent.setup();
    const backend = createPrepareBackend();
    const panel = await openAdvanceGrid(backend);
    const field = (name: string) => within(panel).getByRole('textbox', { name: new RegExp(name) });
    const service = (line: number) =>
      within(panel).getByRole('combobox', { name: new RegExp(`Service of line ${line}`) });
    const totals = within(panel).getByLabelText('Totals');

    // The service's wording replaces the starting one, its fee fills the empty price, and its
    // zero-rated code applies (the client has no code of its own).
    await within(panel).findByRole('option', { name: 'Bookkeeping' });
    await user.selectOptions(service(1), 'svc-books');
    // Its invoice wording, not its name.
    expect(field('Description of line 1')).toHaveValue('Monthly bookkeeping 2026/27');
    expect(field('Unit price of line 1')).toHaveValue('1200.00');
    expect(totals).toHaveTextContent('Net£1,200.00VAT£0.00Total£1,200.00');

    // "+ Row" adds a row; a price already typed is kept.
    const addRow = within(panel).getByRole('button', { name: 'Add row' });
    expect(addRow).toHaveTextContent('Row');
    await user.click(addRow);
    await user.type(field('Unit price of line 2'), '500');
    await user.selectOptions(service(2), 'svc-books');
    expect(field('Description of line 2')).toHaveValue('Monthly bookkeeping 2026/27');
    expect(field('Unit price of line 2')).toHaveValue('500');
    // Another service rewords a line that still has the previous service's wording; without
    // invoice wording of its own, a service gives its name.
    await user.selectOptions(service(2), 'svc-advice');
    expect(field('Description of line 2')).toHaveValue('Tax advice');
    expect(field('Unit price of line 2')).toHaveValue('500');
    // No code on the service: the practice's standard rate.
    expect(totals).toHaveTextContent('Net£1,700.00VAT£100.00Total£1,800.00');

    // Wording typed by the person stays.
    await user.clear(field('Description of line 1'));
    await user.type(field('Description of line 1'), 'Books 2026/27');
    await user.selectOptions(service(1), 'svc-advice');
    expect(field('Description of line 1')).toHaveValue('Books 2026/27');
    await user.selectOptions(service(1), 'svc-books');

    await saveDraft(user);
    await waitFor(() => expect(postsOf(backend, '/invoices')).toHaveLength(1));
    expect(postsOf(backend, '/invoices')[0]?.body).toEqual(
      expect.objectContaining({
        manual_lines: [
          {
            description: 'Books 2026/27',
            quantity: '1.00',
            unit_amount: 120000,
            service_id: 'svc-books',
            is_advance: true,
          },
          {
            description: 'Tax advice',
            quantity: '1.00',
            unit_amount: 50000,
            service_id: 'svc-advice',
            is_advance: true,
          },
        ],
      }),
    );
  });

  // APT63: the practice default is Flat VAT (7.5%) and the service carries Standard (20%).
  const flatPractice = (init: Partial<PrepareBackend> = {}) =>
    createPrepareBackend({
      vat: [
        {
          id: 'vat-std',
          name: 'Standard',
          code: 'standard',
          rate_bp: 2000,
          is_default: false,
          is_archived: false,
        },
        {
          id: 'vat-flat',
          name: 'Flat VAT',
          code: 'standard',
          rate_bp: 750,
          is_default: true,
          is_archived: false,
        },
        {
          id: 'vat-zero',
          name: 'Zero',
          code: 'zero',
          rate_bp: 0,
          is_default: false,
          is_archived: false,
        },
      ],
      services: [
        {
          id: 'svc-ct',
          name: 'Corporation tax return',
          default_fee: null,
          vat_rate_id: 'vat-std',
          invoice_description: null,
        },
      ],
      ...init,
    });

  it('names the code "Default" charges on an advance line, and keeps a chosen one', async () => {
    const user = userEvent.setup();
    const backend = flatPractice();
    const panel = await openAdvanceGrid(backend);
    const vat = within(panel).getByRole('combobox', { name: /VAT code of line 1/ });
    const totals = within(panel).getByLabelText('Totals');
    const row = () => within(panel).getAllByRole('row')[1] as HTMLElement;
    await user.type(within(panel).getByRole('textbox', { name: /Unit price of line 1/ }), '100');

    // No service: the practice default.
    expect(vat).toHaveValue('');
    expect(
      within(vat).getByRole('option', { name: 'Default: Flat VAT (7.5%), the practice default' }),
    ).toBeInTheDocument();
    expect(row()).toHaveTextContent('Flat VAT, the practice default');
    expect(totals).toHaveTextContent('Net£100.00VAT£7.50Total£107.50');

    // A service with a code of its own: the service's code.
    await within(panel).findByRole('option', { name: 'Corporation tax return' });
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: /Service of line 1/ }),
      'svc-ct',
    );
    expect(
      within(vat).getByRole('option', { name: 'Default: Standard (20%), the service’s code' }),
    ).toBeInTheDocument();
    expect(row()).toHaveTextContent('Standard, the service’s code');
    expect(totals).toHaveTextContent('Net£100.00VAT£20.00Total£120.00');

    // A code chosen for the line is charged and sent as chosen.
    await user.selectOptions(vat, 'vat-flat');
    expect(row()).toHaveTextContent('Flat VAT, chosen');
    expect(totals).toHaveTextContent('Net£100.00VAT£7.50Total£107.50');
    await saveDraft(user);
    await waitFor(() => expect(postsOf(backend, '/invoices')).toHaveLength(1));
    expect(postsOf(backend, '/invoices')[0]?.body).toEqual(
      expect.objectContaining({
        manual_lines: [
          {
            description: 'Corporation tax return',
            quantity: '1.00',
            unit_amount: 10000,
            vat_rate_id: 'vat-flat',
            service_id: 'svc-ct',
            is_advance: true,
          },
        ],
      }),
    );
  });

  it('gives an advance line the client’s own code before its service’s', async () => {
    const user = userEvent.setup();
    const panel = await openAdvanceGrid(flatPractice({ clientVatId: 'vat-zero' }));
    const vat = within(panel).getByRole('combobox', { name: /VAT code of line 1/ });
    await user.type(within(panel).getByRole('textbox', { name: /Unit price of line 1/ }), '100');
    await within(panel).findByRole('option', { name: 'Corporation tax return' });
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: /Service of line 1/ }),
      'svc-ct',
    );
    expect(
      within(vat).getByRole('option', { name: 'Default: Zero (0%), the client’s code' }),
    ).toBeInTheDocument();
    expect(within(panel).getByLabelText('Totals')).toHaveTextContent('VAT£0.00');
  });

  it('asks for a description, a quantity and a price on every advance line', async () => {
    const user = userEvent.setup();
    const backend = createPrepareBackend();
    const panel = await openAdvanceGrid(backend);

    await user.clear(within(panel).getByRole('textbox', { name: /Description of line 1/ }));
    await user.clear(within(panel).getByRole('textbox', { name: /Quantity of line 1/ }));
    await user.type(within(panel).getByRole('textbox', { name: /Quantity of line 1/ }), '0');
    await user.type(within(panel).getByRole('textbox', { name: /Unit price of line 1/ }), '0');
    await user.click(within(panel).getByRole('button', { name: 'Add row' }));
    await user.click(within(panel).getByRole('button', { name: 'Dates and notes' }));

    expect(await within(panel).findAllByText('Enter a description')).toHaveLength(2);
    expect(within(panel).getByText('Enter a quantity such as 1 or 2.5')).toBeInTheDocument();
    expect(within(panel).getAllByText('Enter the price before VAT, such as 6000.00')).toHaveLength(
      2,
    );
    // Unticked, the lines are ordinary fees: a discount may be negative, a price nothing.
    await user.click(within(panel).getByRole('checkbox', { name: /Fees in advance/ }));
    await user.type(within(panel).getByRole('textbox', { name: /Unit price of line 2/ }), '-50');
    await user.click(within(panel).getByRole('button', { name: 'Dates and notes' }));
    await waitFor(() =>
      expect(within(panel).queryByText('Enter the price before VAT, such as 6000.00')).toBeNull(),
    );
    expect(within(panel).getAllByText('Enter a description')).toHaveLength(2);
    expect(postsOf(backend, '/invoices')).toHaveLength(0);
  });

  it('shows the line grid for a client with nothing to bill', async () => {
    const user = userEvent.setup();
    const backend = createPrepareBackend({ wip: { [harbour.id]: wipOf([]) } });
    server.use(...prepareHandlers(backend));
    renderBillingPage(<PrepareInvoicePage />, {
      route: `${BILLING}/prepare?client=${harbour.id}`,
      path: `${BILLING}/prepare`,
    });

    expect(await screen.findByText('Nothing to bill')).toBeInTheDocument();
    expect(screen.getByText(/You can still add line items/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add line items' }));
    const panel = await screen.findByRole('form', { name: 'Lines to draft' });
    expect(within(panel).getByRole('table', { name: 'Lines of the invoice' })).toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: /Description of line 1/ })).toHaveValue(
      'Fees in advance',
    );
    expect(within(panel).getByRole('checkbox', { name: /Fees in advance/ })).toBeChecked();
  });

  it('marks a line added to a draft as fees in advance', async () => {
    const user = userEvent.setup();
    const posted = openInvoice(
      detail([], {
        number: null,
        status: 'draft',
        display_status: 'draft',
        issue_date: null,
        due_date: null,
        net_total: 0,
        vat_total: 0,
        gross_total: 0,
        paid_total: 0,
        balance: 0,
        vat_summary: [],
      }),
    );

    const grid = await screen.findByRole('form', { name: 'Lines of the draft' });
    await user.click(within(grid).getByRole('button', { name: 'Add row' }));
    await user.type(
      within(grid).getByRole('textbox', { name: /Description of line 1/ }),
      'Fees in advance',
    );
    await user.type(within(grid).getByRole('textbox', { name: /Unit price of line 1/ }), '6000');
    await user.click(within(grid).getByRole('checkbox', { name: /Fees in advance/ }));
    await user.click(within(grid).getByRole('button', { name: 'Save lines' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.path).toMatch(/\/invoices\/inv-1\/lines$/);
    expect(posted[0]?.body).toEqual({
      description: 'Fees in advance',
      quantity: '1.00',
      unit_amount: 600000,
      is_advance: true,
    });
  });

  it('assigns the chosen time to the advance and warns of what is beyond it', async () => {
    const user = userEvent.setup();
    const posted = openInvoice(detail([advanceLine({ used: 580000, remaining: 20000 })]));

    const card = await screen.findByLabelText('Use of Fees in advance 2026/27');
    expect(card).toHaveTextContent('£6,000.00');
    expect(card).toHaveTextContent('£200.00');
    await user.click(screen.getByRole('button', { name: 'Assign time' }));

    const dialog = await screen.findByRole('dialog', { name: 'Assign time' });
    await within(dialog).findByRole('checkbox', { name: /Bank reconciliation/ });
    // Time of a fixed-fee job and expense lines are not offered.
    expect(within(dialog).queryByRole('checkbox', { name: /Draft accounts/ })).toBeNull();
    expect(within(dialog).queryByRole('checkbox', { name: /Train to Bath/ })).toBeNull();
    expect(within(dialog).getByRole('checkbox', { name: /Filing fee/ })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('checkbox', { name: /Bank reconciliation/ }));
    expect(dialog).toHaveTextContent(
      '1 item chosen, £180.00 of work. £200.00 of the advance is left.',
    );
    expect(within(dialog).queryByRole('note')).toBeNull();
    await user.click(within(dialog).getByRole('checkbox', { name: /Payroll queries/ }));
    expect(within(dialog).getByRole('note')).toHaveTextContent(
      '£100.00 of this work is beyond the advance and will be written off.',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Assign to the advance' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.path).toMatch(/\/invoices\/inv-1\/lines\/l-adv\/assign$/);
    expect(posted[0]?.body).toEqual({ time_entry_ids: ['t-1', 't-2'], disbursement_ids: [] });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Assign time' })).not.toBeInTheDocument(),
    );
  });

  it('lists the work assigned, with what is left, and takes an item off again', async () => {
    const user = userEvent.setup();
    const posted = openInvoice(
      detail([
        advanceLine({
          used: 150000,
          remaining: 450000,
          wip_value: 150000,
          items: [
            {
              kind: 'time',
              id: 't-9',
              date: '2026-05-04',
              person: { user_id: 'u-grace', full_name: 'Grace Hopper' },
              description: 'Year-end planning',
              minutes: 600,
              hours: '10.00',
              wip_value: 150000,
              billed_value: 150000,
              assigned_on: '2026-10-01',
            },
          ],
        }),
      ]),
    );

    const figures = await screen.findByLabelText('Use of Fees in advance 2026/27');
    expect(figures).toHaveTextContent('Used£1,500.00');
    expect(figures).toHaveTextContent('Remaining£4,500.00');
    const table = screen.getByRole('table', { name: 'Work assigned to Fees in advance 2026/27' });
    const row = within(table).getByRole('row', { name: /Year-end planning/ });
    expect(row).toHaveTextContent('04/05/2026');
    expect(row).toHaveTextContent('Grace Hopper');
    expect(row).toHaveTextContent('10.00');
    expect(row).toHaveTextContent('£1,500.00');

    await user.click(within(row).getByRole('button', { name: /Take Year-end planning .* off/ }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.path).toMatch(/\/invoices\/inv-1\/lines\/l-adv\/unassign$/);
    expect(posted[0]?.body).toEqual({ time_entry_ids: ['t-9'], disbursement_ids: [] });
  });
});
