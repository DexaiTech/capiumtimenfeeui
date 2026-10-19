import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  contextWith,
  mockOrganizations,
  ownerContext,
  STAFF_PERMISSIONS,
} from '@/test/orgFixtures';
import { renderApp, resetAppStores } from '@/test/renderApp';

// The pages are built and tested in their feature; here only the layout, the routes and the
// guard of Application Testing matter.
vi.mock('@/features/tickets/pages/TicketsDashboardPage', () => ({
  default: () => <h1>Tracker dashboard</h1>,
}));
vi.mock('@/features/tickets/pages/TicketsListPage', () => ({
  default: () => <h1>Tracker tickets</h1>,
}));
vi.mock('@/features/tickets/pages/TicketDetailPage', () => ({
  default: () => <h1>Tracker ticket</h1>,
}));
vi.mock('@/features/clients/pages/ClientsPage', () => ({ default: () => <h1>Clients</h1> }));

beforeEach(resetAppStores);

const mainNav = () => {
  const nav = screen.getAllByRole('navigation', { name: 'Main' })[0];
  if (!nav) throw new Error('no main navigation');
  return nav;
};

const sidebar = () => screen.getByRole('navigation', { name: 'Application Testing pages' });

const sidebarLinks = () =>
  within(sidebar())
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);

describe('Application Testing routes', () => {
  it('leads the index to the dashboard', async () => {
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/acme/application-testing');

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/acme/application-testing/dashboard'),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tracker dashboard' }),
    ).toBeInTheDocument();
  });

  it('shows its own sidebar with the two pages and marks the current one', async () => {
    mockOrganizations([ownerContext]);
    renderApp('/acme/application-testing/dashboard');
    await screen.findByRole('heading', { level: 1, name: 'Tracker dashboard' });

    expect(sidebarLinks()).toEqual([
      ['Dashboard', '/acme/application-testing/dashboard'],
      ['All Tickets', '/acme/application-testing/tickets'],
    ]);
    expect(within(sidebar()).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar()).getByRole('link', { name: 'All Tickets' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('moves between its pages with the sidebar', async () => {
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/acme/application-testing/dashboard');
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Tracker dashboard' });

    await user.click(within(sidebar()).getByRole('link', { name: 'All Tickets' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/acme/application-testing/tickets'),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tracker tickets' }),
    ).toBeInTheDocument();
    expect(within(sidebar()).getByRole('link', { name: 'All Tickets' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps All Tickets current on the page of a ticket', async () => {
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/acme/application-testing/tickets/c9f1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tracker ticket' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/acme/application-testing/tickets/c9f1');
    expect(within(sidebar()).getByRole('link', { name: 'All Tickets' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('is not one of the modules: none is highlighted and there is no secondary bar', async () => {
    mockOrganizations([ownerContext]);
    renderApp('/acme/application-testing/tickets');
    await screen.findByRole('heading', { level: 1, name: 'Tracker tickets' });

    expect(
      within(mainNav())
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page'),
    ).toEqual([]);
    // The main navigation and the sidebar of the tracker, and no bar of a module.
    const names = screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'));
    expect([...new Set(names)].sort()).toEqual(['Application Testing pages', 'Main']);
  });

  it('is reached from the bug button of the top bar', async () => {
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/acme/clients');
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Clients' });

    await user.click(screen.getByRole('button', { name: 'Application Testing' }));
    await user.click(screen.getByRole('menuitem', { name: 'All Tickets' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/acme/application-testing/tickets'),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tracker tickets' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Application Testing' }));
    await user.click(screen.getByRole('menuitem', { name: 'New ticket' }));
    await waitFor(() => expect(router.state.location.search).toBe('?new=1'));
    expect(router.state.location.pathname).toBe('/acme/application-testing/tickets');
  });

  it('lets Staff in: they may read tickets', async () => {
    mockOrganizations([contextWith(STAFF_PERMISSIONS)]);
    renderApp('/acme/application-testing/tickets');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tracker tickets' }),
    ).toBeInTheDocument();
  });

  it.each([
    '/acme/application-testing',
    '/acme/application-testing/dashboard',
    '/acme/application-testing/tickets',
    '/acme/application-testing/tickets/c9f1',
  ])(
    'tells a role without ticket.read that %s is not included, and offers no bug button',
    async (path) => {
      mockOrganizations([contextWith(['organization.read', 'member.read'])]);
      renderApp(path);

      expect(
        await screen.findByRole('heading', { name: 'Your role does not include this page' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Application Testing' })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'Application Testing pages' }),
      ).not.toBeInTheDocument();
    },
  );

  it('shows an in-shell not-found page for an address below it that does not exist', async () => {
    mockOrganizations([ownerContext]);
    renderApp('/acme/application-testing/nothing');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(within(mainNav()).getByRole('link', { name: 'Clients' })).toBeInTheDocument();
  });
});
