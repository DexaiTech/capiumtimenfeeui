import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { notification } from '@/features/notifications/test/fixtures';
import { createBackend, notificationHandlers } from '@/features/notifications/test/handlers';
import { mockOrganizations, ownerContext } from '@/test/orgFixtures';
import { renderApp, resetAppStores } from '@/test/renderApp';
import { server } from '@/test/server';

// The pages are built and tested in their features; here only the bell in the shell matters.
vi.mock('@/features/clients/pages/ClientsPage', () => ({ default: () => <h1>Clients</h1> }));
vi.mock('@/features/dashboard/pages/DashboardOverviewPage', () => ({
  default: () => <h1>Dashboard</h1>,
}));

beforeEach(resetAppStores);

const bell = (name: string | RegExp) => screen.findByRole('button', { name });

describe('the bell in the shell', () => {
  it('shows the unread count of the practice, opens a notification and counts it read', async () => {
    const user = userEvent.setup();
    const toClients = notification({ title: 'Open the clients', link: '/clients' });
    const nowhere = notification({ title: 'Nothing to open', type: 'failed_job', link: null });
    const backend = createBackend({ notifications: [toClients, nowhere] });
    server.use(...notificationHandlers(backend));
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/acme/dashboard/overview');

    await user.click(await bell('Notifications, 2 unread'));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(await within(panel).findByText('Open the clients')).toBeInTheDocument();
    expect(within(panel).getByText('Nothing to open')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: /Open the clients/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/clients'));
    expect(backend.calls.read).toEqual([toClients.id]);
    expect(await bell('Notifications, 1 unread')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Clients' })).toBeInTheDocument();
  });

  it('marks everything read from the panel', async () => {
    const user = userEvent.setup();
    const backend = createBackend({ notifications: [notification(), notification()] });
    server.use(...notificationHandlers(backend));
    mockOrganizations([ownerContext]);
    renderApp('/acme/dashboard/overview');

    await user.click(await bell('Notifications, 2 unread'));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await user.click(await within(panel).findByRole('button', { name: 'Mark all as read' }));

    await waitFor(() => expect(backend.calls.readAll).toBe(1));
    expect(await bell('Notifications')).toBeInTheDocument();
  });

  it('asks for the count of the practice only, once', async () => {
    const backend = createBackend({ notifications: [notification()] });
    server.use(...notificationHandlers(backend));
    mockOrganizations([ownerContext]);
    renderApp('/acme/dashboard/overview');

    await bell('Notifications, 1 unread');
    expect(backend.calls.unreadCounts).toBe(1);
    // The list is read only when the panel is opened.
    expect(backend.calls.lists).toHaveLength(0);
  });
});
