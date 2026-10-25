import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import { INITIAL_RECENT_CLIENTS, useRecentClientsStore } from '../recents';
import { mutual, ORG_ID, techwave, techwaveDetail } from '../test/fixtures';
import { header, heading, renderWorkspace, SERVER_PROBLEM, where } from '../test/renderWorkspace';
import {
  linkedDetail,
  mergedDetail,
  mutualDetail,
  staffOverview,
  techwaveOverview,
} from '../test/workspaceFixtures';
import type { ClientDetail } from '../types';

const OVERVIEW = `/acme/clients/${techwave.id}/overview`;
const MANAGED = 'Managed by the Capium central client service';

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

beforeEach(() => {
  window.localStorage.clear();
  useRecentClientsStore.setState(INITIAL_RECENT_CLIENTS);
});

describe('ClientDetailPage routing', () => {
  it('opens the overview for the bare client URL and keeps the tab in the URL', async () => {
    const user = userEvent.setup();
    renderWorkspace(`/acme/clients/${techwave.id}`);

    await heading('Techwave Innovations Ltd');
    expect(where()).toHaveTextContent(OVERVIEW);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Contacts/ }));
    expect(where()).toHaveTextContent(`/acme/clients/${techwave.id}/contacts`);
    expect(screen.getByRole('tab', { name: /^Contacts/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Contacts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Clients' })).toHaveAttribute(
      'href',
      '/acme/clients',
    );
  });

  it('opens a tab straight from its URL', async () => {
    renderWorkspace(`/acme/clients/${techwave.id}/contacts`);
    expect(await screen.findByRole('table', { name: /Contacts of/ })).toBeInTheDocument();
    expect(where()).toHaveTextContent(`/acme/clients/${techwave.id}/contacts`);
  });

  it('falls back to the overview for an unknown tab', async () => {
    renderWorkspace(`/acme/clients/${techwave.id}/nonsense`);
    await heading('Techwave Innovations Ltd');
    expect(where()).toHaveTextContent(OVERVIEW);
  });

  it('shows the tab badges from the overview counts, in order', async () => {
    renderWorkspace(OVERVIEW);
    await heading('Techwave Innovations Ltd');

    await waitFor(() => expect(tabNames()).toContain('Jobs3'));
    expect(tabNames()).toEqual([
      'Overview',
      'Jobs3',
      'Time18',
      'Expenses2',
      'WIP5',
      'Invoices4',
      'Payments3',
      'Contacts2',
      'History',
      'Settings',
    ]);
  });

  it('hides the tabs the role may not open', async () => {
    renderWorkspace(OVERVIEW, { permissions: STAFF_PERMISSIONS, overview: staffOverview });
    await heading('Techwave Innovations Ltd');

    // Staff: no wip.read, invoice.read or payment.read.
    await waitFor(() => expect(tabNames()).toContain('Jobs3'));
    expect(tabNames()).toEqual([
      'Overview',
      'Jobs3',
      'Time18',
      'Expenses2',
      'Contacts2',
      'Settings',
    ]);
    expect(screen.queryByRole('tab', { name: /Invoices/ })).toBeNull();
  });

  it('opens the overview when the URL names a tab the role may not see', async () => {
    renderWorkspace(`/acme/clients/${techwave.id}/invoices`, {
      permissions: STAFF_PERMISSIONS,
      overview: staffOverview,
    });
    await heading('Techwave Innovations Ltd');
    expect(where()).toHaveTextContent(OVERVIEW);
  });

  it('remembers the client for the Client 360 page', async () => {
    renderWorkspace(OVERVIEW);
    await heading('Techwave Innovations Ltd');
    await waitFor(() =>
      expect(useRecentClientsStore.getState().byOrganization[ORG_ID]).toEqual([
        { id: techwave.id, name: techwave.name, code: techwave.code },
      ]),
    );
  });
});

