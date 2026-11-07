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
    can_approve: false,
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
    expect(first).toEqual(expect.arrayContaining(['Open', 'Raise credit note', 'Void invoice']));
    // Part paid: still owed, so a credit note; but a payment was recorded, so no void.
    const second = await menuOf('INV-0002');
    expect(second).toContain('Raise credit note');
    expect(second).not.toContain('Void invoice');
    // Paid in full: nothing to credit and nothing to void.
    const third = await menuOf('INV-0003');
    expect(third).not.toContain('Raise credit note');
    expect(third).not.toContain('Void invoice');
  });

  it('offers to record a payment while something is owed', async () => {
    setupList();
    expect(await menuOf('INV-0001')).toContain('Record payment');
    expect(await menuOf('INV-0002')).toContain('Record payment');
    expect(await menuOf('INV-0003')).not.toContain('Record payment');
  });

  it('opens the invoice with the payment form ready', async () => {
    const user = userEvent.setup();
    setupList();
    await user.click(await findRowAction(/Actions for INV-0001/, 'Record payment'));
    expect(await screen.findByTestId('location')).toHaveTextContent(
      `${INVOICES}/i-1?action=payment`,
    );
  });

  it('opens the invoice with the chosen correction ready', async () => {
    const user = userEvent.setup();
    setupList();
    await user.click(await findRowAction(/Actions for INV-0001/, 'Void invoice'));
    expect(await screen.findByTestId('location')).toHaveTextContent(`${INVOICES}/i-1?action=void`);
  });

  it('keeps each action in the same place on every row, without the menu ellipsis', async () => {
    setupList();
    const places = async (number: string) => {
      const group = await screen.findByRole('group', { name: new RegExp(`Actions for ${number}`) });
      return Array.from(group.children).map((child) => child.getAttribute('aria-label') ?? '-');
    };
    const unpaid = await places('INV-0001');
    const paid = await places('INV-0003');
    // The same places on both rows: Open and PDF first, Void last; a paid invoice leaves the
    // places of what it cannot do empty (nothing to click), so nothing shifts (APT77, APT78).
    expect(paid).toHaveLength(unpaid.length);
    expect(unpaid.slice(0, 2)).toEqual(['Open', 'Download PDF']);
    expect(paid.slice(0, 2)).toEqual(['Open', 'Download PDF']);
    expect(unpaid.slice(-3)).toEqual(['Record payment', 'Raise credit note', 'Void invoice']);
    expect(paid.slice(-3)).toEqual(['-', '-', '-']);
  });

  it('leaves out what the role may not do', async () => {
    setupList(['organization.read', 'client.read', 'invoice.read']);
    const items = await menuOf('INV-0001');
    expect(items).not.toContain('Raise credit note');
    expect(items).not.toContain('Void invoice');
  });
});

const detail = {
  ...issued('inv-1', 'INV-0009'),
  notes: null,
  issued_at: '2026-09-20T09:00:00Z',
  issued_by: null,
  voided_at: null,
  void_reason: null,
  deleted_at: null,
  email_recipients: ['accounts@bright.example'],
  created_by: null,
  approvals: [],
  can_approve: false,
  lines: [],
  vat_summary: [],
  wip: { item_count: 0, wip_value: 0, billed_value: 0, adjustment: 0 },
  payments: [],
  credit_notes: [],
} as unknown as InvoiceDetail;

