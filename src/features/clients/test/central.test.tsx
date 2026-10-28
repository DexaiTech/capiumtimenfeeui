import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, type HttpHandler } from 'msw';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { findRowAction, rowActionNames } from '@/test/rowActions';
import { fail, ok, server } from '@/test/server';

import { INITIAL_CLIENTS_PREFS, useClientsPrefs } from '../store';
import type { ClientListItem, ClientSummary } from '../types';
import ClientsPage from '../pages/ClientsPage';
import { mutual, techwave, techwaveDetail, testSummary } from './fixtures';
import { clientsHandlers } from './handlers';
import { SERVER_PROBLEM } from './renderWorkspace';
import { centralSearchHandler } from './workspaceHandlers';
import { centralClients, globex, initech, northwind } from './workspaceFixtures';

type User = ReturnType<typeof userEvent.setup>;

const linked: ClientListItem = {
  ...techwave,
  id: '0198c1f2-0000-7000-8000-00000000c101',
  code: 'APX101',
  name: 'Globex Holdings plc',
  initials: 'GH',
  central_client_id: 'cen-1002',
  central_sync_state: 'synced',
  central_synced_at: '2026-05-12T10:00:00Z',
};
const stale: ClientListItem = {
  ...linked,
  id: '0198c1f2-0000-7000-8000-00000000c102',
  code: 'APX102',
  name: 'Stale Foods Ltd',
  central_sync_state: 'stale',
};
const lost: ClientListItem = {
  ...linked,
  id: '0198c1f2-0000-7000-8000-00000000c103',
  code: 'APX103',
  name: 'Lost Cargo Ltd',
  central_sync_state: 'failed',
};
const merged: ClientListItem = {
  ...mutual,
  central_client_id: 'cen-2001',
  central_sync_state: 'synced',
  central_synced_at: '2026-05-12T10:00:00Z',
  merged_into_client_id: techwave.id,
};
const withCentral: ClientListItem[] = [techwave, linked, stale, lost, merged];

interface RenderOptions {
  permissions?: string[];
  clients?: ClientListItem[];
  summary?: ClientSummary;
  /** Handlers that win over the list ones, for one test's scenario. */
  handlers?: HttpHandler[];
  onList?: (params: URLSearchParams) => void;
}

function renderList({
  permissions = OWNER_PERMISSIONS,
  clients = withCentral,
  summary,
  handlers = [],
  onList,
}: RenderOptions = {}) {
  server.use(
    ...handlers,
    ...clientsHandlers({ clients, summary, onList }),
    // After the list handlers: `/clients/summary` must not be taken for a client id.
    http.get(orgApiPath('/clients/:clientId'), () => ok(techwaveDetail)),
  );
  return renderInOrg(
    <Routes>
      <Route path="/acme/clients" element={<ClientsPage />} />
      <Route path="/acme/clients/:clientId/*" element={<p>Opened client page</p>} />
    </Routes>,
    { route: '/acme/clients', context: contextWith(permissions) },
  );
}

const row = (name: string) => screen.findByRole('row', { name });
const notifications = () => within(screen.getByRole('list', { name: 'Notifications' }));

/** The list item of a central client, by its name. */
const item = (list: HTMLElement, name: string) => {
  const found = within(list).getByText(name).closest('li');
  if (!found) throw new Error(`No list item for ${name}`);
  return found;
};

/** The names of the actions of a row, once it is on screen. */
async function actionsOf(name: string) {
  await screen.findByRole('group', { name: `Actions for ${name}` });
  return rowActionNames(`Actions for ${name}`);
}

beforeEach(() => {
  window.localStorage.clear();
  useClientsPrefs.setState(INITIAL_CLIENTS_PREFS);
});

