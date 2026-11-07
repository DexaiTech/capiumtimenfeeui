import { findRowAction, rowActionNames } from '@/test/rowActions';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import { bright } from '../test/fixtures';
import { BILLING, renderBillingPage } from '../test/render';
import type { InvoiceSummary } from '../types';
import InvoicesPage from './InvoicesPage';

const END = { next_cursor: null, has_more: false };
const INVOICES = `${BILLING}/invoices`;
const READER = ['organization.read', 'client.read', 'invoice.read'];
const APPROVER = [...READER, 'invoice.approve'];
const ROW = /Actions for Draft of/;

function summary(overrides: Partial<InvoiceSummary>): InvoiceSummary {
  return {
    id: 'i-9',
    number: null,
    status: 'awaiting_approval',
    display_status: 'awaiting_approval',
    client: bright,
    issue_date: null,
    due_date: null,
    reference: null,
    currency: 'GBP',
    net_total: 100000,
    vat_total: 20000,
    gross_total: 120000,
    paid_total: 0,
    credited_total: 0,
    balance: 120000,
    approval_required: true,
    can_approve: true,
    sent_at: null,
    created_at: '2026-10-01T09:00:00Z',
    ...overrides,
  };
}

/** The list holds one invoice; each decision is recorded and answered. */
function setup(invoice: InvoiceSummary, permissions: string[] = OWNER_PERMISSIONS) {
  const calls: { method: string; body: unknown }[] = [];
  server.use(
    http.get(orgApiPath('/invoices/summary'), () =>
      ok({ counts: { total: 1 }, outstanding: 0, overdue: 0, awaiting_approval_gross: 120000 }),
    ),
    http.get(orgApiPath('/invoices'), () => ok([invoice], { meta: END })),
    http.post(orgApiPath(`/invoices/${invoice.id}/approve`), async ({ request }) => {
      calls.push({ method: 'approve', body: await request.json().catch(() => null) });
      return ok({ ...invoice, status: 'approved', display_status: 'approved' });
    }),
    http.post(orgApiPath(`/invoices/${invoice.id}/reject`), async ({ request }) => {
      calls.push({ method: 'reject', body: await request.json().catch(() => null) });
      return ok({ ...invoice, status: 'draft', display_status: 'draft' });
    }),
  );
  renderBillingPage(<InvoicesPage />, { permissions, route: INVOICES, path: INVOICES });
  return calls;
}

async function actions() {
  await screen.findByRole('group', { name: ROW });
  return rowActionNames(ROW);
}

// The list offers the same decisions as the invoice's own page (BIL-01), by the same rules:
// Approve when the API says this person may approve it, Reject for any holder of
// invoice.approve on an invoice awaiting approval or approved.
describe('deciding an invoice from the Invoices list', () => {
  it('offers Approve and Reject to an approver the API lets approve', async () => {
    setup(summary({}), APPROVER);
    expect(await actions()).toEqual(expect.arrayContaining(['Approve', 'Reject']));
  });

  it('offers only Reject when the API says this person may not approve it (they submitted it)', async () => {
    setup(summary({ can_approve: false }), APPROVER);
    const names = await actions();
    expect(names).toContain('Reject');
    expect(names).not.toContain('Approve');
  });

  it('offers neither without invoice.approve', async () => {
    setup(summary({ can_approve: false }), READER);
    const names = await actions();
    expect(names).not.toContain('Approve');
    expect(names).not.toContain('Reject');
  });

  it('approves with an optional note', async () => {
    const user = userEvent.setup();
    const calls = setup(summary({}), APPROVER);
    await user.click(await findRowAction(ROW, 'Approve'));
    const dialog = await screen.findByRole('dialog', { name: 'Approve this invoice?' });
    await user.click(within(dialog).getByRole('button', { name: 'Approve invoice' }));
    await waitFor(() => expect(calls.map((c) => c.method)).toEqual(['approve']));
  });

  it('rejects only with a reason, which goes to the API', async () => {
    const user = userEvent.setup();
    const calls = setup(summary({ status: 'approved', display_status: 'approved' }), APPROVER);
    await user.click(await findRowAction(ROW, 'Reject'));
    const dialog = await screen.findByRole('dialog', { name: 'Reject this invoice?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reject invoice' }));
    // No reason: nothing is sent.
    expect(calls).toEqual([]);
    await user.type(
      within(dialog).getByRole('textbox', { name: /Reason for rejecting/ }),
      'Wrong rate',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Reject invoice' }));
    await waitFor(() =>
      expect(calls).toEqual([{ method: 'reject', body: { reason: 'Wrong rate' } }]),
    );
  });
});
