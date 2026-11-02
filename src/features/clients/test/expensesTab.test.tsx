import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ben, disbursement, IDS } from '@/features/expenses/test/fixtures';
import { createBackend, expenseHandlers } from '@/features/expenses/test/handlers';
import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { findRowAction } from '@/test/rowActions';
import { server } from '@/test/server';

import { ExpensesTab } from '../workspace/tabs/ExpensesTab';

const ACME = { id: IDS.acme, name: 'Acme Ltd' };

function setup(permissions: string[] = OWNER_PERMISSIONS) {
  const backend = createBackend({
    disbursements: [
      disbursement({ id: 'mine', description: 'Companies House fee' }),
      disbursement({ id: 'theirs', description: 'Courier', created_by: ben.id }),
      disbursement({ id: 'billed', description: 'Land Registry search', billing_status: 'billed' }),
    ],
  });
  server.use(...expenseHandlers(backend));
  renderInOrg(<ExpensesTab clientId={ACME.id} clientName={ACME.name} overview={undefined} />, {
    context: contextWith(permissions),
  });
  return backend;
}

const calls = (backend: ReturnType<typeof setup>, method: string, path: string) =>
  backend.calls.filter((call) => call.method === method && call.path === path);

describe('ExpensesTab: add and delete', () => {
  it('opens the disbursement form for the client and lists the new expense once saved', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await screen.findByRole('row', { name: /Companies House fee/ });

    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const form = await screen.findByRole('region', { name: 'Record disbursement' });
    const client = within(form).getByRole('combobox', { name: 'Client' });
    expect((client as HTMLInputElement).value).toContain(ACME.name);

    await user.type(within(form).getByRole('textbox', { name: 'Description' }), 'Postage');
    await user.type(within(form).getByRole('textbox', { name: /^Amount before VAT/ }), '12.50');
    await user.click(within(form).getByRole('button', { name: 'Record disbursement' }));

    await waitFor(() => expect(calls(backend, 'POST', '/disbursements')).toHaveLength(1));
    expect(calls(backend, 'POST', '/disbursements')[0]?.body).toMatchObject({
      client_id: IDS.acme,
      description: 'Postage',
      amount: 1250,
    });
    // The tab asks for the list again, so the new expense is there without a reload.
    expect(await screen.findByRole('row', { name: /Postage/ })).toBeInTheDocument();
  });

  it('deletes an unbilled expense after confirming', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await findRowAction('Actions for Companies House fee', 'Delete'));

    const dialog = await screen.findByRole('dialog', { name: 'Delete this expense?' });
    expect(calls(backend, 'DELETE', '/disbursements/mine')).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Delete expense' }));

    await waitFor(() => expect(calls(backend, 'DELETE', '/disbursements/mine')).toHaveLength(1));
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Companies House fee/ })).not.toBeInTheDocument(),
    );
  });

  it('shows the refusal of the API in the dialog', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await findRowAction('Actions for Companies House fee', 'Delete'));
    // Billed meanwhile by someone else: the API refuses.
    backend.disbursements = backend.disbursements.map((entry) =>
      entry.id === 'mine' ? { ...entry, billing_status: 'billed' } : entry,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Delete this expense?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete expense' }));
    expect(await within(dialog).findByText(/cannot be deleted/)).toBeInTheDocument();
  });

  it('offers delete only on unbilled expenses the person may change, and add to recorders', async () => {
    setup(['organization.read', 'client.read', 'disbursement.log']);
    await screen.findByRole('row', { name: /Courier/ });

    expect(screen.getByRole('button', { name: 'Add expense' })).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Actions for Companies House fee' }),
    ).toBeInTheDocument();
    // Recorded by someone else, or already billed.
    expect(screen.queryByRole('group', { name: 'Actions for Courier' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Actions for Land Registry search' }),
    ).not.toBeInTheDocument();
  });

  it('offers neither to someone who only reads', async () => {
    setup(['organization.read', 'client.read', 'wip.read']);
    await screen.findByRole('row', { name: /Courier/ });
    expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Actions for/ })).not.toBeInTheDocument();
  });
});
