import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import { INITIAL_RECENT_CLIENTS, RECENT_CLIENTS_LIMIT, useRecentClientsStore } from '../recents';
import { mutual, ORG_ID, techwave, techwaveDetail } from '../test/fixtures';
import { clientsHandlers } from '../test/handlers';
import { centralSearchHandler } from '../test/workspaceHandlers';
import Client360Page from './Client360Page';

/** Where a client opened from the page lands. */
function Opened() {
  return <p data-testid="opened">{useLocation().pathname}</p>;
}

function renderLanding({
  permissions = OWNER_PERMISSIONS,
  onList,
}: { permissions?: string[]; onList?: (params: URLSearchParams) => void } = {}) {
  server.use(
    ...clientsHandlers({ onList }),
    // After the list handlers: `/clients/summary` must not be taken for a client id.
    http.get(orgApiPath('/clients/:clientId'), () => ok(techwaveDetail)),
    centralSearchHandler(),
  );
  return renderInOrg(
    <Routes>
      <Route path="/acme/clients/360" element={<Client360Page />} />
      <Route path="/acme/clients/:clientId/*" element={<Opened />} />
    </Routes>,
    { route: '/acme/clients/360', context: contextWith(permissions) },
  );
}

const search = () => screen.getByRole('combobox', { name: 'Find a client' });
const recent = () => within(screen.getByRole('region', { name: 'Recently viewed' }));
const opened = () => screen.getByTestId('opened');

const remember = (n: number, organizationId = ORG_ID) =>
  useRecentClientsStore.getState().remember(organizationId, {
    id: `0198c1f2-0000-7000-8000-${String(n).padStart(12, '0')}`,
    name: `Recent client ${String(n)}`,
    code: `R${String(n)}`,
  });

beforeEach(() => {
  window.localStorage.clear();
  useRecentClientsStore.setState(INITIAL_RECENT_CLIENTS);
});

describe('Client360Page', () => {
  it('replaces the placeholder with a search and a recent list', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1, name: 'Client 360' })).toBeInTheDocument();
    expect(
      screen.getByText('Pick a client to see everything about them in one place.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('search', { name: 'Find a client' })).toBeInTheDocument();
    expect(search()).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Recently viewed' })).toBeInTheDocument();
  });

  it('finds clients while typing and opens the overview of the one chosen', async () => {
    const seen: URLSearchParams[] = [];
    const user = userEvent.setup();
    renderLanding({ onList: (params) => seen.push(params) });

    await user.type(search(), 'wave');
    await waitFor(() => expect(seen.at(-1)?.get('q')).toBe('wave'));
    expect(seen.map((params) => params.get('q')).filter((q) => q !== null)).toEqual(['wave']);
    await user.click(await screen.findByRole('option', { name: /Techwave Innovations Ltd/ }));

    expect(opened()).toHaveTextContent(`/acme/clients/${techwave.id}/overview`);
  });

  it('opens a client from the keyboard', async () => {
    const user = userEvent.setup();
    renderLanding();

    search().focus();
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('option', { name: /Mutual Technologies/ });
    await user.keyboard('{ArrowDown}{Enter}');
    expect(opened()).toHaveTextContent(`/acme/clients/${mutual.id}/overview`);
  });

  it('finds archived clients as well', async () => {
    const seen: URLSearchParams[] = [];
    const user = userEvent.setup();
    renderLanding({ onList: (params) => seen.push(params) });

    await user.click(search());
    await screen.findByRole('option', { name: /Techwave Innovations Ltd/ });
    expect(seen.at(-1)?.getAll('status')).toEqual(['prospect', 'active', 'inactive', 'archived']);
  });

  it('says when nothing matches', async () => {
    const user = userEvent.setup();
    renderLanding();
    await user.type(search(), 'zzz');
    expect(await screen.findByText('No clients found.')).toBeInTheDocument();
  });
});

describe('Recently viewed', () => {
  it('invites the first visit', () => {
    renderLanding();
    expect(recent().getByText('No recently viewed clients')).toBeInTheDocument();
    expect(recent().queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('lists the clients opened last, newest first, each linking to its overview', () => {
    remember(1);
    remember(2);
    renderLanding();

    const links = recent().getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining('Recent client 2'),
      expect.stringContaining('Recent client 1'),
    ]);
    expect(links[0]).toHaveAttribute(
      'href',
      '/acme/clients/0198c1f2-0000-7000-8000-000000000002/overview',
    );
    expect(links[0]).toHaveTextContent('R2');
  });

  it(`shows at most ${String(RECENT_CLIENTS_LIMIT)}`, () => {
    for (let n = 1; n <= RECENT_CLIENTS_LIMIT + 2; n += 1) remember(n);
    renderLanding();

    const links = recent().getAllByRole('link');
    expect(links).toHaveLength(8);
    expect(links[0]).toHaveTextContent('Recent client 10');
    // The two opened first have dropped out.
    expect(recent().queryByText('Recent client 1')).toBeNull();
    expect(recent().queryByText('Recent client 2')).toBeNull();
    expect(recent().getByText('Recent client 3')).toBeInTheDocument();
  });

  it('keeps the list of each practice apart', () => {
    remember(1);
    remember(2, '0198c1f2-0000-7000-8000-0000000000a2');
    renderLanding();

    expect(recent().getAllByRole('link')).toHaveLength(1);
    expect(recent().getByText('Recent client 1')).toBeInTheDocument();
    expect(recent().queryByText('Recent client 2')).toBeNull();
  });

  it('opens a client from the list', async () => {
    remember(1);
    const user = userEvent.setup();
    renderLanding();

    await user.click(recent().getByRole('link', { name: /Recent client 1/ }));
    expect(opened()).toHaveTextContent(
      '/acme/clients/0198c1f2-0000-7000-8000-000000000001/overview',
    );
  });

  it('can be cleared', async () => {
    remember(1);
    remember(2);
    const user = userEvent.setup();
    renderLanding();

    await user.click(recent().getByRole('button', { name: 'Clear' }));
    expect(recent().getByText('No recently viewed clients')).toBeInTheDocument();
    expect(useRecentClientsStore.getState().byOrganization[ORG_ID]).toEqual([]);
  });

  it('is remembered in this browser', () => {
    remember(1);
    expect(window.localStorage.getItem('capium-clients-recent')).toContain('Recent client 1');
  });
});

describe('Find a client in Capium central', () => {
  it('opens the central clients dialog', async () => {
    const user = userEvent.setup();
    renderLanding();

    await user.click(screen.getByRole('button', { name: 'Find a client in Capium central' }));
    const dialog = await screen.findByRole('dialog', { name: 'Central clients' });
    expect(await within(dialog).findByText('Northwind Traders Ltd')).toBeInTheDocument();
  });

  it('is left out for a role that may not create clients', () => {
    renderLanding({ permissions: STAFF_PERMISSIONS });
    expect(screen.queryByRole('button', { name: 'Find a client in Capium central' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Find a client' })).toBeInTheDocument();
  });
});
