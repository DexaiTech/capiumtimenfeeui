import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { apiPath, ok, server } from '@/test/server';

import { bright } from '../test/fixtures';
import { BILLING, renderBillingPage } from '../test/render';
import type { InvoiceDetail } from '../types';
import InvoiceDetailPage from './InvoiceDetailPage';

const INVOICES = `${BILLING}/invoices`;
const READER = ['organization.read', 'client.read', 'invoice.read'];
/** Prepares invoices but neither approves nor issues them. */
const PREPARER = [...READER, 'invoice.create'];
/** Approves invoices but does not issue them. */
const APPROVER = [...READER, 'invoice.approve'];

function invoiceOf(overrides: Partial<InvoiceDetail>): InvoiceDetail {
  return {
    id: 'inv-1',
    number: null,
    status: 'draft',
    display_status: 'draft',
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
    lines: [],
    vat_summary: [],
    wip: { wip_value: 0, billed_value: 0, adjustment: 0 },
    payments: [],
    credit_notes: [],
    ...overrides,
  };
}

const needsApproval = invoiceOf({ approval_required: true });
const awaiting = invoiceOf({
  status: 'awaiting_approval',
  display_status: 'awaiting_approval',
  approval_required: true,
  can_approve: true,
});
const approved = invoiceOf({
  status: 'approved',
  display_status: 'approved',
  approval_required: true,
});

function setup(invoice: InvoiceDetail, permissions: string[] = OWNER_PERMISSIONS) {
  const calls: { method: string; body: unknown }[] = [];
  // What the API holds: each decision changes it, so the refetch after it reads the new state.
  let current = invoice;
  const answer = (method: string, next: Partial<InvoiceDetail>) =>
    http.post(orgApiPath(`/invoices/inv-1/${method}`), async ({ request }) => {
      calls.push({ method, body: await request.json().catch(() => null) });
      current = { ...current, ...next };
      return ok(current);
    });
  server.use(
    http.get(orgApiPath('/invoices/inv-1'), () => ok(current)),
    answer('submit', { status: 'awaiting_approval', display_status: 'awaiting_approval' }),
    answer('approve', { status: 'approved', display_status: 'approved', can_approve: false }),
    answer('reject', {
      status: 'draft',
      display_status: 'draft',
      approval_required: true,
      can_approve: false,
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

const heading = () => screen.findByRole('heading', { level: 1, name: /Draft invoice/ });
const button = (name: string) => screen.queryByRole('button', { name });

describe('a draft that needs approval', () => {
  it('is submitted for approval, with an optional message, instead of issued', async () => {
    const user = userEvent.setup();
    const calls = setup(needsApproval);
    await heading();
    expect(screen.getByText('This invoice needs approval before it can be issued.')).toBeVisible();
    expect(button('Issue invoice')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit for approval?' });
    await user.type(within(dialog).getByLabelText(/Message for the approvers/), 'Please check');
    await user.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));

    expect(await screen.findByText('Sent for approval')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'submit', body: { note: 'Please check' } }]);
  });

  it('is not offered for submission to someone who may not prepare invoices', async () => {
    setup(needsApproval, APPROVER);
    await heading();
    expect(button('Submit for approval')).not.toBeInTheDocument();
    expect(button('Issue invoice')).not.toBeInTheDocument();
  });

  it('is offered for submission to a preparer who may not issue', async () => {
    setup(needsApproval, PREPARER);
    await heading();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
  });
});

describe('an invoice awaiting approval', () => {
  it('is approved by someone the API allows, with an optional note', async () => {
    const user = userEvent.setup();
    const calls = setup(awaiting);
    await heading();
    expect(screen.getByText(/awaiting approval and is locked/)).toBeVisible();
    expect(button('Issue invoice')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve this invoice?' });
    await user.click(within(dialog).getByRole('button', { name: 'Approve invoice' }));

    expect(await screen.findByText('Invoice approved')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'approve', body: {} }]);
    // Approved: the invoice can now be issued by someone who may issue.
    expect(await screen.findByRole('button', { name: 'Issue invoice' })).toBeInTheDocument();
  });

  it('is not offered for approval to its own submitter, who may still reject it', async () => {
    // The API says the caller may not approve it (they prepared or submitted it).
    setup({ ...awaiting, can_approve: false });
    await heading();
    expect(screen.getByText(/another approver must approve it/)).toBeVisible();
    expect(button('Approve')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('is offered for approval when the API allows it, whoever submitted it', async () => {
    // An Owner may approve their own invoice: the screen follows `can_approve`.
    setup({ ...awaiting, can_approve: true }, APPROVER);
    await heading();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('is rejected only with a reason, and goes back to draft', async () => {
    const user = userEvent.setup();
    const calls = setup(awaiting);
    await heading();

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject this invoice?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reject invoice' }));
    expect(calls).toEqual([]);

    await user.type(within(dialog).getByLabelText(/Reason for rejecting/), 'Wrong rates');
    await user.click(within(dialog).getByRole('button', { name: 'Reject invoice' }));

    expect(await screen.findByText('Invoice rejected')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'reject', body: { reason: 'Wrong rates' } }]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument(),
    );
  });

  it('offers no decision to someone who may not approve invoices', async () => {
    setup({ ...awaiting, can_approve: false }, PREPARER);
    await heading();
    expect(button('Approve')).not.toBeInTheDocument();
    expect(button('Reject')).not.toBeInTheDocument();
    expect(button('Submit for approval')).not.toBeInTheDocument();
  });
});

describe('an approved invoice', () => {
  it('is issued by someone who may issue invoices', async () => {
    const user = userEvent.setup();
    setup(approved);
    await heading();
    expect(screen.getByText('This invoice is approved and ready to issue.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Issue invoice' }));
    expect(await screen.findByRole('dialog', { name: 'Issue invoice?' })).toBeInTheDocument();
    // An approver may still send it back to draft before it is issued.
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('is not offered for issue to someone who may not issue invoices', async () => {
    setup(approved, APPROVER);
    await heading();
    expect(button('Issue invoice')).not.toBeInTheDocument();
    expect(screen.getByText(/Someone who may issue invoices can issue it/)).toBeVisible();
  });
});
