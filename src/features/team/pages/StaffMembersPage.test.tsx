import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import {
  ada,
  adminRole,
  detailOf,
  grace,
  ivy,
  linus,
  sam,
  seniorGrade,
  staff,
  staffRole,
} from '../test/fixtures';
import { orgApiPath, page, teamHandlers } from '../test/handlers';
import { Route, Routes } from 'react-router';

import StaffDetailPage from './StaffDetailPage';
import StaffMembersPage from './StaffMembersPage';

const TEMP_PASSWORD = 'Tq7-hv2Lp9xZk4Rw';

type User = ReturnType<typeof userEvent.setup>;

/** A staff row by the person's name (other rows can mention them as approver). */
const row = (name: RegExp) =>
  screen.findByRole('row', { name: new RegExp(`^Select ${name.source}`) });

async function openActions(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  return screen.findByRole('menu', { name: `Actions for ${name}` });
}

const menuItems = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent);

async function openAddDialog(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Add staff member' }));
  const dialog = await screen.findByRole('region', { name: 'Add staff member' });
  await within(dialog).findByRole('combobox', { name: 'Grade' });
  return dialog;
}

async function fillRequired(dialog: HTMLElement, user: User) {
  await user.type(within(dialog).getByRole('textbox', { name: 'Full name' }), 'Katherine Johnson');
  await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Grade' }), 'Senior');
  await user.type(within(dialog).getByLabelText('Start date'), '2026-10-19');
}

function renderPage(options: Parameters<typeof renderInOrg>[1] = {}) {
  return renderInOrg(<StaffMembersPage />, options);
}

/** The list and a person's own page, as the router serves them. */
function renderRouted(options: Parameters<typeof renderInOrg>[1] = {}) {
  return renderInOrg(
    <Routes>
      <Route path="/acme/team/staff" element={<StaffMembersPage />} />
      <Route path="/acme/team/staff/:staffId" element={<StaffDetailPage />} />
    </Routes>,
    { route: '/acme/team/staff', ...options },
  );
}

beforeEach(() => {
  server.use(...teamHandlers());
});

