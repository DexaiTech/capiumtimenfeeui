import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { branchesOnContext, branchHandlers, london, orgApiPath } from '@/test/branches';
import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { ok, server } from '@/test/server';

import { ClientFormPanel } from '../components/ClientFormPanel';
import ClientsPage from '../pages/ClientsPage';
import { INITIAL_CLIENTS_PREFS, useClientsPrefs } from '../store';
import type { ClientListItem } from '../types';
import { mutual, techwave, techwaveDetail } from './fixtures';
import { clientsHandlers } from './handlers';

/* Ticket APT74: the branch of each client, while the practice uses branches. */

const inLondon: ClientListItem = {
  ...techwave,
  branch_id: '0198c1f2-0000-7000-8000-0000000b0001',
  branch: { id: '0198c1f2-0000-7000-8000-0000000b0001', name: 'London' },
};
const clients = [inLondon, mutual];

const table = () => screen.getByRole('table', { name: 'Clients' });
const clientRow = (name: string) => screen.findByRole('row', { name });

beforeEach(() => {
  window.localStorage.clear();
  useClientsPrefs.setState(INITIAL_CLIENTS_PREFS);
});

describe('the clients grid with branches on', () => {
  it('shows a Branch column from the column menu', async () => {
    server.use(...clientsHandlers({ clients }), ...branchHandlers());
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />, { context: branchesOnContext });

    const row = await clientRow(techwave.name);
    // Hidden at first (APT76): the grid opens on Client, Client Type, Registration, Services.
    expect(screen.queryByRole('columnheader', { name: 'Branch' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /Show\/Hide Columns/ }));
    const columns = await screen.findByRole('dialog', { name: 'Show or hide columns' });
    await user.click(within(columns).getByRole('checkbox', { name: 'Branch' }));
    await user.keyboard('{Escape}');
    const headers = within(table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers.slice(2)).toEqual([
      'Client Type',
      'Registration',
      'Services',
      'Branch',
      'Action',
    ]);
    expect(within(row).getByText('London')).toBeInTheDocument();
  });

  it('filters by one branch from the Branch select at the top (APT76)', async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      ...clientsHandlers({ clients, onList: (params) => seen.push(params) }),
      ...branchHandlers(),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />, { context: branchesOnContext });
    await clientRow(techwave.name);

    const select = screen.getByRole('combobox', { name: 'Filter by branch' });
    expect(select).toHaveValue('');
    expect(await within(select).findByRole('option', { name: 'Leeds' })).toBeInTheDocument();
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All branches', 'Bath (inactive)', 'Leeds', 'London', 'No branch']);

    await user.selectOptions(select, 'Leeds');
    await waitFor(() =>
      expect(seen.at(-1)?.getAll('branch_id')).toEqual(['0198c1f2-0000-7000-8000-0000000b0002']),
    );
    // The same filter as the Branch section of Filter.
    expect(screen.getByRole('button', { name: /^Filter\s*1/ })).toBeInTheDocument();

    await user.selectOptions(select, 'No branch');
    await waitFor(() => expect(seen.at(-1)?.get('without_branch')).toBe('true'));

    await user.selectOptions(select, 'All branches');
    await waitFor(() => {
      expect(seen.at(-1)?.getAll('branch_id')).toEqual([]);
      expect(seen.at(-1)?.get('without_branch')).toBeNull();
    });
  });

  it('filters by branch and finds the clients without one', async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      ...clientsHandlers({ clients, onList: (params) => seen.push(params) }),
      ...branchHandlers(),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />, {
      route: '/acme/clients?branch=0198c1f2-0000-7000-8000-0000000b0002',
      context: branchesOnContext,
    });
    await clientRow(techwave.name);
    // `?branch=` (the link of Settings > Branches) opens the list for that branch.
    await waitFor(() =>
      expect(seen.at(-1)?.getAll('branch_id')).toEqual(['0198c1f2-0000-7000-8000-0000000b0002']),
    );

    await user.click(screen.getByRole('button', { name: /^Filter\s*\d/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter clients' });
    const branch = within(within(panel).getByRole('group', { name: 'Branch' }));
    expect(await branch.findByRole('checkbox', { name: 'London' })).not.toBeChecked();
    expect(branch.getByRole('checkbox', { name: 'Leeds' })).toBeChecked();
    expect(branch.getByRole('checkbox', { name: 'Bath (inactive)' })).toBeInTheDocument();

    await user.click(branch.getByRole('checkbox', { name: 'Leeds' }));
    await user.click(branch.getByRole('checkbox', { name: 'No branch' }));
    await waitFor(() => expect(seen.at(-1)?.get('without_branch')).toBe('true'));
    expect(seen.at(-1)?.has('branch_id')).toBe(false);
  });
});

