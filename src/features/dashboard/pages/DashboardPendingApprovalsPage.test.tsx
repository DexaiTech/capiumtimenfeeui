import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { ownerContext } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import type { ApprovalItem, PendingApprovals } from '../types';
import DashboardPendingApprovalsPage from './DashboardPendingApprovalsPage';

const sheet = (id: string, title: string, unpriced: number): ApprovalItem => ({
  kind: 'timesheet',
  id,
  title,
  subject: null,
  date: '2026-10-12',
  submitted_at: '2026-10-16T16:00:00Z',
  minutes: 450,
  zero_rate_minutes: unpriced,
  amount: null,
  link: '/time/approvals',
});

function setup() {
  const approved: string[] = [];
  const data: PendingApprovals = {
    visible: true,
    as_at: '2026-10-17',
    generated_at: '2026-10-17T09:00:00Z',
    total: 2,
    kinds: [{ kind: 'timesheet', count: 2, oldest_date: '2026-10-12', link: '/time/approvals' }],
    items: [sheet('ts-data', 'Data Seeder', 90), sheet('ts-sam', 'Sam Staff', 0)],
  };
  server.use(
    http.get(orgApiPath('/dashboard/pending-approvals'), () => ok(data)),
    http.post(orgApiPath('/timesheets/:id/approve'), ({ params }) => {
      approved.push(String(params.id));
      return ok({ id: params.id, status: 'approved' });
    }),
  );
  renderInOrg(<DashboardPendingApprovalsPage />, { route: '/acme/dashboard/pending-approvals' });
  return approved;
}

describe('DashboardPendingApprovalsPage: time with no charge-out rate (APT17)', () => {
  it('flags the timesheet and asks before approving it', async () => {
    const user = userEvent.setup();
    const approved = setup();
    expect(await screen.findAllByText('No rate')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Approve timesheet of Data Seeder' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve this timesheet?' });
    expect(
      within(dialog).getByText(
        (_, element) =>
          element?.tagName === 'LI' &&
          (element.textContent ?? '').startsWith(
            "1h 30m of Data Seeder's time has no charge-out rate, so it will go to WIP at £0.",
          ),
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(approved).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Approve timesheet of Data Seeder' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve anyway' }),
    );
    await waitFor(() => expect(approved).toEqual(['ts-data']));
  });

  it('approves a fully priced timesheet with one click', async () => {
    const user = userEvent.setup();
    const approved = setup();
    await user.click(await screen.findByRole('button', { name: 'Approve timesheet of Sam Staff' }));
    await waitFor(() => expect(approved).toEqual(['ts-sam']));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('DashboardPendingApprovalsPage: overtime (APT81)', () => {
  const withOvertime = {
    ...ownerContext,
    organization: { ...ownerContext.organization, overtime_enabled: true },
  };
  const pending = (id: string) => ({ id, status: 'pending', entry_date: '2026-10-13' });

  function render(context = withOvertime) {
    const asked: string[] = [];
    server.use(
      http.get(orgApiPath('/dashboard/pending-approvals'), () =>
        ok({
          visible: true,
          as_at: '2026-10-17',
          generated_at: '2026-10-17T09:00:00Z',
          total: 1,
          kinds: [
            { kind: 'timesheet', count: 1, oldest_date: '2026-10-12', link: '/time/approvals' },
          ],
          items: [sheet('ts-sam', 'Sam Staff', 0)],
        }),
      ),
      http.get(orgApiPath('/overtime'), ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('status') ?? '');
        return ok([pending('ot-1'), pending('ot-2')], {
          meta: { next_cursor: null, has_more: false },
        });
      }),
    );
    renderInOrg(<DashboardPendingApprovalsPage />, {
      route: '/acme/dashboard/pending-approvals',
      context,
    });
    return asked;
  }

  it('says how much overtime waits for a decision, and where to decide it', async () => {
    const asked = render();
    expect(
      await screen.findByText('2 overtime entries are waiting for a decision'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review overtime' })).toHaveAttribute(
      'href',
      '/acme/time/approvals',
    );
    expect(asked).toEqual(['pending']);
  });

  it('says nothing and asks nothing while the practice has overtime off', async () => {
    const asked = render(ownerContext);
    expect(await screen.findByText('Sam Staff')).toBeInTheDocument();
    expect(screen.queryByText(/waiting for a decision/)).not.toBeInTheDocument();
    expect(asked).toEqual([]);
  });
});
