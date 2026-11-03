import { findRowAction, rowActionNames } from '@/test/rowActions';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { apiPath, ok, server } from '@/test/server';

import { bright } from '../test/fixtures';
import { BILLING, renderBillingPage } from '../test/render';
import type { InvoiceDetail, InvoiceSummary } from '../types';
import InvoiceDetailPage from './InvoiceDetailPage';
import InvoicesPage from './InvoicesPage';

const END = { next_cursor: null, has_more: false };
const INVOICES = `${BILLING}/invoices`;

function summary(overrides: Partial<InvoiceSummary>): InvoiceSummary {
  return {
    id: 'i-0',
    number: null,
    status: 'draft',
    display_status: 'draft',
    client: bright,
    issue_date: null,
    due_date: null,
    reference: null,
    currency: 'GBP',
    net_total: 10000,
    vat_total: 2000,
    gross_total: 12000,
    paid_total: 0,
    credited_total: 0,
    balance: 12000,
    approval_required: false,
    sent_at: null,
    created_at: '2026-10-01T09:00:00Z',
    ...overrides,
  };
}

const issued = (id: string, number: string, overrides: Partial<InvoiceSummary> = {}) =>
  summary({
    id,
    number,
    status: 'issued',
    display_status: 'issued',
    issue_date: '2026-09-20',
    due_date: '2026-10-20',
    ...overrides,
  });

const unpaid = issued('i-1', 'INV-0001');
const partPaid = issued('i-2', 'INV-0002', { paid_total: 4000, balance: 8000 });
const paid = issued('i-3', 'INV-0003', { paid_total: 12000, balance: 0, display_status: 'paid' });

function setupList(permissions = OWNER_PERMISSIONS) {
  server.use(
    http.get(orgApiPath('/invoices/summary'), () =>
      ok({ counts: { total: 3 }, outstanding: 0, overdue: 0, awaiting_approval_gross: 0 }),
    ),
    http.get(orgApiPath('/invoices'), () => ok([unpaid, partPaid, paid], { meta: END })),
  );
  renderBillingPage(<InvoicesPage />, { permissions, route: INVOICES, path: INVOICES });
}

async function menuOf(number: string) {
  const group = new RegExp(`Actions for ${number}`);
  await screen.findByRole('group', { name: group });
  return rowActionNames(group);
}

describe('correcting an issued invoice from the list', () => {
  it('offers a credit note while something is owed, and a void only before any payment', async () => {
    setupList();
    const first = await menuOf('INV-0001');
    expect(first).toEqual(expect.arrayContaining(['Open', 'Raise credit note…', 'Void invoice…']));
    // Part paid: still owed, so a credit note; but a payment was recorded, so no void.
    const second = await menuOf('INV-0002');
    expect(second).toContain('Raise credit note…');
    expect(second).not.toContain('Void invoice…');
    // Paid in full: nothing to credit and nothing to void.
    const third = await menuOf('INV-0003');
    expect(third).not.toContain('Raise credit note…');
    expect(third).not.toContain('Void invoice…');
  });

  it('offers to record a payment while something is owed', async () => {
    setupList();
    expect(await menuOf('INV-0001')).toContain('Record payment…');
    expect(await menuOf('INV-0002')).toContain('Record payment…');
    expect(await menuOf('INV-0003')).not.toContain('Record payment…');
  });

  it('opens the invoice with the payment form ready', async () => {
    const user = userEvent.setup();
    setupList();
    await user.click(await findRowAction(/Actions for INV-0001/, 'Record payment…'));
    expect(await screen.findByTestId('location')).toHaveTextContent(
      `${INVOICES}/i-1?action=payment`,
    );
  });

  it('opens the invoice with the chosen correction ready', async () => {
    const user = userEvent.setup();
    setupList();
    await user.click(await findRowAction(/Actions for INV-0001/, 'Void invoice…'));
    expect(await screen.findByTestId('location')).toHaveTextContent(`${INVOICES}/i-1?action=void`);
  });

  it('leaves out what the role may not do', async () => {
    setupList(['organization.read', 'client.read', 'invoice.read']);
    const items = await menuOf('INV-0001');
    expect(items).not.toContain('Raise credit note…');
    expect(items).not.toContain('Void invoice…');
  });
});

const detail = {
  ...issued('inv-1', 'INV-0009'),
  notes: null,
  issued_at: '2026-09-20T09:00:00Z',
  issued_by: null,
  voided_at: null,
  void_reason: null,
  created_by: null,
  approvals: [],
  can_approve: false,
  lines: [],
  vat_summary: [],
  wip: { item_count: 0, wip_value: 0, billed_value: 0, adjustment: 0 },
  payments: [],
  credit_notes: [],
} as unknown as InvoiceDetail;

function setupDetail(action: string, permissions = OWNER_PERMISSIONS) {
  server.use(
    // The invoice first: the first handler that matches answers.
    http.get(orgApiPath('/invoices/inv-1'), () => ok(detail)),
    http.get(apiPath('/organizations/:organizationId/*'), () => ok([])),
  );
  renderBillingPage(<InvoiceDetailPage />, {
    permissions,
    route: `${INVOICES}/inv-1?action=${action}`,
    path: `${INVOICES}/:invoiceId`,
  });
}

