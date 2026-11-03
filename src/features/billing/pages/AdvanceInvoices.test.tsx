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

describe('billing fees in advance', () => {
  it('drafts an advance invoice for the client from the preparation', async () => {
    const user = userEvent.setup();
    const backend = createPrepareBackend();
    server.use(...prepareHandlers(backend));
    renderBillingPage(<PrepareInvoicePage />, {
      route: `${BILLING}/prepare?client=${harbour.id}`,
      path: `${BILLING}/prepare`,
    });

    await user.click(await screen.findByRole('button', { name: 'Bill fees in advance…' }));
    const panel = await screen.findByRole('region', { name: 'Bill fees in advance' });
    const description = within(panel).getByRole('textbox', { name: /Description/ });
    await user.clear(description);
    await user.type(description, 'Fees in advance 2026/27');
    await user.type(within(panel).getByRole('textbox', { name: /Amount/ }), '6000');
    await user.click(within(panel).getByRole('button', { name: 'Draft advance invoice' }));

    await waitFor(() => expect(postsOf(backend, '/invoices')).toHaveLength(1));
    expect(postsOf(backend, '/invoices')[0]?.body).toEqual(
      expect.objectContaining({
        client_id: harbour.id,
        time_entry_ids: [],
        disbursement_ids: [],
        advance: { description: 'Fees in advance 2026/27', net_amount: 600000 },
      }),
    );
    expect(await screen.findByTestId('location')).toHaveTextContent(`${INVOICES}/inv-new-1`);
  });

  it('offers fees in advance for a client with nothing to bill', async () => {
    const user = userEvent.setup();
    const backend = createPrepareBackend({ wip: { [harbour.id]: wipOf([]) } });
    server.use(...prepareHandlers(backend));
    renderBillingPage(<PrepareInvoicePage />, {
      route: `${BILLING}/prepare?client=${harbour.id}`,
      path: `${BILLING}/prepare`,
    });

    expect(await screen.findByText('Nothing to bill')).toBeInTheDocument();
    expect(screen.getByText(/You can still bill fees in advance/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bill fees in advance…' }));
    expect(await screen.findByRole('region', { name: 'Bill fees in advance' })).toBeInTheDocument();
  });

  it('marks a new manual line of a draft as fees in advance', async () => {
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

    await user.click(await screen.findByRole('button', { name: 'Add line' }));
    const panel = await screen.findByRole('region', { name: 'Add a line' });
    await user.type(within(panel).getByRole('textbox', { name: /Description/ }), 'Fees in advance');
    await user.type(within(panel).getByRole('textbox', { name: /Unit price/ }), '6000');
    await user.click(within(panel).getByRole('checkbox', { name: /Fees in advance/ }));
    await user.click(within(panel).getByRole('button', { name: 'Add line' }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]?.path).toMatch(/\/invoices\/inv-1\/lines$/);
    expect(posted[0]?.body).toEqual(
      expect.objectContaining({
        description: 'Fees in advance',
        unit_amount: 600000,
        is_advance: true,
      }),
    );
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