function setupDetail(
  action: string,
  permissions = OWNER_PERMISSIONS,
  invoice: InvoiceDetail = detail,
) {
  const calls: { method: string; body: unknown }[] = [];
  server.use(
    // The invoice first: the first handler that matches answers.
    http.get(orgApiPath('/invoices/inv-1'), () => ok(invoice)),
    http.post(orgApiPath('/invoices/inv-1/void'), async ({ request }) => {
      calls.push({ method: 'void', body: await request.json() });
      return ok({ ...invoice, status: 'void', display_status: 'void' });
    }),
    http.delete(orgApiPath('/invoices/inv-1'), () => {
      calls.push({ method: 'delete', body: null });
      return ok(null);
    }),
    http.get(apiPath('/organizations/:organizationId/*'), () => ok([])),
  );
  renderBillingPage(<InvoiceDetailPage />, {
    permissions,
    route: `${INVOICES}/inv-1${action ? `?action=${action}` : ''}`,
    path: `${INVOICES}/:invoiceId`,
  });
  return calls;
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

const EMAIL_CLIENT = 'Email the client that this invoice is cancelled';

describe('voiding tells the client by email', () => {
  it('ticks the email to the client by default and asks the API to send it', async () => {
    const user = userEvent.setup();
    const calls = setupDetail('void');
    const dialog = await screen.findByRole('dialog', { name: 'Void invoice?' });
    const box = within(dialog).getByRole('checkbox', { name: new RegExp(EMAIL_CLIENT) });
    expect(box).toBeChecked();
    expect(dialog).toHaveTextContent('accounts@bright.example');
    await user.click(within(dialog).getByRole('button', { name: 'Wrong client' }));
    await user.click(within(dialog).getByRole('button', { name: 'Void invoice' }));
    await waitFor(() =>
      expect(calls).toEqual([
        { method: 'void', body: { reason: 'Wrong client', notify_client: true } },
      ]),
    );
    expect(await screen.findByText(/will be told it is cancelled/)).toBeInTheDocument();
  });

  it('voids without an email when the box is unticked', async () => {
    const user = userEvent.setup();
    const calls = setupDetail('void');
    const dialog = await screen.findByRole('dialog', { name: 'Void invoice?' });
    await user.click(within(dialog).getByRole('checkbox', { name: new RegExp(EMAIL_CLIENT) }));
    await user.click(within(dialog).getByRole('button', { name: 'Duplicate invoice' }));
    await user.click(within(dialog).getByRole('button', { name: 'Void invoice' }));
    await waitFor(() =>
      expect(calls).toEqual([
        { method: 'void', body: { reason: 'Duplicate invoice', notify_client: false } },
      ]),
    );
  });

  it('says so when the client has no email address', async () => {
    setupDetail('void', OWNER_PERMISSIONS, { ...detail, email_recipients: [] });
    const dialog = await screen.findByRole('dialog', { name: 'Void invoice?' });
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    expect(dialog).toHaveTextContent('The client has no email address');
  });

  it('offers no email to someone who may not send invoices', async () => {
    setupDetail(
      'void',
      OWNER_PERMISSIONS.filter((code) => code !== 'invoice.send'),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Void invoice?' });
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    expect(dialog).not.toHaveTextContent('no email address');
  });

  it('explains why an invoice with a payment cannot be voided', async () => {
    setupDetail('', OWNER_PERMISSIONS, {
      ...detail,
      paid_total: 1000,
      balance: 11000,
      payments: [
        {
          allocation_id: 'a-1',
          payment_id: 'p-1',
          received_on: '2026-10-01',
          method: 'bank_transfer',
          reference: null,
          amount: 1000,
        },
      ],
    });
    expect(await screen.findByText(/unmatch them first/)).toBeInTheDocument();
  });
});

describe('deleting a void invoice from its page', () => {
  const voided = {
    ...detail,
    status: 'void',
    display_status: 'void',
    balance: 0,
    voided_at: '2026-10-02T09:00:00Z',
    void_reason: 'Wrong client',
  } as InvoiceDetail;

  it('deletes it after a confirmation and goes back to the list', async () => {
    const user = userEvent.setup();
    const calls = setupDetail('', OWNER_PERMISSIONS, voided);
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete invoice…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete INV-0009?' });
    expect(dialog).toHaveTextContent('keeps its number');
    await user.click(within(dialog).getByRole('button', { name: 'Delete invoice' }));
    await waitFor(() => expect(calls).toEqual([{ method: 'delete', body: null }]));
    expect(await screen.findByTestId('location')).toHaveTextContent(new RegExp(`${INVOICES}$`));
  });

  it('says when it was deleted, and offers no second delete', async () => {
    setupDetail('', OWNER_PERMISSIONS, { ...voided, deleted_at: '2026-10-05T09:00:00Z' });
    expect(await screen.findByText(/It was deleted on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
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
