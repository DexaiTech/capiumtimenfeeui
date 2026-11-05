import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { findRowAction, rowActionNames } from '@/test/rowActions';
import { fail, ok, server } from '@/test/server';

import { techwave } from './fixtures';
import { invoices } from './workspaceFixtures';
import { workspaceHandlers } from './workspaceHandlers';
import { InvoicesTab } from '../workspace/tabs/InvoicesTab';

const NAME = 'Techwave Innovations Ltd';
const END = { next_cursor: null, has_more: false };
const DRAFT = invoices.find((invoice) => invoice.display_status === 'draft');
if (!DRAFT) throw new Error('The fixtures need a draft invoice');
/** The draft "New invoice" makes in these tests. */
const NEW_DRAFT = { ...DRAFT, id: 'inv-new', gross_total: 12_000 };

/** Where the router is, with the query, so a test can say what a button opened. */
function Location() {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{pathname + search}</p>;
}

function setup(permissions: string[] = OWNER_PERMISSIONS) {
  let rows = [...invoices];
  const deleted: string[] = [];
  const created: unknown[] = [];
  const lists = { count: 0 };
  server.use(
    http.get(orgApiPath('/invoices'), () => {
      lists.count += 1;
      return ok(rows, { meta: END });
    }),
    http.post(orgApiPath('/invoices'), async ({ request }) => {
      created.push(await request.json());
      rows = [NEW_DRAFT, ...rows];
      const detail = { ...NEW_DRAFT, client: { id: techwave.id, name: NAME }, currency: 'GBP' };
      return ok(detail, { status: 201 });
    }),
    // The preparation reads the client's billing summary; none here (the panel copes).
    http.get(orgApiPath('/clients/:clientId/billing-summary'), () =>
      fail(404, 'RESOURCE_NOT_FOUND', 'Not found.'),
    ),
    http.delete(orgApiPath('/invoices/:invoiceId'), ({ params }) => {
      deleted.push(String(params.invoiceId));
      rows = rows.filter((row) => row.id !== params.invoiceId);
      return ok(null);
    }),
    ...workspaceHandlers(),
  );
  renderInOrg(
    <Routes>
      <Route
        path="/acme/clients/:clientId/invoices"
        element={
          <InvoicesTab
            clientId={techwave.id}
            clientCode="APX006"
            clientName={NAME}
            overview={undefined}
          />
        }
      />
      <Route path="*" element={<Location />} />
    </Routes>,
    { route: `/acme/clients/${techwave.id}/invoices`, context: contextWith(permissions) },
  );
  return { deleted, created, lists };
}

describe('InvoicesTab: add, edit and delete invoices', () => {
  it('opens the invoice preparation for this client here, and closes it again', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByRole('button', { name: 'New invoice' }));
    const panel = screen.getByRole('region', { name: 'Create invoice' });
    // APT61: the client is this one (no picker), and the person stays on the client.
    expect(
      await within(panel).findByRole('table', { name: `Work in progress of ${NAME}` }),
    ).toBeInTheDocument();
    expect(within(panel).queryByRole('combobox', { name: 'Client' })).toBeNull();
    expect(screen.queryByTestId('location')).toBeNull();
    expect(screen.getByRole('table', { name: `Invoices of ${NAME}` })).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Create invoice' })).toBeNull(),
    );
  });

  it('saves the new invoice for this client and stays on the client, with the list read again', async () => {
    const user = userEvent.setup();
    const { created, lists } = setup();

    await user.click(await screen.findByRole('button', { name: 'New invoice' }));
    const panel = screen.getByRole('region', { name: 'Create invoice' });
    const work = await within(panel).findByRole('table', { name: `Work in progress of ${NAME}` });
    await waitFor(() => expect(work).not.toHaveAttribute('aria-busy', 'true'));
    const row = within(work).getByRole('row', { name: /Prepared the trial balance/ });
    await user.click(within(row).getByRole('checkbox'));
    await user.click(within(panel).getByRole('button', { name: 'Review the lines' }));
    await within(panel).findByRole('table', { name: 'Lines of the invoice' });
    await user.click(within(panel).getByRole('button', { name: 'Dates and notes' }));
    const before = lists.count;
    await user.click(await within(panel).findByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('Draft invoice saved')).toBeInTheDocument();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ client_id: techwave.id });
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Create invoice' })).toBeNull(),
    );
    expect(screen.queryByTestId('location')).toBeNull();
    await waitFor(() => expect(lists.count).toBeGreaterThan(before));
  });

  it('opens a draft in its editor', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await findRowAction('Actions for Draft', 'Edit draft'));
    expect(await screen.findByTestId('location')).toHaveTextContent(
      `/acme/billing/invoices/${DRAFT.id}`,
    );
  });

  it('deletes a draft after asking, and lists the invoices again', async () => {
    const user = userEvent.setup();
    const { deleted } = setup();

    await user.click(await findRowAction('Actions for Draft', 'Delete draft'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete draft?' });
    expect(dialog).toHaveTextContent('goes back to unbilled WIP');
    expect(deleted).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Delete draft' }));

    await waitFor(() => expect(deleted).toEqual([DRAFT.id]));
    expect(await screen.findByText('Draft deleted')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('row', { name: /Draft/ })).toBeNull());
    expect(screen.getByRole('row', { name: /INV-0004/ })).toBeInTheDocument();
  });

  it('keeps the dialog open with the reason when the API refuses', async () => {
    const user = userEvent.setup();
    setup();
    server.use(
      http.delete(orgApiPath('/invoices/:invoiceId'), () =>
        fail(409, 'INVOICE_NOT_DRAFT', 'Only a draft invoice can be changed this way.'),
      ),
    );

    await user.click(await findRowAction('Actions for Draft', 'Delete draft'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete draft?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete draft' }));
    expect(
      await within(dialog).findByText('Only a draft invoice can be changed this way.'),
    ).toBeInTheDocument();
  });

  it('offers no edit or delete on an issued invoice', async () => {
    setup();
    await screen.findByRole('group', { name: 'Actions for Draft' });
    expect(rowActionNames('Actions for Draft')).toEqual(['Edit draft', 'Delete draft']);
    for (const number of ['INV-0004', 'INV-0003', 'INV-0002']) {
      const row = screen.getByRole('row', { name: new RegExp(number) });
      expect(within(row).queryByRole('button', { name: /Delete/ })).toBeNull();
      expect(within(row).queryByRole('button', { name: /Edit/ })).toBeNull();
      // The number still opens the invoice, as before.
      expect(within(row).getByRole('link', { name: number })).toBeInTheDocument();
    }
  });

  it('offers no new invoice, edit or delete without invoice.create', async () => {
    setup(OWNER_PERMISSIONS.filter((permission) => permission !== 'invoice.create'));
    await screen.findByRole('row', { name: /INV-0004/ });
    expect(screen.queryByRole('button', { name: 'New invoice' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Actions for Draft' })).toBeNull();
  });
});