describe('StaffMembersPage list', () => {
  it('lists staff with code, grade, approver, hours, days, target, status and login status', async () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Staff Members' })).toBeInTheDocument();
    const samRow = await row(/Sam Staff/);
    const cells = within(samRow);
    expect(cells.getByText('S002')).toBeInTheDocument();
    expect(cells.getByText('Senior')).toBeInTheDocument();
    expect(cells.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(cells.getByText('7:00')).toBeInTheDocument();
    expect(cells.getByText('Mon–Thu')).toBeInTheDocument();
    expect(cells.getByText('80%')).toBeInTheDocument();
    expect(cells.getByText('Active')).toBeInTheDocument();
    expect(cells.getByText('No login')).toBeInTheDocument();
    expect(cells.getByText('£120.00/h')).toBeInTheDocument();
    expect(cells.getByText('£30.00/h')).toBeInTheDocument();

    const adaRow = await row(/Ada Lovelace/);
    expect(within(adaRow).getByText('You')).toBeInTheDocument();
    expect(within(adaRow).getByText('Linked')).toBeInTheDocument();
    expect(within(adaRow).getByText('Mon–Fri')).toBeInTheDocument();
    expect(within(await row(/Ivy Invited/)).getByText('Invited')).toBeInTheDocument();

    // The Active tab is the default; people who are inactive or left are on their own tabs.
    expect(screen.queryByRole('row', { name: /Linus Torvalds/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /^Active\s*4$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Showing 4 people · End of the list')).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/staff'), () => new Promise(() => undefined)));
    renderPage();
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('hides the rate columns without rate.read', async () => {
    renderPage({ context: contextWith(OWNER_PERMISSIONS.filter((code) => code !== 'rate.read')) });
    await row(/Sam Staff/);
    expect(screen.queryByRole('columnheader', { name: /Charge-out rate/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Cost rate/ })).not.toBeInTheDocument();
    expect(screen.queryByText('£120.00/h')).not.toBeInTheDocument();
  });

  it('switches between the status tabs and asks the API for that status', async () => {
    const statuses: string[][] = [];
    server.use(
      ...teamHandlers({ onStaffList: (params) => statuses.push(params.getAll('status')) }),
    );
    const user = userEvent.setup();
    renderPage();
    await row(/Sam Staff/);

    await user.click(screen.getByRole('tab', { name: 'Inactive' }));
    expect(await row(/Linus Torvalds/)).toBeInTheDocument();
    expect(within(await row(/Linus Torvalds/)).getByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Sam Staff/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Left' }));
    const left = await row(/Margaret Hamilton/);
    expect(within(left).getByText('Left')).toBeInTheDocument();
    expect(statuses.at(-1)).toEqual(['left']);
    expect(statuses).toContainEqual(['inactive']);
  });

  it('debounces the quick search and sends q once typing stops', async () => {
    const queries: Array<string | null> = [];
    server.use(...teamHandlers({ onStaffList: (params) => queries.push(params.get('q')) }));
    const user = userEvent.setup();
    renderPage();
    await row(/Sam Staff/);

    await user.type(screen.getByRole('searchbox', { name: 'Search staff' }), 'sam');

    await waitFor(() => expect(queries).toContain('sam'));
    expect(queries.filter((q) => q !== null)).toEqual(['sam']);
    await waitFor(() => expect(screen.queryByRole('row', { name: /Grace Hopper/ })).toBeNull());
    expect(screen.getByRole('row', { name: /Sam Staff/ })).toBeInTheDocument();
  });

  it('filters by grade, role and sign-in access, and clears the filters', async () => {
    const queries: URLSearchParams[] = [];
    server.use(...teamHandlers({ onStaffList: (params) => queries.push(params) }));
    const user = userEvent.setup();
    renderPage();
    await row(/Sam Staff/);

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = await screen.findByRole('dialog', { name: 'Filter staff' });
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Grade' }), 'Senior');
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Sign-in access' }),
      'No login',
    );
    await waitFor(() => expect(queries.at(-1)?.get('has_login')).toBe('false'));
    expect(queries.at(-1)?.get('grade_id')).toBe(seniorGrade.id);
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Grace Hopper/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('row', { name: /Sam Staff/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter, 2 filters applied/ })).toBeInTheDocument();

    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Role' }), 'Admin');
    await waitFor(() => expect(queries.at(-1)?.get('role_id')).toBe(adminRole.id));
    expect(await screen.findByText('No staff match')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    expect(await row(/Grace Hopper/)).toBeInTheDocument();
    expect(queries.at(-1)?.has('grade_id')).toBe(false);
  });

  it('filters by approver with a picker that offers only people who can sign in', async () => {
    const lookups: URLSearchParams[] = [];
    server.use(...teamHandlers({ onStaffList: (params) => lookups.push(params) }));
    const user = userEvent.setup();
    renderPage();
    await row(/Sam Staff/);

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = await screen.findByRole('dialog', { name: 'Filter staff' });
    await user.click(within(panel).getByRole('combobox', { name: 'Approver' }));
    const options = await within(panel).findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Ada Lovelace')]),
    );
    expect(within(panel).queryByRole('option', { name: /Sam Staff/ })).not.toBeInTheDocument();
    expect(lookups.some((params) => params.get('has_login') === 'true')).toBe(true);

    await user.click(within(panel).getByRole('option', { name: /Ada Lovelace/ }));
    await waitFor(() => expect(lookups.at(-1)?.get('approver_id')).toBe(ada.id));
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Ivy Invited/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('row', { name: /Sam Staff/ })).toBeInTheDocument();
  });

  it('sorts on the server by a header and reports aria-sort', async () => {
    const sorts: string[] = [];
    server.use(
      ...teamHandlers({
        onStaffList: (params) => sorts.push(`${params.get('sort')}:${params.get('order')}`),
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await row(/Sam Staff/);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(screen.getByRole('button', { name: 'Code' }));
    await waitFor(() => expect(sorts.at(-1)).toBe('code:asc'));
    expect(screen.getByRole('columnheader', { name: /Code/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: 'Code' }));
    await waitFor(() => expect(sorts.at(-1)).toBe('code:desc'));
    expect(screen.getByRole('columnheader', { name: /Code/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    // Columns the API cannot sort by have no sort button.
    expect(screen.queryByRole('button', { name: 'Approver' })).not.toBeInTheDocument();
  });

  it('loads the next page with the cursor', async () => {
    const cursors: Array<string | null> = [];
    const many = Array.from({ length: 3 }, (_, index) =>
      staff(`staff-${index}`, `S10${index}`, `Person ${index}`),
    );
    server.use(
      http.get(orgApiPath('/staff'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        cursors.push(params.get('cursor'));
        const result = page(many, params, 2);
        return ok(result.rows, { meta: result.meta });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await row(/Person 0/);
    expect(screen.getByText('Showing 2 people')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await row(/Person 2/)).toBeInTheDocument();
    expect(cursors).toEqual([null, '2']);
    expect(screen.getByText('Showing 3 people · End of the list')).toBeInTheDocument();
  });

  it('hides and shows columns, and selects rows', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/Sam Staff/);

    expect(screen.getByRole('columnheader', { name: /Approver/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Start date/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show/Hide Columns' }));
    await user.click(screen.getByRole('checkbox', { name: 'Approver' }));
    await user.click(screen.getByRole('checkbox', { name: 'Start date' }));
    expect(screen.queryByRole('columnheader', { name: /Approver/ })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Start date/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Name' })).toBeDisabled();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('checkbox', { name: 'Select Grace Hopper' }));
    expect(screen.getByRole('button', { name: 'Export 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(screen.getByRole('button', { name: 'Export 4' })).toBeInTheDocument();
  });

  it('exports the loaded rows as a CSV file', async () => {
    const created: Blob[] = [];
    // jsdom has no object URLs; the stand-ins are removed again in `finally`.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: (blob: Blob) => {
        created.push(blob);
        return 'blob:staff';
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    try {
      const user = userEvent.setup();
      renderPage();
      await row(/Sam Staff/);

      await user.click(screen.getByRole('button', { name: 'Export' }));
      expect(created).toHaveLength(1);
      expect(created[0]?.type).toBe('text/csv;charset=utf-8');
    } finally {
      Reflect.deleteProperty(URL, 'createObjectURL');
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('shows the empty states and the error state with a retry', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers({ staff: [] }));
    const first = renderPage();
    expect(await screen.findByText('No staff yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add staff member' })).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: 'Left' }));
    expect(await screen.findByText('No left staff')).toBeInTheDocument();
    first.unmount();

    let fails = true;
    server.use(
      http.get(orgApiPath('/staff'), () =>
        fails
          ? fail(500, 'INTERNAL_ERROR', 'Boom.')
          : ok([sam], { meta: { next_cursor: null, has_more: false } }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Could not load the staff list')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/Sam Staff/)).toBeInTheDocument();
  });

  it('explains missing access without member.read', () => {
    renderPage({ context: contextWith([]) });
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
  });

  it('hides Add staff member and the row actions without the staff permissions', async () => {
    renderPage({ context: contextWith(STAFF_PERMISSIONS) });
    await row(/Grace Hopper/);
    expect(screen.queryByRole('button', { name: 'Add staff member' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Cost rate/ })).not.toBeInTheDocument();
  });
});

describe('StaffMembersPage row actions', () => {
  it('offers the actions the person and the permissions allow', async () => {
    const user = userEvent.setup();
    renderPage();

    // No login: invite, link, deactivate, delete; nothing that needs a login.
    expect(menuItems(await openActions(user, 'Sam Staff'))).toEqual([
      'Edit',
      'Invite to sign in',
      'Link login',
      'Deactivate',
      'Delete',
    ]);
    await user.keyboard('{Escape}');

    // A login: change role, unlink, reset password.
    expect(menuItems(await openActions(user, 'Grace Hopper'))).toEqual([
      'Edit',
      'Change role',
      'Unlink login',
      'Reset password',
      'Deactivate',
      'Delete',
    ]);
    await user.keyboard('{Escape}');

    // A pending invitation can be sent again.
    expect(menuItems(await openActions(user, 'Ivy Invited'))).toEqual([
      'Edit',
      'Change role',
      'Resend invitation',
      'Unlink login',
      'Deactivate',
      'Delete',
    ]);
    await user.keyboard('{Escape}');

    // Nobody deactivates, deletes or un-logs themselves.
    expect(menuItems(await openActions(user, 'Ada Lovelace'))).toEqual(['Edit']);
  });

  it('offers Reactivate to people who are inactive or have left', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/Sam Staff/);

    await user.click(screen.getByRole('tab', { name: 'Inactive' }));
    expect(menuItems(await openActions(user, 'Linus Torvalds'))).toEqual([
      'Edit',
      'Change role',
      'Unlink login',
      'Reactivate',
      'Deactivate',
      'Delete',
    ]);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('tab', { name: 'Left' }));
    const menu = await openActions(user, 'Margaret Hamilton');
    expect(menuItems(menu)).toEqual(['Edit', 'Reactivate', 'Delete']);
  });

  it('keeps an Owner locked for anyone but an Owner', async () => {
    const owner = staff('staff-owner', 'S007', 'Olivia Owner', {
      has_login: true,
      login_status: 'active',
      role: { id: 'role-owner', name: 'Owner', system_key: 'owner' },
    });
    server.use(...teamHandlers({ staff: [owner] }));
    const user = userEvent.setup();
    renderPage({
      context: {
        ...contextWith(OWNER_PERMISSIONS),
        role: { id: adminRole.id, name: 'Admin', system_key: 'admin' },
      },
    });

    expect(menuItems(await openActions(user, 'Olivia Owner'))).toEqual(['Edit']);
  });

  it('reactivates in one step and explains a refusal', async () => {
    let attempt = 0;
    server.use(
      http.post(orgApiPath(`/staff/${linus.id}/reactivate`), () => {
        attempt += 1;
        return attempt === 1
          ? fail(409, 'STAFF_EMAIL_TAKEN', 'Another active staff member uses this email.')
          : ok(detailOf({ ...linus, status: 'active' }));
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await row(/Sam Staff/);
    await user.click(screen.getByRole('tab', { name: 'Inactive' }));

    await user.click(await screen.findByRole('button', { name: 'Actions for Linus Torvalds' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reactivate' }));
    expect(await screen.findByText('Could not reactivate')).toBeInTheDocument();
    expect(screen.getByText('Another active staff member uses this email.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Actions for Linus Torvalds' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reactivate' }));
    expect(await screen.findByText('Linus Torvalds reactivated')).toBeInTheDocument();
  });
});

describe('AddStaffPanel', () => {
  it('adds a staff member without a login and sends exactly the filled fields', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath('/staff'), async ({ request }) => {
        body = await request.json();
        return ok(detailOf(staff('staff-kj', 'S007', 'Katherine Johnson')), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddDialog(user);
    // The practice defaults are filled in.
    expect(within(dialog).getByRole('textbox', { name: 'Hours per working day' })).toHaveValue(
      '7.5',
    );
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      expect(within(dialog).getByRole('checkbox', { name: day })).toBeChecked();
    }
    expect(within(dialog).getByRole('checkbox', { name: 'Saturday' })).not.toBeChecked();
    expect(within(dialog).getByRole('radio', { name: /No login/ })).toBeChecked();

    await fillRequired(dialog, user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Staff code' }), 'kat');
    await user.type(within(dialog).getByRole('textbox', { name: 'Work email' }), 'kat@example.com');
    await user.type(within(dialog).getByRole('textbox', { name: 'Job title' }), 'Tax senior');
    await user.type(within(dialog).getByRole('textbox', { name: 'Initials' }), 'kj');
    await user.type(within(dialog).getByRole('textbox', { name: 'Chargeable target (%)' }), '62.5');
    const hours = within(dialog).getByRole('textbox', { name: 'Hours per working day' });
    await user.clear(hours);
    await user.type(hours, '7:30');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Friday' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));

    expect(await screen.findByText('Katherine Johnson added')).toBeInTheDocument();
    expect(body).toEqual({
      full_name: 'Katherine Johnson',
      grade_id: seniorGrade.id,
      start_date: '2026-10-19',
      working_minutes_per_day: 450,
      working_days: [1, 2, 3, 4],
      code: 'KAT',
      email: 'kat@example.com',
      job_title: 'Tax senior',
      initials: 'KJ',
      chargeable_target_bp: 6250,
    });
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Add staff member' })).not.toBeInTheDocument(),
    );
  });

  it('keeps the grade and the start date for the next person with "Save and add another"', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(orgApiPath('/staff'), async ({ request }) => {
        bodies.push(await request.json());
        return ok(detailOf(staff('staff-kj', 'S007', 'Katherine Johnson')), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddDialog(user);
    await fillRequired(dialog, user);
    await user.click(within(dialog).getByRole('button', { name: 'Save and add another' }));

    expect(await screen.findByText('Katherine Johnson added')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: 'Full name' })).toHaveValue(''),
    );
    expect(within(dialog).getByRole('combobox', { name: 'Grade' })).toHaveValue(seniorGrade.id);
    expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-10-19');
    expect(screen.getByRole('region', { name: 'Add staff member' })).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
  });

  it('sets the cost and charge-out rate with the person, from the date given', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath('/staff'), async ({ request }) => {
        body = await request.json();
        return ok(detailOf(staff('staff-kj', 'S007', 'Katherine Johnson')), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddDialog(user);
    await fillRequired(dialog, user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Cost rate (£/h)' }), '48');
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Charge-out rate (£/h)' }),
      '95.50',
    );
    await user.type(within(dialog).getByLabelText('Rates start'), '2026-11-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));

    expect(await screen.findByText('Katherine Johnson added')).toBeInTheDocument();
    expect(body).toMatchObject({
      cost_rate: 4800,
      charge_rate: 9550,
      rate_effective_from: '2026-11-01',
    });
  });

  it('sends no rate when the fields are left empty, and rejects one that is not money', async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(orgApiPath('/staff'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok(detailOf(staff('staff-kj', 'S007', 'Katherine Johnson')), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddDialog(user);
    await fillRequired(dialog, user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Cost rate (£/h)' }), 'free');
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));
    expect(
      await within(dialog).findByText('Enter the cost rate in pounds per hour, for example 48.00'),
    ).toBeInTheDocument();
    expect(body).toEqual({});

    await user.clear(within(dialog).getByRole('textbox', { name: 'Cost rate (£/h)' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));
    await screen.findByText('Katherine Johnson added');
    expect(body).not.toHaveProperty('cost_rate');
    expect(body).not.toHaveProperty('charge_rate');
    expect(body).not.toHaveProperty('rate_effective_from');
  });

  it('offers the rates only to someone who may manage them', async () => {
    const user = userEvent.setup();
    renderPage({
      context: contextWith(OWNER_PERMISSIONS.filter((code) => code !== 'rate.manage')),
    });

    const dialog = await openAddDialog(user);
    expect(
      within(dialog).queryByRole('textbox', { name: 'Cost rate (£/h)' }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Rates start')).not.toBeInTheDocument();
  });

  it('offers only active grades and only approvers who can sign in', async () => {
    const lookups: URLSearchParams[] = [];
    server.use(...teamHandlers({ onStaffList: (params) => lookups.push(params) }));
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddDialog(user);
    const grades = within(within(dialog).getByRole('combobox', { name: 'Grade' }))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(grades).toEqual(['Choose a grade', 'Partner', 'Senior']);

    await user.click(within(dialog).getByRole('combobox', { name: 'Approver' }));
    const names = (await within(dialog).findAllByRole('option')).map(
      (option) => option.textContent,
    );
    expect(names.join('|')).toContain('Ada Lovelace');
    expect(names.join('|')).toContain('Grace Hopper');
    expect(names.join('|')).not.toContain('Sam Staff');
    const lookup = lookups.find((params) => params.get('has_login') === 'true');
    expect(lookup?.get('selectable')).toBe('true');

    await user.click(within(dialog).getByRole('option', { name: /Grace Hopper/ }));
    expect(within(dialog).getByRole('combobox', { name: 'Approver' })).toHaveAttribute(
      'placeholder',
      'Grace Hopper',
    );
  });

  it('validates the required fields before sending anything', async () => {
    let posted = 0;
    server.use(
      http.post(orgApiPath('/staff'), () => {
        posted += 1;
        return ok({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddDialog(user);
    const hours = within(dialog).getByRole('textbox', { name: 'Hours per working day' });
    await user.clear(hours);
    await user.type(hours, '30');
    await user.type(within(dialog).getByRole('textbox', { name: 'Initials' }), 'A-B');
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      await user.click(within(dialog).getByRole('checkbox', { name: day }));
    }
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));

    expect(await within(dialog).findByText('Enter the full name')).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Grade' })).toHaveAccessibleDescription(
      'Choose a grade',
    );
    expect(within(dialog).getByText('Enter the start date')).toBeInTheDocument();
    expect(within(dialog).getByText('Use 1 to 6 letters or digits')).toBeInTheDocument();
    expect(within(dialog).getByText(/at most 24/)).toBeInTheDocument();
    expect(within(dialog).getByText('Choose at least one working day')).toBeInTheDocument();
    expect(posted).toBe(0);
  });

  it('shows duplicate code and email on their fields', async () => {
    server.use(
      http.post(orgApiPath('/staff'), () =>
        fail(409, 'STAFF_CODE_TAKEN', 'Another staff member already has this code.', {
          details: [
            {
              field: 'code',
              code: 'duplicate',
              message: 'Another staff member already has this code.',
            },
            {
              field: 'email',
              code: 'duplicate',
              message: 'Another active staff member uses this email address.',
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddDialog(user);
    await fillRequired(dialog, user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Staff code' }), 'S002');
    await user.type(within(dialog).getByRole('textbox', { name: 'Work email' }), 'sam@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));

    const code = within(dialog).getByRole('textbox', { name: 'Staff code' });
    await waitFor(() => expect(code).toHaveAttribute('aria-invalid', 'true'));
    expect(code).toHaveAccessibleDescription('Another staff member already has this code.');
    expect(within(dialog).getByRole('textbox', { name: 'Work email' })).toHaveAccessibleDescription(
      'Another active staff member uses this email address.',
    );
    expect(screen.queryByText('Katherine Johnson added')).not.toBeInTheDocument();
  });

  it('invites them by email after creating the record', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    server.use(
      http.post(orgApiPath('/staff'), async ({ request }) => {
        calls.push({ path: 'staff', body: await request.json() });
        return ok(detailOf(staff('staff-kj', 'S007', 'Katherine Johnson')), { status: 201 });
      }),
      http.post(orgApiPath('/staff/staff-kj/invite'), async ({ request }) => {
        calls.push({ path: 'invite', body: await request.json() });
        return ok({
          staff: detailOf(staff('staff-kj', 'S007', 'Katherine Johnson')),
          invited_at: '2026-10-18T09:00:00Z',
          expires_at: '2026-10-25T09:00:00Z',
          resent: false,
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddDialog(user);
    await fillRequired(dialog, user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Work email' }), 'kat@example.com');
    await user.click(within(dialog).getByRole('radio', { name: /Invite by email/ }));
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Sign-in email' }),
      'kat.login@example.com',
    );
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Role' }), 'Admin');
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));

    expect(await screen.findByText('Invitation sent to kat.login@example.com')).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toEqual(['staff', 'invite']);
    expect(calls[0]?.body).toMatchObject({ role_id: adminRole.id, email: 'kat@example.com' });
    expect(calls[1]?.body).toEqual({ email: 'kat.login@example.com' });
  });

  it('creates an account and shows the temporary password once', async () => {
    let linkBody: unknown;
    server.use(
      http.post(orgApiPath('/staff'), () =>
        ok(detailOf(staff('staff-kj', 'S007', 'Katherine Johnson')), { status: 201 }),
      ),
      http.post(orgApiPath('/staff/staff-kj/link-login'), async ({ request }) => {
        linkBody = await request.json();
        return ok({
          staff: detailOf(
            staff('staff-kj', 'S007', 'Katherine Johnson', {
              has_login: true,
              login_email: 'kat@example.com',
              login_status: 'active',
            }),
          ),
          temporary_password: TEMP_PASSWORD,
          email_sent: true,
          merged_from: null,
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddDialog(user);
    await fillRequired(dialog, user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Work email' }), 'kat@example.com');
    await user.click(within(dialog).getByRole('radio', { name: /Create an account now/ }));
    expect(
      within(dialog).getByRole('checkbox', { name: /Email them a link to choose/ }),
    ).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));

    const result = await screen.findByRole('dialog', { name: 'Staff member added' });
    expect(linkBody).toEqual({ mode: 'create_account', send_email: true });
    expect(within(result).getByRole('textbox', { name: 'Temporary password' })).toHaveValue(
      TEMP_PASSWORD,
    );
    expect(within(result).getByText(/also emailed Katherine Johnson a link/)).toBeInTheDocument();
    // Neither a toast nor any text of the page repeats the password.
    expect(document.body.textContent).not.toContain(TEMP_PASSWORD);

    // Escape does not discard it: only Done does.
    await user.keyboard('{Escape}');
    expect(await within(result).findByRole('alert')).toHaveTextContent(/Select Done/);
    await user.click(within(result).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue(TEMP_PASSWORD)).not.toBeInTheDocument();
  });

  it('keeps the new record and reports a login that could not be created', async () => {
    server.use(
      http.post(orgApiPath('/staff'), () =>
        ok(detailOf(staff('staff-kj', 'S007', 'Katherine Johnson')), { status: 201 }),
      ),
      http.post(orgApiPath('/staff/staff-kj/invite'), () =>
        fail(409, 'EMAIL_TAKEN', 'That address already belongs to an account.'),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAddDialog(user);
    await fillRequired(dialog, user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Work email' }), 'kat@example.com');
    await user.click(within(dialog).getByRole('radio', { name: /Invite by email/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add staff member' }));

    expect(await screen.findByText('Katherine Johnson added')).toBeInTheDocument();
    expect(
      await screen.findByText('Staff member added, but the login could not be created'),
    ).toBeInTheDocument();
    expect(screen.getByText('That address already belongs to an account.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Add staff member' })).not.toBeInTheDocument(),
    );
  });

  it('opens from the quick-create link, only with member.invite', async () => {
    const first = renderPage({ route: '/?new=1' });
    expect(await screen.findByRole('region', { name: 'Add staff member' })).toBeInTheDocument();
    first.unmount();

    renderPage({ route: '/?new=1', context: contextWith(STAFF_PERMISSIONS) });
    await row(/Sam Staff/);
    expect(screen.queryByRole('region', { name: 'Add staff member' })).not.toBeInTheDocument();
  });
});

describe('EditStaffPanel', () => {
  async function openEdit(user: User, name: string) {
    // "Edit" in the list opens the person's own page; the dialog opens from there.
    await openActions(user, name);
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(await screen.findByRole('button', { name: 'Edit details' }));
    const dialog = await screen.findByRole('region', { name: 'Edit staff member' });
    await within(dialog).findByRole('combobox', { name: 'Grade' });
    return dialog;
  }

  it('shows every profile field of the person', async () => {
    const user = userEvent.setup();
    renderRouted();

    const dialog = await openEdit(user, 'Sam Staff');
    expect(within(dialog).getByRole('textbox', { name: 'Full name' })).toHaveValue('Sam Staff');
    expect(within(dialog).getByRole('textbox', { name: 'Staff code' })).toHaveValue('S002');
    expect(within(dialog).getByRole('textbox', { name: 'Work email' })).toHaveValue(
      'sam@example.com',
    );
    expect(within(dialog).getByRole('combobox', { name: 'Grade' })).toHaveValue(seniorGrade.id);
    expect(within(dialog).getByRole('combobox', { name: 'Approver' })).toHaveAttribute(
      'placeholder',
      'Ada Lovelace',
    );
    expect(within(dialog).getByRole('textbox', { name: 'Hours per working day' })).toHaveValue('7');
    expect(within(dialog).getByRole('checkbox', { name: 'Friday' })).not.toBeChecked();
    expect(within(dialog).getByRole('textbox', { name: 'Chargeable target (%)' })).toHaveValue(
      '80',
    );
    expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-01-05');
    expect(within(dialog).getByLabelText('Leaving date')).toHaveValue('');
    expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('active');
    expect(within(dialog).getByRole('button', { name: 'Save details' })).toBeDisabled();
  });

  it('sends only the fields that changed', async () => {
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/staff/${sam.id}`), async ({ request }) => {
        body = await request.json();
        return ok(detailOf({ ...sam, chargeable_target_bp: 6250 }));
      }),
    );
    const user = userEvent.setup();
    renderRouted();

    const dialog = await openEdit(user, 'Sam Staff');
    const target = within(dialog).getByRole('textbox', { name: 'Chargeable target (%)' });
    await user.clear(target);
    await user.type(target, '62.5');
    await user.type(within(dialog).getByRole('textbox', { name: 'Initials' }), 'ss');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Friday' }));
    const email = within(dialog).getByRole('textbox', { name: 'Work email' });
    await user.clear(email);
    await user.click(within(dialog).getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Details of Sam Staff saved')).toBeInTheDocument();
    expect(body).toEqual({
      email: null,
      initials: 'SS',
      working_days: [1, 2, 3, 4, 5],
      chargeable_target_bp: 6250,
    });
  });

  it('changes the approver with a picker limited to people who can sign in', async () => {
    let body: unknown;
    const lookups: URLSearchParams[] = [];
    server.use(
      ...teamHandlers({ onStaffList: (params) => lookups.push(params) }),
      http.patch(orgApiPath(`/staff/${sam.id}`), async ({ request }) => {
        body = await request.json();
        return ok(detailOf(sam));
      }),
    );
    const user = userEvent.setup();
    renderRouted();

    const dialog = await openEdit(user, 'Sam Staff');
    await user.click(within(dialog).getByRole('combobox', { name: 'Approver' }));
    const options = await within(dialog).findAllByRole('option');
    const text = options.map((option) => option.textContent).join('|');
    expect(text).toContain('Grace Hopper');
    expect(text).not.toContain('Sam Staff');
    expect(text).not.toContain('Linus Torvalds');
    expect(lookups.some((params) => params.get('has_login') === 'true')).toBe(true);
    await user.click(within(dialog).getByRole('option', { name: /Grace Hopper/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save details' }));

    await screen.findByText('Details of Sam Staff saved');
    expect(body).toEqual({ approver_id: grace.id });
  });

  it('validates the dates and the hours', async () => {
    const user = userEvent.setup();
    renderRouted();

    const dialog = await openEdit(user, 'Sam Staff');
    await user.type(within(dialog).getByLabelText('Leaving date'), '2025-12-31');
    const hours = within(dialog).getByRole('textbox', { name: 'Hours per working day' });
    await user.clear(hours);
    await user.type(hours, '0');
    await user.click(within(dialog).getByRole('button', { name: 'Save details' }));

    expect(
      await within(dialog).findByText("The leaving date can't be before the start date"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/more than 0 and at most 24/)).toBeInTheDocument();
  });

  it('records a status change with the lifecycle call', async () => {
    const calls: Array<{ method: string; path: string; body: unknown }> = [];
    server.use(
      http.post(orgApiPath(`/staff/${sam.id}/deactivate`), async ({ request }) => {
        calls.push({ method: 'POST', path: 'deactivate', body: await request.json() });
        return ok(detailOf({ ...sam, status: 'left' }));
      }),
      http.patch(orgApiPath(`/staff/${sam.id}`), async ({ request }) => {
        calls.push({ method: 'PATCH', path: 'staff', body: await request.json() });
        return ok(detailOf(sam));
      }),
    );
    const user = userEvent.setup();
    renderRouted();

    const dialog = await openEdit(user, 'Sam Staff');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Status' }), 'Left');
    await user.type(within(dialog).getByLabelText('Leaving date'), '2026-10-30');
    await user.click(within(dialog).getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Details of Sam Staff saved')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'PATCH', path: 'staff', body: { leaving_date: '2026-10-30' } },
      {
        method: 'POST',
        path: 'deactivate',
        body: { status: 'left', leaving_date: '2026-10-30' },
      },
    ]);
  });

  it('shows the API refusal inside the dialog and keeps the values', async () => {
    server.use(
      http.patch(orgApiPath(`/staff/${sam.id}`), () =>
        fail(409, 'INITIALS_TAKEN', 'Another member already uses these initials.', {
          details: [{ field: 'initials', code: 'duplicate', message: 'These initials are taken.' }],
        }),
      ),
    );
    const user = userEvent.setup();
    renderRouted();

    const dialog = await openEdit(user, 'Sam Staff');
    await user.type(within(dialog).getByRole('textbox', { name: 'Initials' }), 'AL');
    await user.click(within(dialog).getByRole('button', { name: 'Save details' }));

    const initials = within(dialog).getByRole('textbox', { name: 'Initials' });
    await waitFor(() => expect(initials).toHaveAttribute('aria-invalid', 'true'));
    expect(initials).toHaveAccessibleDescription('These initials are taken.');
    expect(initials).toHaveValue('AL');
  });
});

describe('deactivating and deleting', () => {
  it('deactivates a person with a login after a confirmation dialog', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath(`/staff/${grace.id}/deactivate`), async ({ request }) => {
        body = await request.json();
        return ok(detailOf({ ...grace, status: 'inactive' }));
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Grace Hopper');
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate staff member?' });
    expect(within(dialog).getByText(/signed out everywhere/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Grace Hopper deactivated')).toBeInTheDocument();
    expect(body).toEqual({ status: 'inactive' });
  });

  it('marks someone as left with a leaving date', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath(`/staff/${sam.id}/deactivate`), async ({ request }) => {
        body = await request.json();
        return ok(detailOf({ ...sam, status: 'left' }));
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate staff member?' });
    await user.click(within(dialog).getByRole('radio', { name: /Mark as left/ }));
    const date = within(dialog).getByLabelText('Leaving date');
    await user.clear(date);
    await user.type(date, '2026-10-30');
    await user.click(within(dialog).getByRole('button', { name: 'Mark as left' }));

    expect(await screen.findByText('Sam Staff marked as left')).toBeInTheDocument();
    expect(body).toEqual({ status: 'left', leaving_date: '2026-10-30' });
  });

  it('explains the last-owner rule inside the dialog', async () => {
    server.use(
      http.post(orgApiPath(`/staff/${grace.id}/deactivate`), () =>
        fail(409, 'CONFLICT', 'The practice must keep at least one active owner who can sign in.', {
          details: { code: 'last_owner' },
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Grace Hopper');
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate staff member?' });
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(
      await within(dialog).findByText(
        'The practice must keep at least one active owner who can sign in.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Deactivate staff member?' })).toBeInTheDocument();
  });

  it('deletes an unused record after a confirmation', async () => {
    let deleted = 0;
    server.use(
      http.delete(orgApiPath(`/staff/${sam.id}`), () => {
        deleted += 1;
        return ok(null);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete staff member?' });
    expect(await within(dialog).findByText(/not used by any record/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Sam Staff deleted')).toBeInTheDocument();
    expect(deleted).toBe(1);
  });

  it('refuses to delete a record in use, lists what refers to it and offers to deactivate', async () => {
    let deleted = 0;
    server.use(
      http.get(orgApiPath(`/staff/${sam.id}`), () =>
        ok(
          detailOf(sam, {
            can_delete: false,
            usage: [
              { kind: 'time_entries', label: 'Time entries', count: 12 },
              { kind: 'timesheets', label: 'Timesheets', count: 2 },
            ],
          }),
        ),
      ),
      http.delete(orgApiPath(`/staff/${sam.id}`), () => {
        deleted += 1;
        return ok(null);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete staff member?' });
    expect(await within(dialog).findByText(/cannot be deleted/)).toBeInTheDocument();
    const usage = within(dialog).getByRole('list', { name: 'Records that refer to them' });
    expect(within(usage).getByText('Time entries')).toBeInTheDocument();
    expect(within(usage).getByText('12')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(deleted).toBe(0);

    await user.click(within(dialog).getByRole('button', { name: 'Deactivate instead' }));
    expect(
      await screen.findByRole('dialog', { name: 'Deactivate staff member?' }),
    ).toBeInTheDocument();
  });

  it('shows the API explanation when the record became used meanwhile', async () => {
    server.use(
      http.delete(orgApiPath(`/staff/${sam.id}`), () =>
        fail(409, 'STAFF_IN_USE', 'Sam Staff has records. Deactivate them instead.', {
          details: { usage: [{ kind: 'invoices', label: 'Invoices', count: 3 }] },
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete staff member?' });
    await user.click(await within(dialog).findByRole('button', { name: 'Delete' }));

    expect(
      await within(dialog).findByText('Sam Staff has records. Deactivate them instead.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Invoices')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});

describe('logins', () => {
  it('invites a person without a login', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath(`/staff/${sam.id}/invite`), async ({ request }) => {
        body = await request.json();
        return ok({
          staff: detailOf(sam),
          invited_at: '2026-10-18T09:00:00Z',
          expires_at: '2026-10-25T09:00:00Z',
          resent: false,
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Invite to sign in' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite to sign in' });
    expect(within(dialog).getByRole('textbox', { name: 'Sign-in email' })).toHaveValue(
      'sam@example.com',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Invitation sent')).toBeInTheDocument();
    expect(body).toEqual({ email: 'sam@example.com' });
  });

  it('sends a pending invitation again and explains a refusal', async () => {
    let attempt = 0;
    server.use(
      http.post(orgApiPath(`/staff/${ivy.id}/invite`), () => {
        attempt += 1;
        return attempt === 1
          ? fail(409, 'LOGIN_ALREADY_ACTIVE', 'They have already chosen a password.')
          : ok({
              staff: detailOf(ivy),
              invited_at: '2026-10-18T09:00:00Z',
              expires_at: '2026-10-25T09:00:00Z',
              resent: true,
            });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Ivy Invited');
    await user.click(screen.getByRole('menuitem', { name: 'Resend invitation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Resend invitation' });
    expect(
      within(dialog).queryByRole('textbox', { name: 'Sign-in email' }),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Resend invitation' }));
    expect(
      await within(dialog).findByText('They have already chosen a password.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Resend invitation' }));
    expect(await screen.findByText('Invitation sent again')).toBeInTheDocument();
  });

  it('links a person to an existing login', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath(`/staff/${sam.id}/link-login`), async ({ request }) => {
        body = await request.json();
        return ok({
          staff: detailOf({ ...grace, id: 'staff-merged' }),
          temporary_password: null,
          email_sent: false,
          merged_from: sam.id,
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Link login' }));
    const dialog = await screen.findByRole('dialog', { name: 'Link a login' });
    await user.click(within(dialog).getByRole('radio', { name: /Link to an existing login/ }));
    expect(within(dialog).getByText(/Merging cannot be undone/)).toBeInTheDocument();
    const email = within(dialog).getByRole('textbox', { name: 'Email of their existing login' });
    await user.clear(email);
    await user.click(within(dialog).getByRole('button', { name: 'Link login' }));
    expect(
      await within(dialog).findByText('Enter the email address the person already signs in with'),
    ).toBeInTheDocument();

    await user.type(email, 'grace@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Link login' }));

    expect(await screen.findByText('Login linked')).toBeInTheDocument();
    expect(body).toEqual({ mode: 'existing_user', email: 'grace@example.com' });
  });

  it('creates an account for an existing record and shows the password once', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath(`/staff/${sam.id}/link-login`), async ({ request }) => {
        body = await request.json();
        return ok({
          staff: detailOf({
            ...sam,
            has_login: true,
            login_email: 'sam@example.com',
            login_status: 'active',
          }),
          temporary_password: TEMP_PASSWORD,
          email_sent: false,
          merged_from: null,
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Link login' }));
    const dialog = await screen.findByRole('dialog', { name: 'Link a login' });
    await user.click(within(dialog).getByRole('checkbox', { name: /Email them a link/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Create login' }));

    const result = await screen.findByRole('dialog', { name: 'Login created' });
    expect(body).toEqual({ mode: 'create_account', email: 'sam@example.com', send_email: false });
    expect(within(result).getByRole('textbox', { name: 'Temporary password' })).toHaveValue(
      TEMP_PASSWORD,
    );
    await user.click(within(result).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows a merge conflict inside the dialog', async () => {
    server.use(
      http.post(orgApiPath(`/staff/${sam.id}/link-login`), () =>
        fail(409, 'LINK_CONFLICT', 'Both have a timesheet for the same week.', {
          details: { table: 'timesheets' },
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Link login' }));
    const dialog = await screen.findByRole('dialog', { name: 'Link a login' });
    await user.click(within(dialog).getByRole('radio', { name: /Link to an existing login/ }));
    const email = within(dialog).getByRole('textbox', { name: 'Email of their existing login' });
    await user.clear(email);
    await user.type(email, 'grace@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Link login' }));

    expect(
      await within(dialog).findByText('Both have a timesheet for the same week.'),
    ).toBeInTheDocument();
  });

  it('unlinks a login after a confirmation and explains ACCOUNT_SHARED', async () => {
    let attempt = 0;
    server.use(
      http.post(orgApiPath(`/staff/${grace.id}/unlink-login`), () => {
        attempt += 1;
        return attempt === 1
          ? fail(409, 'ACCOUNT_SHARED', 'Their account also belongs to another practice.')
          : ok(detailOf({ ...grace, has_login: false, login_status: 'none', login_email: null }));
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Grace Hopper');
    await user.click(screen.getByRole('menuitem', { name: 'Unlink login' }));
    const confirm = await screen.findByRole('dialog', { name: 'Unlink login?' });
    await user.click(within(confirm).getByRole('button', { name: 'Unlink login' }));
    expect(
      await within(confirm).findByText('Their account also belongs to another practice.'),
    ).toBeInTheDocument();

    await user.click(within(confirm).getByRole('button', { name: 'Unlink login' }));
    expect(await screen.findByText('Grace Hopper can no longer sign in')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('resets a password after confirmation and shows the new one once', async () => {
    server.use(
      http.post(orgApiPath(`/members/${grace.id}/reset-password`), () =>
        ok({ temporary_password: TEMP_PASSWORD }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Grace Hopper');
    await user.click(screen.getByRole('menuitem', { name: 'Reset password' }));
    const confirm = await screen.findByRole('dialog', { name: 'Reset password?' });
    await user.click(within(confirm).getByRole('button', { name: 'Reset password' }));

    const result = await screen.findByRole('dialog', { name: 'Password reset' });
    expect(within(result).getByRole('textbox', { name: 'Temporary password' })).toHaveValue(
      TEMP_PASSWORD,
    );
    await user.click(within(result).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('changes the role of a person with a login', async () => {
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/members/${grace.id}`), async ({ request }) => {
        body = await request.json();
        return ok({});
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Grace Hopper');
    await user.click(screen.getByRole('menuitem', { name: 'Change role' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change role' });
    expect(within(dialog).getByRole('button', { name: 'Change role' })).toBeDisabled();
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Role' }), 'Staff');
    await user.click(within(dialog).getByRole('button', { name: 'Change role' }));

    expect(await screen.findByText('Role changed')).toBeInTheDocument();
    expect(body).toEqual({ role_id: staffRole.id });
  });

  it('shows the grant rule on the role field', async () => {
    server.use(
      http.patch(orgApiPath(`/members/${grace.id}`), () =>
        fail(403, 'PERMISSION_DENIED', 'You can only assign roles whose permissions you hold.'),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await openActions(user, 'Grace Hopper');
    await user.click(screen.getByRole('menuitem', { name: 'Change role' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change role' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Role' }), 'Staff');
    await user.click(within(dialog).getByRole('button', { name: 'Change role' }));

    const select = within(dialog).getByRole('combobox', { name: 'Role' });
    await waitFor(() => expect(select).toHaveAttribute('aria-invalid', 'true'));
    expect(select).toHaveAccessibleDescription(
      'You can only assign roles whose permissions you hold.',
    );
  });
});