describe('an invoice opened to correct it', () => {
  it('shows the void dialog at once and then forgets the request', async () => {
    setupDetail('void');
    expect(await screen.findByRole('dialog', { name: 'Void invoice?' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('action='));
  });

  it('shows the payment form at once for an invoice that is owed', async () => {
    setupDetail('payment');
    expect(await screen.findByRole('region', { name: 'Record a payment' })).toBeInTheDocument();
  });

  it('offers the usual reasons to void with one click each', async () => {
    const user = userEvent.setup();
    setupDetail('void');
    const dialog = await screen.findByRole('dialog', { name: 'Void invoice?' });
    await user.click(within(dialog).getByRole('button', { name: 'Wrong client' }));
    expect(within(dialog).getByLabelText(/Reason for voiding/)).toHaveValue('Wrong client');
  });

  it('shows the credit note dialog at once', async () => {
    setupDetail('credit');
    expect(await screen.findByRole('region', { name: 'Raise a credit note' })).toBeInTheDocument();
  });

  it('shows no dialog to someone who may not do it', async () => {
    setupDetail('void', ['organization.read', 'client.read', 'invoice.read']);
    await screen.findByRole('heading', { level: 1, name: /INV-0009/ });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('unmatching a payment from a paid invoice', () => {
  const paidDetail = {
    ...detail,
    paid_total: 12000,
    balance: 0,
    display_status: 'paid',
    payments: [
      {
        allocation_id: 'al-1',
        payment_id: 'pay-1',
        received_on: '2026-10-20',
        method: 'bank_transfer',
        reference: null,
        amount: 12000,
      },
    ],
  } as unknown as InvoiceDetail;

  function setupPaid(permissions = OWNER_PERMISSIONS) {
    const calls: string[] = [];
    server.use(
      http.get(orgApiPath('/invoices/inv-1'), () => ok(paidDetail)),
      http.delete(orgApiPath('/payments/pay-1/allocations/al-1'), () => {
        calls.push('unmatch');
        return ok({});
      }),
      http.get(apiPath('/organizations/:organizationId/*'), () => ok([])),
    );
    renderBillingPage(<InvoiceDetailPage />, {
      permissions,
      route: `${INVOICES}/inv-1`,
      path: `${INVOICES}/:invoiceId`,
    });
    return calls;
  }

  it('takes the payment off the invoice after a confirmation, though nothing is owed', async () => {
    const user = userEvent.setup();
    const calls = setupPaid();

    await user.click(await screen.findByRole('button', { name: /^Unmatch the payment of/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Unmatch this payment?' });
    expect(dialog).toHaveTextContent('stays on the client');
    await user.click(within(dialog).getByRole('button', { name: 'Unmatch payment' }));

    await waitFor(() => expect(calls).toEqual(['unmatch']));
    expect(await screen.findByText('Payment unmatched')).toBeInTheDocument();
  });

  it('then lets the money on account be allocated to another invoice', async () => {
    const user = userEvent.setup();
    const onAccount = {
      id: 'pay-1',
      client: bright,
      received_on: '2026-10-20',
      amount: 12000,
      method: 'bank_transfer',
      reference: null,
      notes: null,
      allocated_total: 0,
      unallocated: 12000,
      state: 'unallocated',
      voided_at: null,
      reversed_at: null,
      reversed_by: null,
      reversal_reason: null,
      bounced: false,
      created_by: null,
      created_at: '2026-10-20T09:00:00Z',
      allocations: [],
    };
    const bodies: unknown[] = [];
    server.use(
      http.get(orgApiPath('/invoices/inv-1'), () => ok(paidDetail)),
      http.delete(orgApiPath('/payments/pay-1/allocations/al-1'), () => ok(onAccount)),
      http.get(orgApiPath('/payments/pay-1'), () => ok(onAccount)),
      http.get(orgApiPath('/invoices'), () => ok([issued('inv-2', 'INV-0010')], { meta: END })),
      http.post(orgApiPath('/payments/pay-1/allocations'), async ({ request }) => {
        bodies.push(await request.json());
        return ok({ ...onAccount, allocated_total: 12000, unallocated: 0, state: 'allocated' });
      }),
      http.get(apiPath('/organizations/:organizationId/*'), () => ok([])),
    );
    renderBillingPage(<InvoiceDetailPage />, {
      route: `${INVOICES}/inv-1`,
      path: `${INVOICES}/:invoiceId`,
    });

    await user.click(await screen.findByRole('button', { name: /^Unmatch the payment of/ }));
    const confirm = await screen.findByRole('dialog', { name: 'Unmatch this payment?' });
    await user.click(within(confirm).getByRole('button', { name: 'Unmatch payment' }));
    await user.click(await screen.findByRole('button', { name: 'Allocate it' }));

    const dialog = await screen.findByRole('dialog', { name: 'Payment' });
    await user.click(await within(dialog).findByRole('button', { name: 'Choose invoices' }));
    await user.type(await within(dialog).findByLabelText('Amount to pay on INV-0010'), '120.00');
    await user.click(within(dialog).getByRole('button', { name: 'Allocate' }));

    await waitFor(() =>
      expect(bodies).toEqual([{ allocations: [{ invoice_id: 'inv-2', amount: 12000 }] }]),
    );
  });

  it('is not offered to someone who may not record payments', async () => {
    setupPaid(['organization.read', 'invoice.read']);

    await screen.findByRole('list', { name: 'Payments on the invoice' });
    expect(
      screen.queryByRole('button', { name: /^Unmatch the payment of/ }),
    ).not.toBeInTheDocument();
  });
});
