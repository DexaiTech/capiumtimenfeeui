import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { INITIAL_CLIENTS_PREFS, useClientsPrefs } from '../store';
import { mutual, techwave, testMembers } from '../test/fixtures';
import { clientsHandlers } from '../test/handlers';
import type { ClientBulkRequest } from '../types';
import ClientsPage from './ClientsPage';

const READ_AND_EDIT = ['organization.read', 'member.read', 'client.read', 'client.update'];

beforeEach(() => {
  window.localStorage.clear();
  useClientsPrefs.setState(INITIAL_CLIENTS_PREFS);
});

/** Serves the list and records every bulk call; `refuse` turns the next ones into a 409. */
function setup(
  permissions = OWNER_PERMISSIONS,
  refuse?: (body: ClientBulkRequest) => Response | null,
) {
  const calls: ClientBulkRequest[] = [];
  server.use(
    ...clientsHandlers(),
    http.post(orgApiPath('/clients/bulk'), async ({ request }) => {
      const body = (await request.json()) as ClientBulkRequest;
      calls.push(body);
      const refusal = refuse?.(body);
      if (refusal) return refusal;
      return ok({
        action: body.action,
        affected: body.client_ids.length,
        changed: body.client_ids.length,
      });
    }),
  );
  renderInOrg(<ClientsPage />, { context: contextWith(permissions) });
  return calls;
}

async function tick(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  for (const name of names) {
    const row = await screen.findByRole('row', { name });
    await user.click(within(row).getByRole('checkbox', { name: `Select ${name}` }));
  }
  return screen.findByRole('region', { name: 'Bulk actions for clients' });
}

describe('bulk actions on the client list', () => {
  it('shows the bar with the count, and Clear unticks the rows', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByRole('region', { name: 'Bulk actions for clients' })).toBeNull();
    const bar = await tick(user, techwave.name, mutual.name);
    expect(within(bar).getByText('2 selected')).toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('region', { name: 'Bulk actions for clients' })).toBeNull();
  });

  it('sets the status of the selected clients in one call and clears the selection', async () => {
    const user = userEvent.setup();
    const calls = setup();
    const bar = await tick(user, techwave.name, mutual.name);
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set status' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set the status of 2 clients' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'New status' }),
      'inactive',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Update 2 clients' }));

    expect(await screen.findByText('2 clients updated')).toBeInTheDocument();
    expect(calls).toEqual([
      { client_ids: [techwave.id, mutual.id], action: 'set_status', value: 'inactive' },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Bulk actions for clients' })).toBeNull(),
    );
  });

  it('sets the manager, the partner and the segment, and can clear them', async () => {
    const user = userEvent.setup();
    const calls = setup();
    const grace = testMembers[0]?.user_id ?? '';

    let bar = await tick(user, techwave.name);
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set manager' }));
    let dialog = await screen.findByRole('dialog', { name: 'Set the manager of 1 client' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'New manager' }), grace);
    await user.click(within(dialog).getByRole('button', { name: 'Update 1 client' }));
    await waitFor(() => expect(calls).toHaveLength(1));

    bar = await tick(user, techwave.name);
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set partner' }));
    dialog = await screen.findByRole('dialog', { name: 'Set the partner of 1 client' });
    await user.click(within(dialog).getByRole('button', { name: 'Update 1 client' }));
    await waitFor(() => expect(calls).toHaveLength(2));

    bar = await tick(user, techwave.name);
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set segment' }));
    dialog = await screen.findByRole('dialog', { name: 'Set the segment of 1 client' });
    expect(within(dialog).getByRole('button', { name: 'Update 1 client' })).toBeDisabled();
    // The segments of Settings are offered; an inactive one is not.
    const picker = within(dialog).getByRole('combobox', { name: 'New segment' });
    expect(await within(picker).findByRole('option', { name: 'Gold' })).toBeInTheDocument();
    expect(within(picker).queryByRole('option', { name: 'Retail' })).not.toBeInTheDocument();
    await user.selectOptions(picker, 'Gold');
    await user.click(within(dialog).getByRole('button', { name: 'Update 1 client' }));
    await waitFor(() => expect(calls).toHaveLength(3));

    expect(calls).toEqual([
      { client_ids: [techwave.id], action: 'set_manager', value: grace },
      { client_ids: [techwave.id], action: 'set_partner', value: null },
      { client_ids: [techwave.id], action: 'set_segment', value: 'Gold' },
    ]);
  });

  it('archives from the toolbar with the bulk endpoint', async () => {
    const user = userEvent.setup();
    const calls = setup();
    await tick(user, techwave.name);
    await user.click(screen.getByRole('button', { name: 'Bulk actions for 1 selected' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archive selected (1)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Archive selected clients' });
    await user.click(within(dialog).getByRole('button', { name: 'Archive 1' }));
    expect(await screen.findByText('1 client archived')).toBeInTheDocument();
    expect(calls).toEqual([{ client_ids: [techwave.id], action: 'set_status', value: 'archived' }]);
  });

  it('deletes after a confirmation that says what will happen', async () => {
    const user = userEvent.setup();
    const calls = setup();
    const bar = await tick(user, mutual.name);
    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 1 client?' });
    expect(dialog).toHaveTextContent('cannot be deleted');
    await user.click(within(dialog).getByRole('button', { name: 'Delete 1 client' }));
    expect(await screen.findByText('1 client deleted')).toBeInTheDocument();
    expect(calls).toEqual([{ client_ids: [mutual.id], action: 'delete' }]);
  });

  it('keeps the dialog open and lists the clients that are in use', async () => {
    const user = userEvent.setup();
    const calls = setup(OWNER_PERMISSIONS, () =>
      fail(409, 'CLIENT_IN_USE', '1 client is in use and cannot be deleted. Nothing was deleted.', {
        details: [
          {
            client_id: techwave.id,
            code: techwave.code,
            name: techwave.name,
            reason: 'Has jobs, time, invoices. Archive it instead.',
          },
        ],
      }),
    );
    const bar = await tick(user, techwave.name, mutual.name);
    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 clients?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete 2 clients' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Nothing was deleted');
    expect(within(alert).getByText(techwave.code)).toBeInTheDocument();
    expect(alert).toHaveTextContent('Archive it instead');
    expect(calls).toHaveLength(1);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('announces the result to screen readers', async () => {
    const user = userEvent.setup();
    setup();
    const bar = await tick(user, mutual.name);
    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 1 client?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete 1 client' }));
    await waitFor(() =>
      expect(
        screen.getAllByRole('status').some((el) => el.textContent === '1 client deleted'),
      ).toBe(true),
    );
  });

  it('offers only Edit to a role that may update but not delete, and nothing to a reader', async () => {
    const user = userEvent.setup();
    setup(READ_AND_EDIT);
    const bar = await tick(user, techwave.name);
    expect(within(bar).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: 'Delete' })).toBeNull();
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set status' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set the status of 1 client' });
    // Archiving needs client.delete, so it is not offered.
    expect(within(dialog).queryByRole('option', { name: 'Archived' })).toBeNull();
  });

  it('shows a reader neither Edit nor Delete', async () => {
    const user = userEvent.setup();
    setup(STAFF_PERMISSIONS);
    const bar = await tick(user, techwave.name);
    expect(within(bar).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(bar).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(within(bar).getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });
});