describe('ClientDetailPage states', () => {
  it('shows a skeleton while the client loads', async () => {
    renderWorkspace(OVERVIEW);
    expect(screen.getByRole('status', { name: 'Loading the client' })).toBeInTheDocument();
    await heading('Techwave Innovations Ltd');
  });

  it('says when the client does not exist and drops it from the recent list', async () => {
    const missing = '0198c1f2-0000-7000-8000-00000000c999';
    useRecentClientsStore
      .getState()
      .remember(ORG_ID, { id: missing, name: 'Gone Ltd', code: 'GONE1' });
    renderWorkspace(`/acme/clients/${missing}/overview`);

    expect(await screen.findByRole('heading', { name: 'Client not found' })).toBeInTheDocument();
    await waitFor(() =>
      expect(useRecentClientsStore.getState().byOrganization[ORG_ID]).toEqual([]),
    );
  });

  it('explains a failed load and retries', async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      handlers: [
        http.get(orgApiPath('/clients/:clientId'), () => {
          calls += 1;
          return calls === 1
            ? fail(500, 'INTERNAL_ERROR', 'The server had a problem.')
            : ok(techwaveDetail);
        }),
      ],
    });

    expect(await screen.findByText('Could not load the client')).toBeInTheDocument();
    expect(screen.getByText(SERVER_PROBLEM)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await heading('Techwave Innovations Ltd');
  });
});

describe('ClientHeader', () => {
  it('shows who the client is and the actions the role may use', async () => {
    renderWorkspace(OVERVIEW);
    await heading('Techwave Innovations Ltd');

    const card = within(header());
    expect(card.getByText('APX006')).toBeInTheDocument();
    expect(card.getByText('Limited')).toBeInTheDocument();
    expect(card.getByText('Active')).toBeInTheDocument();
    expect(card.getByText('Local')).toBeInTheDocument();
    expect(card.getByText('Bronze')).toBeInTheDocument();
    // The manager's name comes from the staff directory.
    expect(await card.findByText('Grace Hopper')).toBeInTheDocument();
    expect(card.getByRole('meter', { name: 'Client health' })).toHaveAttribute(
      'aria-valuenow',
      '83',
    );
    expect(card.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
    // A new job opens with this client already chosen.
    expect(card.getByRole('link', { name: 'New job' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/jobs\?new=1&client_id=.+/),
    );
    expect(card.getByRole('link', { name: 'Bill client' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/billing\/prepare\?client=.+/),
    );
    // A local client has nothing to synchronise.
    expect(card.queryByRole('button', { name: 'Sync with central' })).toBeNull();
    expect(card.queryByRole('button', { name: 'Restore' })).toBeNull();
  });

  it('leaves out the actions a read-only role may not use', async () => {
    renderWorkspace(OVERVIEW, { permissions: STAFF_PERMISSIONS, overview: staffOverview });
    await heading('Techwave Innovations Ltd');

    const card = within(header());
    expect(card.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(card.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(card.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });

  it('opens the settings from the More menu', async () => {
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW);
    await heading('Techwave Innovations Ltd');

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Client settings' }));
    expect(where()).toHaveTextContent(`/acme/clients/${techwave.id}/settings`);
  });

  it('archives the client after a confirmation', async () => {
    const archived: string[] = [];
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      handlers: [
        http.post(orgApiPath('/clients/:clientId/archive'), ({ params }) => {
          archived.push(String(params.clientId));
          return ok({ ...techwaveDetail, status: 'archived' });
        }),
      ],
    });
    await heading('Techwave Innovations Ltd');

    await user.click(within(header()).getByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('dialog', { name: 'Archive client' });
    expect(archived).toEqual([]);
    expect(dialog).toHaveTextContent('Techwave Innovations Ltd will be hidden');
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));

    await waitFor(() => expect(archived).toEqual([techwave.id]));
    expect(await screen.findByText('Client archived')).toBeInTheDocument();
  });

  it('keeps the client when the archive is cancelled', async () => {
    const archived: string[] = [];
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      handlers: [
        http.post(orgApiPath('/clients/:clientId/archive'), ({ params }) => {
          archived.push(String(params.clientId));
          return ok({ ...techwaveDetail, status: 'archived' });
        }),
      ],
    });
    await heading('Techwave Innovations Ltd');

    await user.click(within(header()).getByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('dialog', { name: 'Archive client' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Archive client' })).toBeNull(),
    );
    expect(archived).toEqual([]);
  });

  it('explains a refused archive inside the dialog', async () => {
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      handlers: [
        http.post(orgApiPath('/clients/:clientId/archive'), () =>
          fail(409, 'CLIENT_IN_USE', 'The client still has open jobs.'),
        ),
      ],
    });
    await heading('Techwave Innovations Ltd');

    await user.click(within(header()).getByRole('button', { name: 'Archive' }));
    const dialog = await screen.findByRole('dialog', { name: 'Archive client' });
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The client still has open jobs.',
    );
  });

  it('restores an archived client after a confirmation', async () => {
    const bodies: unknown[] = [];
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      clients: [{ ...techwaveDetail, status: 'archived' }],
      handlers: [
        http.patch(orgApiPath('/clients/:clientId'), async ({ request }) => {
          bodies.push(await request.json());
          return ok(techwaveDetail);
        }),
      ],
    });
    await heading('Techwave Innovations Ltd');

    expect(within(header()).queryByRole('button', { name: 'Archive' })).toBeNull();
    await user.click(within(header()).getByRole('button', { name: 'Restore' }));
    const dialog = await screen.findByRole('dialog', { name: 'Restore client' });
    await user.click(within(dialog).getByRole('button', { name: 'Restore' }));

    await waitFor(() => expect(bodies).toEqual([{ status: 'active' }]));
    expect(await screen.findByText('Client restored')).toBeInTheDocument();
  });
});