describe('the Central column', () => {
  it('shows where each client stands with the central service', async () => {
    renderList();
    expect(within(await row(techwave.name)).getByText('Local')).toBeInTheDocument();
    expect(within(await row(linked.name)).getByText('Synced 12/05/2026')).toBeInTheDocument();
    expect(within(await row(stale.name)).getByText('Stale')).toBeInTheDocument();
    expect(within(await row(lost.name)).getByText('Not found centrally')).toBeInTheDocument();
  });

  it('says where a merged-away client went and links to it', async () => {
    renderList();
    const mergedRow = await row(mutual.name);
    const note = await within(mergedRow).findByRole('link', { name: 'Techwave Innovations Ltd' });
    expect(within(mergedRow).getByText(/Merged into/)).toBeInTheDocument();
    expect(note).toHaveAttribute('href', `/acme/clients/${techwave.id}/overview`);
  });

  it('can be hidden from the Columns menu', async () => {
    const user = userEvent.setup();
    renderList();
    await row(techwave.name);
    expect(screen.getByRole('columnheader', { name: 'Central' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show\/Hide Columns/ }));
    const panel = await screen.findByRole('dialog', { name: 'Show or hide columns' });
    await user.click(within(panel).getByRole('checkbox', { name: 'Central' }));
    expect(screen.queryByRole('columnheader', { name: 'Central' })).toBeNull();
    expect(screen.queryByText('Synced 12/05/2026')).toBeNull();
  });

  it('shows the central chip on the cards of the grid view', async () => {
    const user = userEvent.setup();
    renderList();
    await row(techwave.name);
    await user.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(await screen.findAllByText('Synced 12/05/2026')).not.toHaveLength(0);
    expect(screen.getAllByText('Local')).not.toHaveLength(0);
  });
});

