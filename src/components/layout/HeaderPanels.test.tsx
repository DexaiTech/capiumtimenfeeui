import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { buildShellData } from '@/app/router/shellData';
import { testUser } from '@/test/fixtures';
import { memberContext, ownerContext } from '@/test/orgFixtures';
import { renderWithProviders } from '@/test/render';

import { AppShell } from './AppShell';
import type { ShellNotification, ShellNotifications } from './shellContext';

function CurrentLocation() {
  const { pathname } = useLocation();
  return <p data-testid="location">{pathname}</p>;
}

const NOW = Date.now();
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const approval: ShellNotification = {
  id: 'n-1',
  type: 'approval_pending',
  title: 'Timesheet waiting for approval',
  body: 'Pat Person submitted their timesheet for the week starting 07/09/2026.',
  to: '/acme/time/approvals',
  read: false,
  createdAt: ago(5),
};
const returned: ShellNotification = {
  id: 'n-2',
  type: 'timesheet_returned',
  title: 'Timesheet returned',
  body: 'Your timesheet for the week starting 31/08/2026 was returned.',
  to: null,
  read: true,
  createdAt: ago(60 * 26),
};

function bell(overrides: Partial<ShellNotifications> = {}): ShellNotifications {
  return {
    unreadCount: 1,
    items: [approval, returned],
    status: 'ready',
    hasMore: false,
    loadingMore: false,
    markingAllRead: false,
    onOpenChange: vi.fn(),
    onSelect: vi.fn(),
    onMarkAllRead: vi.fn(),
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    settingsTo: '/acme/settings/notifications',
    ...overrides,
  };
}

function renderBell(notifications: ShellNotifications | null) {
  const shell = buildShellData({
    context: ownerContext,
    organizations: [ownerContext, memberContext],
    roleName: (role) => role.name,
    canSwitchPractice: false,
    canCreatePractice: false,
    notifications,
  });
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell user={testUser} onLogout={vi.fn()} shell={shell} />}>
        <Route path="*" element={<CurrentLocation />} />
      </Route>
    </Routes>,
    { route: '/acme/dashboard/overview' },
  );
}

const location = () => screen.getByTestId('location').textContent;
const bellButton = (name: string | RegExp = /^Notifications/) =>
  screen.getByRole('button', { name });
const panel = () => screen.getByRole('dialog', { name: 'Notifications' });

describe('the bell', () => {
  it('says there is nothing when the shell has no notification data', async () => {
    const user = userEvent.setup();
    renderBell(null);
    await user.click(bellButton('Notifications'));
    expect(within(panel()).getByText("You're all caught up")).toBeInTheDocument();
  });

  it('shows the unread count on a badge and in the accessible name', () => {
    renderBell(bell({ unreadCount: 3 }));
    const button = bellButton('Notifications, 3 unread');
    expect(within(button).getByText('3')).toBeInTheDocument();
  });

  it('caps the badge at 99+', () => {
    renderBell(bell({ unreadCount: 250 }));
    const button = bellButton('Notifications, 99+ unread');
    expect(within(button).getByText('99+')).toBeInTheDocument();
  });

  it('shows no badge when nothing is unread', () => {
    renderBell(bell({ unreadCount: 0 }));
    const button = bellButton('Notifications');
    expect(button.textContent).toBe('');
  });

  it('lists the notifications with an icon, text and age, and marks the unread ones', async () => {
    const user = userEvent.setup();
    const data = bell();
    renderBell(data);
    await user.click(bellButton());

    expect(data.onOpenChange).toHaveBeenCalledWith(true);
    const unread = within(panel()).getByRole('button', {
      name: /Timesheet waiting for approval/,
    });
    expect(unread).toHaveTextContent('Unread: Timesheet waiting for approval');
    expect(unread).toHaveTextContent('Pat Person submitted their timesheet');
    expect(unread).toHaveTextContent('5 minutes ago');
    expect(within(unread).getByTestId('unread-dot')).toBeInTheDocument();

    const read = within(panel()).getByRole('button', { name: /Timesheet returned/ });
    expect(read).toHaveTextContent('yesterday');
    expect(within(read).queryByTestId('unread-dot')).not.toBeInTheDocument();
    expect(read).not.toHaveTextContent('Unread');
  });

  it('marks a notification read and opens its page when it is chosen', async () => {
    const user = userEvent.setup();
    const data = bell();
    renderBell(data);
    await user.click(bellButton());
    await user.click(within(panel()).getByRole('button', { name: /Timesheet waiting/ }));

    expect(data.onSelect).toHaveBeenCalledWith(approval);
    expect(location()).toBe('/acme/time/approvals');
    expect(data.onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument(),
    );
  });

  it('stays where it is for a notification that leads nowhere', async () => {
    const user = userEvent.setup();
    const data = bell();
    renderBell(data);
    await user.click(bellButton());
    await user.click(within(panel()).getByRole('button', { name: /Timesheet returned/ }));

    expect(data.onSelect).toHaveBeenCalledWith(returned);
    expect(location()).toBe('/acme/dashboard/overview');
  });

  it('marks everything read, and offers it only while something is unread', async () => {
    const user = userEvent.setup();
    const data = bell({ unreadCount: 4 });
    const { unmount } = renderBell(data);
    await user.click(bellButton());
    await user.click(within(panel()).getByRole('button', { name: 'Mark all as read' }));
    expect(data.onMarkAllRead).toHaveBeenCalledTimes(1);
    unmount();

    renderBell(bell({ unreadCount: 0 }));
    await user.click(bellButton());
    expect(within(panel()).getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  });

  it('loads the next page on request', async () => {
    const user = userEvent.setup();
    const data = bell({ hasMore: true });
    renderBell(data);
    await user.click(bellButton());
    await user.click(within(panel()).getByRole('button', { name: 'Load more' }));
    expect(data.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('shows a skeleton while the first page loads', async () => {
    const user = userEvent.setup();
    renderBell(bell({ status: 'loading', items: [] }));
    await user.click(bellButton());
    expect(
      within(panel()).getByRole('status', { name: 'Loading notifications' }),
    ).toBeInTheDocument();
    expect(within(panel()).queryByRole('list')).not.toBeInTheDocument();
  });

  it('says so when the list could not be loaded, and tries again', async () => {
    const user = userEvent.setup();
    const data = bell({ status: 'error', items: [] });
    renderBell(data);
    await user.click(bellButton());
    expect(within(panel()).getByRole('alert')).toHaveTextContent(
      'Could not load your notifications',
    );
    await user.click(within(panel()).getByRole('button', { name: 'Try again' }));
    expect(data.onRetry).toHaveBeenCalledTimes(1);
  });

  it('says there is nothing when the list is empty', async () => {
    const user = userEvent.setup();
    renderBell(bell({ items: [], unreadCount: 0 }));
    await user.click(bellButton());
    expect(within(panel()).getByText("You're all caught up")).toBeInTheDocument();
  });

  it('leads to the notification settings', async () => {
    const user = userEvent.setup();
    renderBell(bell());
    await user.click(bellButton());
    await user.click(within(panel()).getByRole('link', { name: 'Notification settings' }));
    expect(location()).toBe('/acme/settings/notifications');
  });
});