describe('the clients grid with branches off', () => {
  it('hides the column, its menu entry and the filter, and ignores a branch link', async () => {
    const seen: URLSearchParams[] = [];
    server.use(...clientsHandlers({ clients, onList: (params) => seen.push(params) }));
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />, {
      route: '/acme/clients?branch=0198c1f2-0000-7000-8000-0000000b0001',
    });

    const row = await clientRow(techwave.name);
    await waitFor(() => expect(seen.at(-1)?.has('branch_id')).toBe(false));
    expect(screen.queryByRole('columnheader', { name: 'Branch' })).toBeNull();
    expect(within(row).queryByText('London')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Filter by branch' })).toBeNull();

    await user.click(screen.getByRole('button', { name: /Show\/Hide Columns/ }));
    const columns = await screen.findByRole('dialog', { name: 'Show or hide columns' });
    expect(within(columns).queryByRole('checkbox', { name: 'Branch' })).toBeNull();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /^Filter$/ }));
    const filters = await screen.findByRole('dialog', { name: 'Filter clients' });
    expect(within(filters).queryByRole('group', { name: 'Branch' })).toBeNull();
  });
});

describe('the client form', () => {
  const quiet = () =>
    server.use(
      ...clientsHandlers(),
      http.get(orgApiPath('/members'), () => ok([])),
      http.get(orgApiPath('/services'), () => ok([])),
    );

  it('requires a branch while the practice uses branches, offering only active ones', async () => {
    let body: Record<string, unknown> | undefined;
    quiet();
    server.use(
      ...branchHandlers(),
      http.post(orgApiPath('/clients'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok(techwaveDetail, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientFormPanel open client={null} onClose={() => undefined} />, {
      context: branchesOnContext,
    });
    const dialog = await screen.findByRole('region', { name: 'Add Client' });
    expectRequiredFields(dialog, { required: ['Client name', 'Country', 'Branch'], optional: [] });
    const form = within(dialog);
    // The select is mounted again once the branches arrive.
    expect(await form.findByRole('option', { name: 'London' })).toBeInTheDocument();
    const select = form.getByRole('combobox', { name: 'Branch' });
    expect(within(select).queryByRole('option', { name: /Bath/ })).toBeNull();

    await user.type(form.getByRole('textbox', { name: 'Client name' }), 'Nyro Technologies');
    await user.click(form.getByRole('button', { name: 'Add Client' }));
    expect(await form.findByText("Choose the client's branch")).toBeInTheDocument();
    expect(body).toBeUndefined();

    await user.selectOptions(select, 'London');
    await user.click(form.getByRole('button', { name: 'Add Client' }));
    await waitFor(() =>
      expect(body).toMatchObject({
        name: 'Nyro Technologies',
        branch_id: '0198c1f2-0000-7000-8000-0000000b0001',
      }),
    );
  });

  it('shows the branch of the client being edited', async () => {
    quiet();
    server.use(...branchHandlers());
    renderInOrg(
      <ClientFormPanel
        open
        client={{ ...techwaveDetail, branch_id: london.id }}
        onClose={() => undefined}
      />,
      { context: branchesOnContext },
    );
    const dialog = await screen.findByRole('region', { name: `Edit ${techwaveDetail.name}` });
    await within(dialog).findByRole('option', { name: 'London' });
    expect(within(dialog).getByRole('combobox', { name: 'Branch' })).toHaveValue(london.id);
  });

  it('has no Branch field while the practice does not use branches', async () => {
    quiet();
    renderInOrg(<ClientFormPanel open client={null} onClose={() => undefined} />);
    const dialog = await screen.findByRole('region', { name: 'Add Client' });
    expect(within(dialog).queryByRole('combobox', { name: 'Branch' })).toBeNull();
  });
});