describe('the central filter', () => {
  it('sends central=linked or central=local to the API', async () => {
    const seen: URLSearchParams[] = [];
    const user = userEvent.setup();
    renderList({ onList: (params) => seen.push(params) });
    await row(techwave.name);
    expect(seen.at(-1)?.get('central')).toBeNull();

    await user.click(screen.getByRole('button', { name: /^Filter$/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter clients' });
    const central = within(panel).getByRole('combobox', { name: 'Central' });
    await user.selectOptions(central, 'Linked to central');
    await waitFor(() => expect(seen.at(-1)?.get('central')).toBe('linked'));
    expect(screen.getByRole('button', { name: /Filter.*1 filters applied/ })).toBeInTheDocument();

    await user.selectOptions(central, 'Local only');
    await waitFor(() => expect(seen.at(-1)?.get('central')).toBe('local'));

    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(seen.at(-1)?.get('central')).toBeNull());
  });
});

describe('Sync all linked', () => {
  const syncAll = (body: object) => http.post(orgApiPath('/clients/central-sync'), () => ok(body));
  const result = {
    available: true,
    processed: 3,
    synced: 2,
    stale: 0,
    failed: 1,
    changed: 1,
    remaining: 0,
    results: [],
  };

  it('synchronises every linked client and reports the outcome', async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderList({
      handlers: [
        http.post(orgApiPath('/clients/central-sync'), () => {
          calls += 1;
          return ok(result);
        }),
      ],
    });
    await row(techwave.name);

    await user.click(screen.getByRole('button', { name: 'Sync all linked' }));
    await waitFor(() => expect(calls).toBe(1));
    expect(
      await notifications().findByText('Synchronised 2 of 3 linked clients'),
    ).toBeInTheDocument();
    expect(
      notifications().getByText('1 client changed · 1 not found centrally.'),
    ).toBeInTheDocument();
  });

  it('warns about a partial run', async () => {
    const user = userEvent.setup();
    renderList({ handlers: [syncAll({ ...result, failed: 0, changed: 2, remaining: 5 })] });
    await row(techwave.name);

    await user.click(screen.getByRole('button', { name: 'Sync all linked' }));
    expect(
      await notifications().findByText('2 clients changed · 5 left: synchronise again.'),
    ).toBeInTheDocument();
  });

  it('says when the central service was unavailable', async () => {
    const user = userEvent.setup();
    renderList({
      handlers: [syncAll({ ...result, available: false, synced: 0, stale: 3, failed: 0 })],
    });
    await row(techwave.name);

    await user.click(screen.getByRole('button', { name: 'Sync all linked' }));
    expect(await notifications().findByText('Central service unavailable')).toBeInTheDocument();
    expect(
      notifications().getByText('3 linked clients were kept as they are and marked stale.'),
    ).toBeInTheDocument();
  });

  it('reports a failed request', async () => {
    const user = userEvent.setup();
    renderList({
      handlers: [
        http.post(orgApiPath('/clients/central-sync'), () => fail(500, 'INTERNAL_ERROR', 'Boom.')),
      ],
    });
    await row(techwave.name);

    await user.click(screen.getByRole('button', { name: 'Sync all linked' }));
    expect(
      await notifications().findByText('Could not synchronise the linked clients'),
    ).toBeInTheDocument();
    expect(notifications().getByText(SERVER_PROBLEM)).toBeInTheDocument();
  });

  it('is off while no client is linked', async () => {
    renderList({ summary: { ...testSummary, by_central: { linked: 0, local: 12 } } });
    await row(techwave.name);
    // The summary arrives after the list.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sync all linked' })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: 'Sync all linked' })).toHaveAttribute(
      'title',
      'No client is linked to the central service',
    );
  });

  it('is left out for a role that may not update clients', async () => {
    renderList({ permissions: STAFF_PERMISSIONS });
    await row(techwave.name);
    expect(screen.queryByRole('button', { name: 'Sync all linked' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Central clients' })).toBeNull();
  });
});

describe('Sync with central, from the row actions', () => {
  it('is offered for linked clients only', async () => {
    renderList();

    expect(await actionsOf(linked.name)).toEqual([
      'View',
      'Edit',
      'Sync with central',
      'Archive',
      'Delete',
    ]);
    expect(await actionsOf(techwave.name)).not.toContain('Sync with central');
    // A merged-away client is history: nothing to synchronise.
    expect(await actionsOf(mutual.name)).not.toContain('Sync with central');
  });

  it('synchronises the one client and says what happened', async () => {
    const calls: string[] = [];
    const user = userEvent.setup();
    renderList({
      handlers: [
        http.post(orgApiPath('/clients/:clientId/central-sync'), ({ params }) => {
          calls.push(String(params.clientId));
          return ok({
            client_id: linked.id,
            code: linked.code,
            name: linked.name,
            central_id: 'cen-1002',
            state: 'synced',
            changed: true,
            changes: { postcode: ['LS1 1AA', 'LS1 2AB'] },
            from_cache: false,
            message: 'Postcode updated.',
            synced_at: '2026-06-15T10:00:00Z',
          });
        }),
      ],
    });
    await user.click(await findRowAction(`Actions for ${linked.name}`, 'Sync with central'));

    await waitFor(() => expect(calls).toEqual([linked.id]));
    expect(await notifications().findByText('Synchronised with central')).toBeInTheDocument();
    expect(
      notifications().getByText(/Globex Holdings plc: Postcode updated\./),
    ).toBeInTheDocument();
  });

  it('says when the central service no longer knows the client', async () => {
    const user = userEvent.setup();
    renderList({
      handlers: [
        http.post(orgApiPath('/clients/:clientId/central-sync'), () =>
          ok({
            client_id: lost.id,
            code: lost.code,
            name: lost.name,
            central_id: 'cen-1002',
            state: 'failed',
            changed: false,
            changes: {},
            from_cache: false,
            message: null,
            synced_at: null,
          }),
        ),
      ],
    });
    await user.click(await findRowAction(`Actions for ${lost.name}`, 'Sync with central'));
    expect(await notifications().findByText('Not found centrally')).toBeInTheDocument();
  });
});

describe('CentralClientsDialog', () => {
  const search = (options: Parameters<typeof centralSearchHandler>[0] = {}) =>
    centralSearchHandler(options);
  const open = async (user: User, options: RenderOptions = {}) => {
    renderList(options);
    await row(techwave.name);
    await user.click(screen.getByRole('button', { name: 'Central clients' }));
    return screen.findByRole('dialog', { name: 'Central clients' });
  };

  it('lists what the central service has, with who can be enabled', async () => {
    const user = userEvent.setup();
    const dialog = await open(user, { handlers: [search()] });

    const list = await within(dialog).findByRole('list', { name: 'Central clients' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);

    const northwindItem = item(list, 'Northwind Traders Ltd');
    expect(northwindItem).toHaveTextContent('Active');
    expect(northwindItem).toHaveTextContent(
      'Company no. 01234567 · 10 Dock Road, Bristol, BS1 4DJ',
    );
    expect(
      within(northwindItem).getByRole('button', { name: 'Enable Northwind Traders Ltd' }),
    ).toBeEnabled();

    const globexItem = item(list, 'Globex Holdings plc');
    expect(within(globexItem).getByText('Enabled')).toBeInTheDocument();
    expect(within(globexItem).queryByRole('button', { name: /^Enable / })).toBeNull();
    expect(within(globexItem).getByRole('button', { name: 'Open APX006' })).toBeInTheDocument();

    expect(item(list, 'Initech Ltd')).toHaveTextContent(
      'Matches your client Mutual Technologies (APX007): enabling links it instead of creating a new client.',
    );
  });

  it('searches once typing stops', async () => {
    const queries: Array<string | null> = [];
    const user = userEvent.setup();
    const dialog = await open(user, { handlers: [search({ onQuery: (q) => queries.push(q) })] });
    await within(dialog).findByRole('list', { name: 'Central clients' });
    expect(queries).toEqual([null]);

    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Search central clients' }),
      'north',
    );
    await waitFor(() => expect(queries.at(-1)).toBe('north'));
    // Only the settled text is sent, not every key.
    expect(queries.filter((q) => q !== null && q.length < 5)).toEqual([]);
    await waitFor(() => expect(within(dialog).getAllByRole('listitem')).toHaveLength(1));
    expect(within(dialog).getByText('Northwind Traders Ltd')).toBeInTheDocument();
  });

  it('says nothing matches', async () => {
    const user = userEvent.setup();
    const dialog = await open(user, { handlers: [search()] });
    await within(dialog).findByRole('list', { name: 'Central clients' });

    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Search central clients' }),
      'zzz',
    );
    expect(await within(dialog).findByText('No central clients match')).toBeInTheDocument();
  });

  it('says the central service has nothing to enable', async () => {
    const user = userEvent.setup();
    const dialog = await open(user, { handlers: [search({ items: [] })] });
    expect(await within(dialog).findByText('No central clients yet')).toBeInTheDocument();
  });

  it('warns that the data may be out of date when it comes from the cache', async () => {
    const user = userEvent.setup();
    const dialog = await open(user, {
      handlers: [search({ source: 'cache', stale: true })],
    });

    const banner = await within(dialog).findByText(
      'Central service unavailable: showing cached data',
    );
    expect(banner).toHaveAttribute('role', 'status');
    // The cached clients are still listed.
    expect(within(dialog).getByText('Northwind Traders Ltd')).toBeInTheDocument();
  });

  it('shows no warning when the answer is live', async () => {
    const user = userEvent.setup();
    const dialog = await open(user, { handlers: [search()] });
    await within(dialog).findByRole('list', { name: 'Central clients' });
    expect(within(dialog).queryByText(/showing cached data/)).toBeNull();
  });

  it('shows an error state with a retry when the service is down and nothing is cached', async () => {
    let calls = 0;
    const user = userEvent.setup();
    const dialog = await open(user, {
      handlers: [
        http.get(orgApiPath('/central-clients'), () => {
          calls += 1;
          return calls === 1
            ? fail(503, 'CENTRAL_UNAVAILABLE', 'The central service is not available.')
            : ok({ items: centralClients, source: 'live', stale: false });
        }),
      ],
    });

    expect(await within(dialog).findByText('Central clients are unavailable')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByText('Northwind Traders Ltd')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  describe('enabling a client', () => {
    const detail = (name: string, code: string) => ({
      ...techwaveDetail,
      id: '0198c1f2-0000-7000-8000-00000000c200',
      name,
      code,
    });
    const enable = (
      result: 'created' | 'linked_existing' | 'already_enabled',
      fromCache = false,
      calls: string[] = [],
    ) =>
      http.post(orgApiPath('/central-clients/:centralId/enable'), ({ params }) => {
        calls.push(String(params.centralId));
        return ok(
          {
            result,
            from_cache: fromCache,
            client: detail('Northwind Traders Ltd', 'APX200'),
          },
          { status: result === 'created' ? 201 : 200 },
        );
      });

    it('creates a client and offers to open it', async () => {
      const calls: string[] = [];
      const user = userEvent.setup();
      const dialog = await open(user, { handlers: [search(), enable('created', false, calls)] });

      await user.click(
        await within(dialog).findByRole('button', { name: `Enable ${northwind.name}` }),
      );
      await waitFor(() => expect(calls).toEqual([northwind.central_id]));

      const toasts = notifications();
      expect(await toasts.findByText('Client created')).toBeInTheDocument();
      expect(
        toasts.getByText('Northwind Traders Ltd (APX200) was added to this practice.'),
      ).toBeInTheDocument();
      await user.click(toasts.getByRole('button', { name: 'Open client' }));
      expect(await screen.findByText('Opened client page')).toBeInTheDocument();
    });

    it('links an existing client with the same company number', async () => {
      const user = userEvent.setup();
      const dialog = await open(user, { handlers: [search(), enable('linked_existing')] });

      await user.click(
        await within(dialog).findByRole('button', { name: `Enable ${initech.name}` }),
      );
      const toasts = notifications();
      expect(await toasts.findByText('Linked to your existing client')).toBeInTheDocument();
      expect(
        toasts.getByText(
          'Northwind Traders Ltd (APX200) now follows the central name and address.',
        ),
      ).toBeInTheDocument();
      expect(toasts.getByRole('button', { name: 'Open client' })).toBeInTheDocument();
    });

    it('says when the client was already enabled', async () => {
      const user = userEvent.setup();
      const dialog = await open(user, { handlers: [search(), enable('already_enabled')] });

      await user.click(
        await within(dialog).findByRole('button', { name: `Enable ${northwind.name}` }),
      );
      const toasts = notifications();
      expect(await toasts.findByText('Already enabled')).toBeInTheDocument();
      expect(
        toasts.getByText('Northwind Traders Ltd (APX200) is already in this practice.'),
      ).toBeInTheDocument();
    });

    it('warns when the cached details were used', async () => {
      const user = userEvent.setup();
      const dialog = await open(user, { handlers: [search(), enable('created', true)] });

      await user.click(
        await within(dialog).findByRole('button', { name: `Enable ${northwind.name}` }),
      );
      expect(
        await notifications().findByText(
          /The central service was unavailable: cached details were used\./,
        ),
      ).toBeInTheDocument();
    });

    it('reports a refusal', async () => {
      const user = userEvent.setup();
      const dialog = await open(user, {
        handlers: [
          search(),
          http.post(orgApiPath('/central-clients/:centralId/enable'), () =>
            fail(409, 'CENTRAL_CLIENT_ARCHIVED', 'This central client is archived.'),
          ),
        ],
      });

      await user.click(
        await within(dialog).findByRole('button', { name: `Enable ${northwind.name}` }),
      );
      expect(await notifications().findByText('Could not enable the client')).toBeInTheDocument();
      expect(notifications().getByText('This central client is archived.')).toBeInTheDocument();
    });

    it('cannot enable a client archived centrally', async () => {
      const user = userEvent.setup();
      const dialog = await open(user, {
        handlers: [
          search({
            items: [{ ...northwind, name: 'Old Ltd', central_id: 'cen-9', status: 'archived' }],
          }),
        ],
      });
      expect(await within(dialog).findByText('Archived centrally')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Enable Old Ltd' })).toBeDisabled();
    });

    it('opens an enabled client from the list', async () => {
      const user = userEvent.setup();
      const dialog = await open(user, { handlers: [search({ items: [globex] })] });

      await user.click(await within(dialog).findByRole('button', { name: 'Open APX006' }));
      expect(await screen.findByText('Opened client page')).toBeInTheDocument();
    });
  });
});