describe('ClientHeader central link', () => {
  const synced = (state: 'synced' | 'stale', changed: boolean, message: string | null) =>
    http.post(orgApiPath('/clients/:clientId/central-sync'), () =>
      ok({
        client_id: techwave.id,
        code: techwave.code,
        name: techwave.name,
        central_id: 'cen-0001',
        state,
        changed,
        changes: changed ? { city: ['London', 'Leeds'] } : {},
        from_cache: state === 'stale',
        message,
        synced_at: state === 'synced' ? '2026-06-15T10:00:00Z' : null,
      }),
    );

  it('shows the central chip with the date of the last confirmation', async () => {
    renderWorkspace(OVERVIEW, { clients: [linkedDetail] });
    await heading('Techwave Innovations Ltd');
    expect(within(header()).getByText('Synced 12/05/2026')).toBeInTheDocument();
  });

  it('shows a stale link', async () => {
    renderWorkspace(OVERVIEW, { clients: [{ ...linkedDetail, central_sync_state: 'stale' }] });
    await heading('Techwave Innovations Ltd');
    expect(within(header()).getByText('Stale')).toBeInTheDocument();
  });

  it('synchronises with central and says what changed', async () => {
    const calls: string[] = [];
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      clients: [linkedDetail],
      handlers: [
        http.post(orgApiPath('/clients/:clientId/central-sync'), ({ params }) => {
          calls.push(String(params.clientId));
          return ok({
            client_id: techwave.id,
            code: techwave.code,
            name: techwave.name,
            central_id: 'cen-0001',
            state: 'synced',
            changed: true,
            changes: { city: ['London', 'Leeds'] },
            from_cache: false,
            message: 'Address updated.',
            synced_at: '2026-06-15T10:00:00Z',
          });
        }),
      ],
    });
    await heading('Techwave Innovations Ltd');

    await user.click(within(header()).getByRole('button', { name: 'Sync with central' }));
    await waitFor(() => expect(calls).toEqual([techwave.id]));
    expect(await screen.findByText('Synchronised with central')).toBeInTheDocument();
    expect(screen.getByText(/Address updated\./)).toBeInTheDocument();
  });

  it('says when nothing changed', async () => {
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      clients: [linkedDetail],
      handlers: [synced('synced', false, null)],
    });
    await heading('Techwave Innovations Ltd');

    await user.click(within(header()).getByRole('button', { name: 'Sync with central' }));
    expect(await screen.findByText('Already up to date')).toBeInTheDocument();
  });

  it('warns when the central service was unavailable', async () => {
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      clients: [linkedDetail],
      handlers: [synced('stale', false, null)],
    });
    await heading('Techwave Innovations Ltd');

    await user.click(within(header()).getByRole('button', { name: 'Sync with central' }));
    expect(await screen.findByText('Central service unavailable')).toBeInTheDocument();
  });

  it('reports a failed synchronisation', async () => {
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      clients: [linkedDetail],
      handlers: [
        http.post(orgApiPath('/clients/:clientId/central-sync'), () =>
          fail(503, 'CENTRAL_UNAVAILABLE', 'The central service is not available.'),
        ),
      ],
    });
    await heading('Techwave Innovations Ltd');

    await user.click(within(header()).getByRole('button', { name: 'Sync with central' }));
    expect(await screen.findByText('Could not synchronise the client')).toBeInTheDocument();
    expect(screen.getByText(SERVER_PROBLEM)).toBeInTheDocument();
  });
});

