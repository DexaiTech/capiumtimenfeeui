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

async function menuOf(user: ReturnType<typeof userEvent.setup>, number: string) {
  await user.click(
    await screen.findByRole('button', { name: new RegExp(`Actions for ${number}`) }),
  );
  const menu = await screen.findByRole('menu');
  return within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent);
}

describe('correcting an issued invoice from the list', () => {
  it('offers a credit note while something is owed, and a void only before any payment', async () => {
    const user = userEvent.setup();
    setupList();
    const first = await menuOf(user, 'INV-0001');
    expect(first).toEqual(expect.arrayContaining(['Open', 'Raise credit note…', 'Void invoice…']));
    await user.keyboard('{Escape}');
    // Part paid: still owed, so a credit note; but a payment was recorded, so no void.
    const second = await menuOf(user, 'INV-0002');
    expect(second).toContain('Raise credit note…');
    expect(second).not.toContain('Void invoice…');
    await user.keyboard('{Escape}');
    // Paid in full: nothing to credit and nothing to void.
    const third = await menuOf(user, 'INV-0003');
    expect(third).not.toContain('Raise credit note…');
    expect(third).not.toContain('Void invoice…');
  });

  it('opens the invoice with the chosen correction ready', async () => {
    const user = userEvent.setup();
    setupList();
    await menuOf(user, 'INV-0001');
    await user.click(screen.getByRole('menuitem', { name: 'Void invoice…' }));
    expect(await screen.findByTestId('location')).toHaveTextContent(`${INVOICES}/i-1?action=void`);
  });

  it('leaves out what the role may not do', async () => {
    const user = userEvent.setup();
    setupList(['organization.read', 'client.read', 'invoice.read']);
    const items = await menuOf(user, 'INV-0001');
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
