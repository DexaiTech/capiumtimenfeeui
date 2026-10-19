import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ShellNotification, ShellNotifications } from '@/components/layout';
import { ownerContext } from '@/test/orgFixtures';
import { fail, ok, server } from '@/test/server';

import { UNREAD_POLL_MS } from '../constants';
import { notification } from '../test/fixtures';
import { createBackend, notificationHandlers, orgApiPath } from '../test/handlers';
import { toShellNotification, useNotificationsShell } from './useNotificationsShell';

const ORGANIZATION_ID = ownerContext.organization.id;

function itemAt(bell: ShellNotifications | null, index: number): ShellNotification {
  const item = bell?.items[index];
  if (!item) throw new Error(`No notification at ${String(index)}`);
  return item;
}

function setup(organizationId: string | null = ORGANIZATION_ID, slug: string | null = 'acme') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useNotificationsShell({ organizationId, slug }), { wrapper });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useNotificationsShell', () => {
  it('asks for nothing outside a practice', async () => {
    const backend = createBackend({ notifications: [notification()] });
    server.use(...notificationHandlers(backend));
    const { result } = setup(null, null);
    // Give a wrongly started request time to arrive.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBeNull();
    expect(backend.calls.unreadCounts).toBe(0);
  });

  it('polls the unread count every minute and again when the window is focused', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const backend = createBackend({ notifications: [notification(), notification()] });
    server.use(...notificationHandlers(backend));
    const { result } = setup();

    await vi.waitFor(() => expect(result.current?.unreadCount).toBe(2));
    expect(backend.calls.unreadCounts).toBe(1);
    expect(UNREAD_POLL_MS).toBe(60_000);

    // The panel is open, so the list is on screen too and must follow the count.
    act(() => result.current?.onOpenChange(true));
    await vi.waitFor(() => expect(result.current?.items).toHaveLength(2));

    backend.notifications.unshift(notification(), notification(), notification());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNREAD_POLL_MS);
    });
    await vi.waitFor(() => expect(result.current?.unreadCount).toBe(5));
    expect(backend.calls.unreadCounts).toBe(2);
    await vi.waitFor(() => expect(result.current?.items).toHaveLength(5));

    backend.notifications.unshift(notification());
    act(() => {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });
    await vi.waitFor(() => expect(result.current?.unreadCount).toBe(6));
    expect(backend.calls.unreadCounts).toBe(3);
  });

  it('reads the list only while the panel is open, newest first, page by page', async () => {
    const backend = createBackend({
      pageSize: 2,
      notifications: [
        notification({ title: 'Third' }),
        notification({ title: 'Second' }),
        notification({ title: 'First', is_read: true }),
      ],
    });
    server.use(...notificationHandlers(backend));
    const { result } = setup();

    await waitFor(() => expect(result.current?.unreadCount).toBe(2));
    expect(backend.calls.lists).toHaveLength(0);

    act(() => result.current?.onOpenChange(true));
    await waitFor(() => expect(result.current?.status).toBe('ready'));
    expect(result.current?.items.map((item) => item.title)).toEqual(['Third', 'Second']);
    expect(result.current?.hasMore).toBe(true);
    expect(backend.calls.lists[0]?.get('limit')).toBe('20');
    expect(backend.calls.lists[0]?.has('cursor')).toBe(false);

    act(() => result.current?.onLoadMore());
    await waitFor(() => expect(result.current?.items).toHaveLength(3));
    expect(backend.calls.lists[1]?.get('cursor')).toBe('2');
    expect(result.current?.hasMore).toBe(false);
    expect(result.current?.items[2]).toMatchObject({ title: 'First', read: true });
  });

  it('marks one notification read once, and refreshes the count and the list', async () => {
    const unread = notification({ title: 'Unread' });
    const read = notification({ title: 'Read', is_read: true });
    const backend = createBackend({ notifications: [unread, read] });
    server.use(...notificationHandlers(backend));
    const { result } = setup();
    await waitFor(() => expect(result.current?.unreadCount).toBe(1));
    act(() => result.current?.onOpenChange(true));
    await waitFor(() => expect(result.current?.items).toHaveLength(2));

    act(() => result.current?.onSelect(itemAt(result.current, 1)));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(backend.calls.read).toEqual([]);

    act(() => result.current?.onSelect(itemAt(result.current, 0)));
    await waitFor(() => expect(backend.calls.read).toEqual([unread.id]));
    await waitFor(() => expect(result.current?.unreadCount).toBe(0));
    await waitFor(() => expect(result.current?.items[0]?.read).toBe(true));
  });

  it('marks everything read', async () => {
    const backend = createBackend({ notifications: [notification(), notification()] });
    server.use(...notificationHandlers(backend));
    const { result } = setup();
    await waitFor(() => expect(result.current?.unreadCount).toBe(2));

    act(() => result.current?.onMarkAllRead());
    await waitFor(() => expect(backend.calls.readAll).toBe(1));
    await waitFor(() => expect(result.current?.unreadCount).toBe(0));
  });

  it('reports a list that failed to load and loads it on retry', async () => {
    const backend = createBackend({ notifications: [notification()] });
    let failing = true;
    server.use(
      http.get(orgApiPath('/notifications'), () =>
        failing ? fail(500, 'INTERNAL_ERROR', 'Something broke.') : ok([notification()]),
      ),
      ...notificationHandlers(backend),
    );
    const { result } = setup();
    await waitFor(() => expect(result.current?.unreadCount).toBe(1));

    act(() => result.current?.onOpenChange(true));
    await waitFor(() => expect(result.current?.status).toBe('error'));

    failing = false;
    act(() => result.current?.onRetry());
    await waitFor(() => expect(result.current?.status).toBe('ready'));
    expect(result.current?.items).toHaveLength(1);
  });

  it('keeps the last count when a poll fails', async () => {
    const backend = createBackend({ notifications: [notification(), notification()] });
    let failing = false;
    server.use(
      http.get(orgApiPath('/notifications/unread-count'), () =>
        failing ? fail(500, 'INTERNAL_ERROR', 'Something broke.') : ok({ count: 2 }),
      ),
      ...notificationHandlers(backend),
    );
    const { result } = setup();
    await waitFor(() => expect(result.current?.unreadCount).toBe(2));

    failing = true;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current?.unreadCount).toBe(2);
  });
});

describe('toShellNotification', () => {
  it('opens a link inside the practice', () => {
    expect(toShellNotification(notification({ link: '/time/approvals' }), 'acme').to).toBe(
      '/acme/time/approvals',
    );
    expect(toShellNotification(notification({ link: '/jobs/j-1?tab=budget' }), 'acme').to).toBe(
      '/acme/jobs/j-1?tab=budget',
    );
  });

  it.each([null, 'https://evil.example/x', '//evil.example', '/\\evil.example', 'time'])(
    'leads nowhere for the link %j',
    (link) => {
      expect(toShellNotification(notification({ link }), 'acme').to).toBeNull();
    },
  );

  it('carries the text, the type, the age and whether it was read', () => {
    const item = notification({ type: 'budget_alert', is_read: true });
    expect(toShellNotification(item, 'acme')).toMatchObject({
      id: item.id,
      type: 'budget_alert',
      title: item.title,
      body: item.body,
      read: true,
      createdAt: item.created_at,
    });
  });
});