describe('merged-away clients', () => {
  const route = `/acme/clients/${mutual.id}/overview`;
  const merged = {
    clients: [mergedDetail, techwaveDetail],
    overview: { ...techwaveOverview, client_id: mutual.id },
  };

  it('say where the work went and offer no edits', async () => {
    renderWorkspace(route, merged);
    await heading('Mutual Technologies');

    const card = within(header());
    expect(card.getByRole('status')).toHaveTextContent(
      'This client was merged into Techwave Innovations Ltd (APX006)',
    );
    expect(card.getByRole('link', { name: 'Techwave Innovations Ltd (APX006)' })).toHaveAttribute(
      'href',
      OVERVIEW,
    );
    expect(card.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(card.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(card.queryByRole('button', { name: 'Restore' })).toBeNull();
    expect(card.queryByRole('button', { name: 'Sync with central' })).toBeNull();
  });

  it('leave the settings read-only', async () => {
    renderWorkspace(`/acme/clients/${mutual.id}/settings`, merged);
    await heading('Mutual Technologies');

    expect(
      await screen.findByText(/This client was merged into another one and/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save billing settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archive client' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unlink' })).toBeNull();
  });
});

describe('editing a client linked to the central service', () => {
  const linked: ClientDetail = { ...linkedDetail, phone: '020 7946 0000' };

  it('keeps the name and the address managed centrally', async () => {
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, { clients: [linked] });
    await heading('Techwave Innovations Ltd');

    await user.click(within(header()).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('region', { name: /Edit Techwave Innovations Ltd/ });

    const name = within(dialog).getByRole('textbox', { name: 'Client name' });
    expect(name).toBeDisabled();
    expect(name).toHaveAccessibleDescription(MANAGED);
    for (const label of [
      'Address line 1',
      'Address line 2',
      'Town or city',
      'Postcode',
      'Country',
    ]) {
      const field = within(dialog).getByRole('textbox', { name: label });
      expect(field).toBeDisabled();
      expect(field).toHaveAccessibleDescription(MANAGED);
    }
    // Everything else stays editable.
    expect(within(dialog).getByRole('textbox', { name: 'Phone' })).toBeEnabled();
    expect(within(dialog).getByRole('textbox', { name: 'Client code' })).toBeEnabled();
  });

  it('saves only the fields that changed and does not send the managed ones', async () => {
    const bodies: unknown[] = [];
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      clients: [linked],
      handlers: [
        http.patch(orgApiPath('/clients/:clientId'), async ({ request }) => {
          bodies.push(await request.json());
          return ok(linked);
        }),
      ],
    });
    await heading('Techwave Innovations Ltd');

    await user.click(within(header()).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('region', { name: /Edit Techwave Innovations Ltd/ });
    const phone = within(dialog).getByRole('textbox', { name: 'Phone' });
    await user.clear(phone);
    await user.type(phone, '020 7946 1111');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(bodies).toEqual([{ phone: '020 7946 1111' }]));
  });

  it('maps a 409 CLIENT_FIELD_MANAGED_CENTRALLY onto the fields it names', async () => {
    const user = userEvent.setup();
    // Someone linked the client while the form was open: its fields were still editable.
    renderWorkspace(OVERVIEW, {
      clients: [techwaveDetail],
      handlers: [
        http.patch(orgApiPath('/clients/:clientId'), () =>
          fail(409, 'CLIENT_FIELD_MANAGED_CENTRALLY', 'These fields are managed centrally.', {
            details: [{ field: 'name' }, { field: 'city' }],
          }),
        ),
      ],
    });
    await heading('Techwave Innovations Ltd');

    await user.click(within(header()).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('region', { name: /Edit Techwave Innovations Ltd/ });
    const city = within(dialog).getByRole('textbox', { name: 'Town or city' });
    await user.clear(city);
    await user.type(city, 'Leeds');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    const alerts = await within(dialog).findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toContain(MANAGED);
    expect(within(dialog).getByRole('textbox', { name: 'Town or city' })).toBeInvalid();
    expect(within(dialog).getByRole('textbox', { name: 'Client name' })).toBeInvalid();
  });

  it('lets an unlinked client be edited fully', async () => {
    const user = userEvent.setup();
    renderWorkspace(`/acme/clients/${mutual.id}/overview`, {
      clients: [mutualDetail],
      overview: { ...techwaveOverview, client_id: mutual.id },
    });
    await heading('Mutual Technologies');

    await user.click(within(header()).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('region', { name: /Edit Mutual Technologies/ });
    expect(within(dialog).getByRole('textbox', { name: 'Client name' })).toBeEnabled();
    expect(within(dialog).getByRole('textbox', { name: 'Town or city' })).toBeEnabled();
  });
});
