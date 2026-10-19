import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import { techwave } from './fixtures';
import { heading, renderWorkspace, where } from './renderWorkspace';
import { staffOverview } from './workspaceFixtures';

const OVERVIEW = `/acme/clients/${techwave.id}/overview`;
const HISTORY = `/acme/clients/${techwave.id}/history`;

const entry = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  action: 'client.updated',
  label: 'Client details updated',
  actor: { id: 'user-ada', name: 'Ada Lovelace' },
  at: '2026-10-05T09:14:07Z',
  ip_address: '203.0.113.7',
  target_type: 'client',
  target_id: techwave.id,
  changes: [{ field: 'segment', before: null, after: 'Technology' }],
  summary: 'Client details updated: APX006 · Techwave Innovations Ltd',
  ...overrides,
});

describe('the History tab of the client workspace', () => {
  it('shows what happened to the client and to what names it, newest first', async () => {
    const requests: URLSearchParams[] = [];
    const user = userEvent.setup();
    renderWorkspace(OVERVIEW, {
      handlers: [
        http.get(orgApiPath('/audit-logs/history'), ({ request }) => {
          requests.push(new URL(request.url).searchParams);
          return ok(
            [
              entry('e2', {
                action: 'invoice.issued',
                label: 'Invoice issued',
                target_type: 'invoice',
                changes: [],
                summary: 'Invoice issued: INV-00012 (Techwave Innovations Ltd)',
              }),
              entry('e1'),
            ],
            { meta: { next_cursor: null, has_more: false } },
          );
        }),
      ],
    });
    await heading('Techwave Innovations Ltd');

    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(where()).toHaveTextContent(HISTORY);
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');

    const panel = await screen.findByRole('tabpanel', { name: 'History' });
    expect(await within(panel).findByRole('heading', { name: 'Client history' })).toBeVisible();
    const items = within(panel).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText('Invoice issued')).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByText(/INV-00012/)).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText('Client details updated')).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByRole('table')).toBeInTheDocument();

    // The client, and what names it.
    expect(requests[0]?.get('target_type')).toBe('client');
    expect(requests[0]?.get('target_id')).toBe(techwave.id);
    expect(requests[0]?.get('include_related')).toBe('true');
  });

  it('opens straight from its URL', async () => {
    renderWorkspace(HISTORY, {
      handlers: [
        http.get(orgApiPath('/audit-logs/history'), () =>
          ok([entry('e1')], { meta: { next_cursor: null, has_more: false } }),
        ),
      ],
    });
    expect(await screen.findByRole('heading', { name: 'Client history' })).toBeVisible();
    expect(where()).toHaveTextContent(HISTORY);
  });

  it('says so when the client has no history', async () => {
    renderWorkspace(HISTORY, {
      handlers: [
        http.get(orgApiPath('/audit-logs/history'), () =>
          ok([], { meta: { next_cursor: null, has_more: false } }),
        ),
      ],
    });
    expect(await screen.findByText('No history yet')).toBeInTheDocument();
  });

  it('shows the refusal of the API', async () => {
    renderWorkspace(HISTORY, {
      handlers: [
        http.get(orgApiPath('/audit-logs/history'), () =>
          fail(403, 'PERMISSION_DENIED', 'You do not have permission to do that.'),
        ),
      ],
    });
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('You do not have permission to do that.')).toBeInTheDocument();
  });

  it('is not offered without audit_log.read, and its URL opens the overview', async () => {
    renderWorkspace(HISTORY, { permissions: STAFF_PERMISSIONS, overview: staffOverview });
    await heading('Techwave Innovations Ltd');
    expect(where()).toHaveTextContent(OVERVIEW);
    expect(screen.queryByRole('tab', { name: 'History' })).toBeNull();
  });
});
