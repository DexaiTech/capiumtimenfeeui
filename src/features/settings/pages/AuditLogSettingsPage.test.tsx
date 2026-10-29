import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { ok, server } from '@/test/server';

import { auditEntry, grace, orgContext } from '../test/fixtures';
import { orgPath, settingsHandlers } from '../test/handlers';
import { mockDesktopViewport, renderSettings } from '../test/render';
import type { AuditLogEntry } from '../types';
import { dayEndIso, dayStartIso } from '../utils/audit';
import AuditLogSettingsPage from './AuditLogSettingsPage';

const entries: AuditLogEntry[] = [
  auditEntry(),
  auditEntry({
    id: 'audit-2',
    action: 'invoice.issued',
    metadata: { number: 'INV-00012', client_name: 'Babbage Ltd', gross_total: 120000 },
  }),
  auditEntry({
    id: 'audit-3',
    action: 'member.password_reset',
    actor: null,
    ip_address: null,
    metadata: null,
  }),
  auditEntry({
    id: 'audit-4',
    action: 'project.archived',
    metadata: { note: '<img src=x onerror=alert(1)>', project: { key: 'APO' } },
  }),
];

/** Captures the query string of every audit-log request. */
function captureRequests(pages: Record<string, { rows: AuditLogEntry[]; next: string | null }>) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(orgPath('/audit-logs'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const page = pages[params.get('cursor') ?? 'first'] ?? { rows: [], next: null };
      return ok(page.rows, { meta: { next_cursor: page.next, has_more: page.next !== null } });
    }),
  );
  return requests;
}

describe('AuditLogSettingsPage', () => {
  beforeEach(() => {
    mockDesktopViewport();
    server.use(...settingsHandlers({ auditLogs: entries }));
  });

  it('describes known actions as sentences and falls back to the raw action', async () => {
    renderSettings(<AuditLogSettingsPage />);

    const changed = await screen.findByRole('row', {
      name: /Changed Grace Hopper’s role from Staff to Admin/,
    });
    expect(within(changed).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(changed).getByText('ada@example.com')).toBeInTheDocument();
    expect(within(changed).getByText('203.0.113.7')).toBeInTheDocument();
    // Relative inline, absolute on hover and in the machine-readable attribute.
    // The exact date and time first, the relative time under it.
    const [exact, relative] = within(changed).getAllByRole('time');
    expect(exact).toHaveAttribute('datetime', '2026-10-05T09:14:07Z');
    expect(exact).toHaveTextContent(/2026/);
    expect(relative?.getAttribute('title')).toMatch(/2026/);

    // Financial records: a generic sentence naming the record by its number.
    expect(screen.getByRole('row', { name: /Invoice issued: INV-00012/ })).toBeInTheDocument();
    // No actor: the system did it. Missing metadata degrades to a generic sentence.
    const system = screen.getByRole('row', { name: /Reset the password of a member/ });
    expect(within(system).getByText('System')).toBeInTheDocument();
    // An action this version does not know is shown as is.
    expect(screen.getByRole('row', { name: /project\.archived/ })).toBeInTheDocument();
  });

  it('expands a row to show metadata as plain text', async () => {
    const user = userEvent.setup();
    renderSettings(<AuditLogSettingsPage />);

    const toggle = await screen.findByRole('button', { name: 'Details: project.archived' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Markup in metadata is text, never an element.
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByText('{"key":"APO"}')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByText('Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0')).toBeInTheDocument();
  });

  it('sends the action group, date range and actor as query parameters', async () => {
    const requests = captureRequests({ first: { rows: entries, next: null } });
    const last = () => requests[requests.length - 1] as URLSearchParams;
    const user = userEvent.setup();
    renderSettings(<AuditLogSettingsPage />);
    await screen.findByRole('row', { name: /Changed Grace Hopper/ });
    expect(last().get('action')).toBeNull();
    expect(last().get('limit')).toBe('25');

    await user.selectOptions(screen.getByLabelText('Activity'), 'Staff');
    await waitFor(() => expect(last().get('action')).toBe('member.'));

    // Application Testing's records have groups of their own.
    await user.selectOptions(screen.getByLabelText('Activity'), 'Tickets');
    await waitFor(() => expect(last().get('action')).toBe('ticket.'));
    await user.selectOptions(screen.getByLabelText('Activity'), 'Ticket comments');
    await waitFor(() => expect(last().get('action')).toBe('ticket_comment.'));
    await user.selectOptions(screen.getByLabelText('Activity'), 'Ticket files');
    await waitFor(() => expect(last().get('action')).toBe('ticket_attachment.'));
    await user.selectOptions(screen.getByLabelText('Activity'), 'Ticket tags');
    await waitFor(() => expect(last().get('action')).toBe('ticket_tag.'));

    await user.selectOptions(screen.getByLabelText('Activity'), 'Invoices');
    await waitFor(() => expect(last().get('action')).toBe('invoice.'));

    await user.type(screen.getByLabelText('From'), '2026-10-01');
    await waitFor(() => expect(last().get('from')).toBe(dayStartIso('2026-10-01')));
    // The end shows today until a date is picked, so it is replaced rather than typed into.
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-05' } });
    await waitFor(() => expect(last().get('to')).toBe(dayEndIso('2026-10-05')));

    // The actor is picked from the members, searched by name.
    await user.type(screen.getByRole('combobox', { name: 'Actor' }), 'grace');
    await user.click(await screen.findByRole('option', { name: /Grace Hopper/ }));
    await waitFor(() => expect(last().get('actor_user_id')).toBe(grace.user_id));
    expect(screen.getByRole('combobox', { name: 'Actor' })).toHaveValue('Grace Hopper');
    expect(last().get('action')).toBe('invoice.');

    await user.click(screen.getByRole('button', { name: 'Clear actor' }));
    await waitFor(() => expect(last().get('actor_user_id')).toBeNull());
  });

  it('offers to clear the filters when nothing matches', async () => {
    const requests = captureRequests({ first: { rows: [], next: null } });
    const user = userEvent.setup();
    renderSettings(<AuditLogSettingsPage />, { route: '/?group=roles' });

    expect(await screen.findByText('No activity matches')).toBeInTheDocument();
    expect(requests[0]?.get('action')).toBe('role.');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('No activity yet')).toBeInTheDocument();
  });

  it('loads older events with the cursor of the previous page', async () => {
    const requests = captureRequests({
      first: { rows: entries.slice(0, 2), next: 'cursor-2' },
      'cursor-2': { rows: entries.slice(2), next: null },
    });
    const user = userEvent.setup();
    renderSettings(<AuditLogSettingsPage />);

    await screen.findByRole('row', { name: /Changed Grace Hopper/ });
    expect(screen.getByText('Showing 2 events')).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /project\.archived/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load older events' }));

    expect(await screen.findByRole('row', { name: /project\.archived/ })).toBeInTheDocument();
    expect(requests.map((params) => params.get('cursor'))).toEqual([null, 'cursor-2']);
    expect(screen.getByText('Showing 4 events · Start of the log')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load older events' })).not.toBeInTheDocument();
  });

  it('needs audit_log.read', () => {
    renderSettings(<AuditLogSettingsPage />, {
      context: orgContext({ permissions: ['member.read'] }),
    });
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
  });
});
