import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { apiPath, fail, ok, server } from '@/test/server';

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
    expect(await screen.findByRole('region', { name: 'Edit staff member' })).toBeInTheDocument();
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
    const dialog = await screen.findByRole('region', { name: /new charge-out/i });
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
    const dialog = await screen.findByRole('region', { name: /new cost/i });
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

describe('StaffDetailPage: permissions of one person', () => {
  const CATALOGUE = [
    { code: 'time.log', category: 'Time', description: 'Log own time and run a timer' },
    { code: 'wip.read', category: 'Billing', description: 'View work in progress' },
    { code: 'invoice.read', category: 'Billing', description: 'View invoices and credit notes' },
  ];

  function permissionsOf(overrides: { grants?: string[]; denies?: string[] } = {}) {
    const grants = overrides.grants ?? [];
    const denies = overrides.denies ?? [];
    const role = ['time.log'];
    return {
      user_id: sam.id,
      role: sam.role,
      role_permissions: role,
      grants,
      denies,
      effective: [...role.filter((code) => !denies.includes(code)), ...grants],
    };
  }

  function serve(initial = permissionsOf()) {
    const bodies: unknown[] = [];
    let current = initial;
    server.use(
      ...teamHandlers(),
      http.get(apiPath('/permissions'), () => ok(CATALOGUE)),
      http.get(orgApiPath(`/members/${sam.id}/permissions`), () => ok(current)),
      http.put(orgApiPath(`/members/${sam.id}/permissions`), async ({ request }) => {
        const body = (await request.json()) as { grants: string[]; denies: string[] };
        bodies.push(body);
        current = permissionsOf(body);
        return ok(current);
      }),
    );
    return bodies;
  }

  it('shows the role and what was added or taken away for this person', async () => {
    serve(permissionsOf({ grants: ['wip.read'], denies: ['time.log'] }));
    renderDetail();

    const card = await region('Permissions');
    expect(await within(card).findByRole('list', { name: 'Also allowed' })).toHaveTextContent(
      'View work in progress',
    );
    expect(within(card).getByRole('list', { name: 'Not allowed' })).toHaveTextContent(
      'Log own time and run a timer',
    );
  });

  it('says when the person has exactly what their role gives', async () => {
    serve();
    renderDetail();

    const card = await region('Permissions');
    expect(await within(card).findByText(/exactly what their role gives/)).toBeInTheDocument();
  });

  it('gives this person a permission their role does not, without touching the role', async () => {
    const user = userEvent.setup();
    const bodies = serve();
    renderDetail();

    const card = await region('Permissions');
    await user.click(await within(card).findByRole('button', { name: 'Edit permissions' }));
    const sheet = await screen.findByRole('dialog', { name: 'Permissions of Sam Staff' });
    await user.click(within(sheet).getByRole('checkbox', { name: /View work in progress/ }));
    expect(within(sheet).getByText('1 more than the role, 0 fewer.')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Save permissions' }));

    await waitFor(() => expect(bodies).toEqual([{ grants: ['wip.read'], denies: [] }]));
    expect(await screen.findByText("Sam Staff's permissions saved")).toBeInTheDocument();
    expect(await within(card).findByRole('list', { name: 'Also allowed' })).toHaveTextContent(
      'View work in progress',
    );
  });

  it('takes a permission from this person that their role gives', async () => {
    const user = userEvent.setup();
    const bodies = serve();
    renderDetail();

    await user.click(
      await within(await region('Permissions')).findByRole('button', { name: 'Edit permissions' }),
    );
    const sheet = await screen.findByRole('dialog', { name: 'Permissions of Sam Staff' });
    await user.click(within(sheet).getByRole('checkbox', { name: /Log own time/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Save permissions' }));

    await waitFor(() => expect(bodies).toEqual([{ grants: [], denies: ['time.log'] }]));
  });

  it('puts the person back on their role with one click', async () => {
    const user = userEvent.setup();
    const bodies = serve(permissionsOf({ grants: ['wip.read'] }));
    renderDetail();

    await user.click(
      await within(await region('Permissions')).findByRole('button', { name: 'Edit permissions' }),
    );
    const sheet = await screen.findByRole('dialog', { name: 'Permissions of Sam Staff' });
    await user.click(within(sheet).getByRole('button', { name: 'Reset to the role' }));
    await user.click(within(sheet).getByRole('button', { name: 'Save permissions' }));

    await waitFor(() => expect(bodies).toEqual([{ grants: [], denies: [] }]));
  });

  it('cannot be edited by someone who may not manage roles', async () => {
    serve();
    renderDetail(OWNER_PERMISSIONS.filter((code) => code !== 'role.manage'));

    const card = await region('Permissions');
    await within(card).findByText(/exactly what their role gives/);
    expect(
      within(card).queryByRole('button', { name: 'Edit permissions' }),
    ).not.toBeInTheDocument();
  });

  it('is not shown to someone who may not read roles', async () => {
    serve();
    renderDetail(OWNER_PERMISSIONS.filter((code) => code !== 'role.read'));

    await screen.findByRole('heading', { level: 1, name: 'Sam Staff' });
    expect(screen.queryByRole('region', { name: 'Permissions' })).not.toBeInTheDocument();
  });

  it('shows the refusal of the server and keeps the grid open', async () => {
    const user = userEvent.setup();
    serve();
    server.use(
      http.put(orgApiPath(`/members/${sam.id}/permissions`), () =>
        fail(403, 'PERMISSION_DENIED', 'You cannot grant permissions you do not have.'),
      ),
    );
    renderDetail();

    await user.click(
      await within(await region('Permissions')).findByRole('button', { name: 'Edit permissions' }),
    );
    const sheet = await screen.findByRole('dialog', { name: 'Permissions of Sam Staff' });
    await user.click(within(sheet).getByRole('checkbox', { name: /View invoices/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Save permissions' }));

    expect(
      await within(sheet).findByText('You cannot grant permissions you do not have.'),
    ).toBeInTheDocument();
  });
});
