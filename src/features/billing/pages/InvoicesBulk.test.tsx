import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { findRowAction, rowActionNames } from '@/test/rowActions';
import { fail, ok, server } from '@/test/server';

import type { InvoiceBulkRequest, InvoiceSummary } from '../types';
import { bright, harbour } from '../test/fixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { BILLING, renderBillingPage } from '../test/render';
import InvoicesPage from './InvoicesPage';

const END = { next_cursor: null, has_more: false };
const READ_ONLY = ['organization.read', 'client.read', 'invoice.read'];

function invoice(overrides: Partial<InvoiceSummary>): InvoiceSummary {
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

const draftOne = invoice({ id: 'i-1', created_at: '2026-10-03T09:00:00Z' });
const draftTwo = invoice({ id: 'i-2', client: harbour, created_at: '2026-10-02T09:00:00Z' });
const issued = invoice({
  id: 'i-3',
  number: 'INV-0007',
  status: 'issued',
  display_status: 'issued',
  issue_date: '2026-09-20',
  due_date: '2026-10-20',
  created_at: '2026-10-01T09:00:00Z',
});

function setup(
  permissions = OWNER_PERMISSIONS,
  refuse?: (body: InvoiceBulkRequest) => Response | null,
) {
  const calls: InvoiceBulkRequest[] = [];
  let rows = [draftOne, draftTwo, issued];
  server.use(
    http.get(orgApiPath('/invoices/summary'), () =>
      ok({
        counts: { total: 3, draft: 2, issued: 1 },
        outstanding: 0,
        overdue: 0,
        awaiting_approval_gross: 0,
      }),
    ),
    http.get(orgApiPath('/invoices'), () => ok(rows, { meta: END })),
    http.post(orgApiPath('/invoices/bulk'), async ({ request }) => {
      const body = (await request.json()) as InvoiceBulkRequest;
      calls.push(body);
      const refusal = refuse?.(body);
      if (refusal) return refusal;
      rows = rows.filter((row) => !body.invoice_ids.includes(row.id));
      return ok({
        action: 'delete',
        affected: body.invoice_ids.length,
        changed: body.invoice_ids.length,
      });
    }),
  );
  renderBillingPage(<InvoicesPage />, {
    permissions,
    route: `${BILLING}/invoices`,
    path: `${BILLING}/invoices`,
  });
  return calls;
}

async function table() {
  const element = await screen.findByRole('table', { name: 'Invoices' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
}

describe('bulk delete of drafts on the invoice list', () => {
  it('deletes the selected drafts in one call, after a confirmation, and clears the selection', async () => {
    const user = userEvent.setup();
    const calls = setup();
    const list = await table();
    const [first, second] = within(list).getAllByRole('checkbox', { name: 'Select Draft' });
    await user.click(first as HTMLElement);
    await user.click(second as HTMLElement);

    const group = screen.getByRole('group', { name: 'Selected invoices' });
    expect(within(group).getByText('2 selected')).toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: 'Delete 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 drafts?' });
    expect(dialog).toHaveTextContent('unbilled WIP');
    expect(dialog).toHaveTextContent('credit note');
    await user.click(within(dialog).getByRole('button', { name: 'Delete 2' }));

    expect(await screen.findByText('2 drafts deleted')).toBeInTheDocument();
    expect(calls).toEqual([{ invoice_ids: ['i-1', 'i-2'], action: 'delete' }]);
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Selected invoices' })).toBeNull(),
    );
    expect(screen.getAllByRole('status').some((el) => el.textContent === '2 drafts deleted')).toBe(
      true,
    );
  });

  it('warns that an issued invoice must be voided first, and shows the API refusal naming it', async () => {
    const user = userEvent.setup();
    const calls = setup(OWNER_PERMISSIONS, () =>
      fail(
        409,
        'INVOICE_NOT_DRAFT',
        '1 of the invoices is neither a draft nor void and cannot be deleted. Nothing was deleted.',
        {
          details: [
            {
              invoice_id: 'i-3',
              number: 'INV-0007',
              status: 'issued',
              reason: 'Void it first: only drafts and void invoices can be deleted.',
            },
          ],
        },
      ),
    );
    const list = await table();
    await user.click(
      within(list).getAllByRole('checkbox', { name: 'Select Draft' })[0] as HTMLElement,
    );
    await user.click(within(list).getByRole('checkbox', { name: 'Select INV-0007' }));

    await user.click(screen.getByRole('button', { name: 'Delete 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 invoices?' });
    expect(dialog).toHaveTextContent(
      'Only drafts and void invoices can be deleted: void an issued invoice first',
    );
    expect(dialog).toHaveTextContent('1 selected invoice cannot be deleted');
    await user.click(within(dialog).getByRole('button', { name: 'Delete 2' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Nothing was deleted');
    expect(within(alert).getByText('INV-0007')).toBeInTheDocument();
    expect(alert).toHaveTextContent('Void it first');
    expect(calls).toEqual([{ invoice_ids: ['i-1', 'i-3'], action: 'delete' }]);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('does not offer Delete to a role that cannot create invoices', async () => {
    const user = userEvent.setup();
    setup(READ_ONLY);
    const list = await table();
    await user.click(
      within(list).getAllByRole('checkbox', { name: 'Select Draft' })[0] as HTMLElement,
    );
    const group = screen.getByRole('group', { name: 'Selected invoices' });
    expect(within(group).queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it.each([
    ['who may send', OWNER_PERMISSIONS, true],
    [
      'who may issue but not send',
      OWNER_PERMISSIONS.filter((code) => code !== 'invoice.send'),
      false,
    ],
  ])('offers Email of the selection only to someone %s', async (_who, permissions, offered) => {
    const user = userEvent.setup();
    setup(permissions);
    const list = await table();
    await user.click(within(list).getByRole('checkbox', { name: 'Select INV-0007' }));
    const group = screen.getByRole('group', { name: 'Selected invoices' });
    expect(within(group).queryByRole('button', { name: 'Email 1' }) !== null).toBe(offered);
  });
});

const voided = invoice({
  id: 'i-4',
  number: 'INV-0005',
  status: 'void',
  display_status: 'void',
  issue_date: '2026-09-01',
  due_date: '2026-10-01',
  balance: 0,
  created_at: '2026-09-01T09:00:00Z',
});

function setupVoid(permissions = OWNER_PERMISSIONS, route = `${BILLING}/invoices?tab=void`) {
  const deleted: string[] = [];
  const bulk: InvoiceBulkRequest[] = [];
  const statuses: (string | null)[] = [];
  let rows = [draftOne, voided];
  server.use(
    http.get(orgApiPath('/invoices/summary'), () =>
      ok({
        counts: { total: 2, draft: 1, void: 1 },
        outstanding: 0,
        overdue: 0,
        awaiting_approval_gross: 0,
      }),
    ),
    http.get(orgApiPath('/invoices'), ({ request }) => {
      const status = new URL(request.url).searchParams.get('status');
      statuses.push(status);
      return ok(status === 'void' ? rows.filter((row) => row.status === 'void') : rows, {
        meta: END,
      });
    }),
    http.delete(orgApiPath('/invoices/:invoiceId'), ({ params }) => {
      deleted.push(String(params.invoiceId));
      rows = rows.filter((row) => row.id !== params.invoiceId);
      return ok(null);
    }),
    http.post(orgApiPath('/invoices/bulk'), async ({ request }) => {
      const body = (await request.json()) as InvoiceBulkRequest;
      bulk.push(body);
      rows = rows.filter((row) => !body.invoice_ids.includes(row.id));
      return ok({ action: 'delete', affected: body.invoice_ids.length, changed: 2 });
    }),
  );
  renderBillingPage(<InvoicesPage />, { permissions, route, path: `${BILLING}/invoices` });
  return { deleted, bulk, statuses };
}

describe('the Void tab: deleting void invoices', () => {
  it('lists the void invoices under Void and deletes one after a confirmation', async () => {
    const user = userEvent.setup();
    const { deleted, statuses } = setupVoid();
    expect(await screen.findByRole('tab', { name: /Void/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await table();
    expect(statuses).toContain('void');
    await user.click(await findRowAction(/Actions for INV-0005/, 'Delete invoice'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete INV-0005?' });
    expect(dialog).toHaveTextContent('keeps its number and stays in the audit trail');
    await user.click(within(dialog).getByRole('button', { name: 'Delete invoice' }));
    await waitFor(() => expect(deleted).toEqual(['i-4']));
    expect(await screen.findByText('INV-0005 deleted')).toBeInTheDocument();
  });

  it('deletes drafts and void invoices together, all or nothing', async () => {
    const user = userEvent.setup();
    const { bulk } = setupVoid(OWNER_PERMISSIONS, `${BILLING}/invoices`);
    const list = await table();
    await user.click(within(list).getByRole('checkbox', { name: 'Select Draft' }));
    await user.click(within(list).getByRole('checkbox', { name: 'Select INV-0005' }));
    await user.click(screen.getByRole('button', { name: 'Delete 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 invoices?' });
    expect(dialog).toHaveTextContent('Void invoices leave the invoice lists');
    expect(dialog).not.toHaveTextContent('cannot be deleted. Untick');
    await user.click(within(dialog).getByRole('button', { name: 'Delete 2' }));
    expect(await screen.findByText('2 invoices deleted')).toBeInTheDocument();
    expect(bulk).toEqual([{ invoice_ids: ['i-1', 'i-4'], action: 'delete' }]);
  });

  it('does not offer to delete a void invoice to someone who may not void', async () => {
    setupVoid(OWNER_PERMISSIONS.filter((code) => code !== 'invoice.issue'));
    await screen.findByRole('group', { name: /Actions for INV-0005/ });
    expect(rowActionNames(/Actions for INV-0005/)).not.toContain('Delete invoice');
  });
});
