import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { detailOf, futureRule, sam, samChargeRule, samCostRule } from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import StaffDetailPage from './StaffDetailPage';

const STAFF = '/acme/team/staff';

function renderDetail(permissions: string[] = OWNER_PERMISSIONS, staffId = sam.id) {
  return renderInOrg(
    <Routes>
      <Route path={`${STAFF}/:staffId`} element={<StaffDetailPage />} />
      <Route path={STAFF} element={<p>Staff list</p>} />
    </Routes>,
    { context: contextWith(permissions), route: `${STAFF}/${staffId}` },
  );
}

// The activity card reads the audit history of the person (with audit_log.read).
beforeEach(() => {
  server.use(
    http.get(orgApiPath('/audit-logs/history'), () =>
      ok([], { meta: { next_cursor: null, has_more: false } }),
    ),
  );
});

const region = (name: string) => screen.findByRole('region', { name });

describe('StaffDetailPage', () => {
  it('shows the person, their profile, their rates and the way back', async () => {
    server.use(...teamHandlers({ rules: [samChargeRule, samCostRule, futureRule] }));
    renderDetail();

    expect(await screen.findByRole('heading', { level: 1, name: 'Sam Staff' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Staff Members/ })).toHaveAttribute(
      'href',
      STAFF,
    );

    const profile = await region('Profile');
    expect(within(profile).getByText('S002')).toBeInTheDocument();
    expect(within(profile).getByText('Senior')).toBeInTheDocument();
    expect(within(profile).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(profile).getByText('Mon–Thu')).toBeInTheDocument();
    expect(within(profile).getByText('80%')).toBeInTheDocument();

    const rates = await region('Rates');
    // What applies today, and every rule that names them, newest first.
    expect(within(rates).getByText('£120.00/h')).toBeInTheDocument();
    expect(within(rates).getByText('£30.00/h')).toBeInTheDocument();
    const table = await within(rates).findByRole('table', { name: 'Rates that name this person' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('£175.00/h');
    expect(rows[1]).toHaveTextContent('Cost');
    expect(rows[1]).toHaveTextContent('£35.00/h');
    expect(rows[2]).toHaveTextContent('£190.00/h');
    expect(rows[2]).toHaveTextContent('Future');
  });

  it('opens the edit dialog from "Edit details"', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers());
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Edit details' }));
    expect(await screen.findByRole('dialog', { name: 'Edit staff member' })).toBeInTheDocument();
  });

  it('sets a new rate for this person from their page', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.post(orgApiPath('/rates'), async ({ request }) => {
        bodies.push(await request.json());
        return ok(samChargeRule, { status: 201 });
      }),
      ...teamHandlers({ rules: [samChargeRule] }),
    );
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Set charge-out rate' }));
    const dialog = await screen.findByRole('dialog', { name: /new charge-out/i });
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate (£ per hour)' }), '185.50');
    await user.clear(within(dialog).getByLabelText('Starts on'));
    await user.type(within(dialog).getByLabelText('Starts on'), '2026-11-01');
    await user.click(within(dialog).getByRole('button', { name: 'Save rate' }));

    await waitFor(() =>
      expect(bodies).toEqual([
        {
          kind: 'charge',
          user_id: sam.id,
          rate: 18550,
          effective_from: '2026-11-01',
          close_previous: true,
        },
      ]),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the rate the API refuses and the rules in the way', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/rates'), () =>
        fail(409, 'RATE_OVERLAP', 'A rate already runs in that period.', {
          details: { conflicts: [{ id: 'x', effective_from: '2026-03-01', effective_to: null }] },
        }),
      ),
      ...teamHandlers({ rules: [samCostRule] }),
    );
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Set cost rate' }));
    const dialog = await screen.findByRole('dialog', { name: /new cost/i });
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate (£ per hour)' }), '40');
    await user.click(within(dialog).getByRole('button', { name: 'Save rate' }));

    expect(
      await within(dialog).findByText('A rate already runs in that period.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('list', { name: 'Rates in the way' })).toHaveTextContent(
      '01/03/2026 – open-ended',
    );
  });

  it('hides the rates without rate.read and the buttons without rate.manage', async () => {
    server.use(...teamHandlers());
    const first = renderDetail(['member.read']);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sam Staff' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Rates' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    first.unmount();

    renderDetail(['member.read', 'rate.read']);
    expect(await region('Rates')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set charge-out rate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set cost rate' })).not.toBeInTheDocument();
  });

  it('lists what refers to the person', async () => {
    server.use(
      http.get(orgApiPath('/staff/:staffId'), () =>
        ok(
          detailOf(sam, {
            usage: [{ kind: 'time_entries', label: 'Time entries', count: 42 }],
            can_delete: false,
          }),
        ),
      ),
      ...teamHandlers(),
    );
    renderDetail();

    const used = await region('Used by');
    expect(within(used).getByText('Time entries: 42')).toBeInTheDocument();
  });

  it('says so for a person that does not exist, and needs member.read', async () => {
    server.use(...teamHandlers());
    const first = renderDetail(OWNER_PERMISSIONS, 'nobody');
    expect(await screen.findByText('Staff member not found')).toBeInTheDocument();
    first.unmount();

    renderDetail(['client.read']);
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });
});
