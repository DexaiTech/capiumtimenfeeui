import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { expectRequiredFields } from '@/test/requiredFields';
import { fail, ok, server } from '@/test/server';

import {
  ADMIN_PERMISSIONS,
  adminRole,
  staffRole,
  orgContext,
  reviewerRole,
  testPermissions,
  testRoles,
} from '../test/fixtures';
import { orgPath, settingsHandlers } from '../test/handlers';
import { mockDesktopViewport, renderSettings } from '../test/render';
import type { Role } from '../types';
import RolesSettingsPage from './RolesSettingsPage';

const asAdmin = { context: orgContext({ role: adminRole, permissions: ADMIN_PERMISSIONS }) };

describe('RolesSettingsPage', () => {
  beforeEach(() => {
    mockDesktopViewport();
    server.use(...settingsHandlers());
  });

  it('lists roles with member counts and a System or Custom badge', async () => {
    renderSettings(<RolesSettingsPage />);

    const owner = await screen.findByRole('row', { name: /Owner/ });
    expect(within(owner).getByText('System')).toBeInTheDocument();
    expect(within(owner).getByRole('cell', { name: '1' })).toBeInTheDocument();
    const recruiter = screen.getByRole('row', { name: /Reviewer/ });
    expect(within(recruiter).getByText('Custom')).toBeInTheDocument();
    expect(within(recruiter).getByText('Adds new staff.')).toBeInTheDocument();
    // System roles can only be viewed, custom ones edited.
    expect(screen.getByRole('button', { name: 'View role Owner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit role Reviewer' })).toBeInTheDocument();
  });

  it('shows a system role read-only and explains why', async () => {
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'View role Staff' }));

    expect(await screen.findByRole('heading', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByText('System roles are read-only.')).toBeInTheDocument();
    expect(screen.getByText(/cannot be renamed, changed or deleted/)).toBeInTheDocument();
    // The catalogue is grouped by category, with the role's permissions ticked.
    const members = screen.getByRole('group', { name: 'Staff' });
    expect(within(members).getByRole('checkbox', { name: /member\.read/ })).toBeChecked();
    expect(within(members).getByRole('checkbox', { name: /member\.invite/ })).not.toBeChecked();
    for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
    expect(screen.queryByRole('checkbox', { name: /Select all/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete role' })).not.toBeInTheDocument();
  });

  it('creates a custom role with a name, description and chosen permissions', async () => {
    let body: unknown;
    const created: Role = {
      id: 'role-new',
      name: 'Auditor',
      system_key: null,
      description: 'Reads the log.',
      is_system: false,
      permissions: ['audit_log.read', 'member.invite', 'member.read'],
      member_count: 0,
    };
    const stored = [...testRoles];
    server.use(
      http.get(orgPath('/roles'), () => ok(stored)),
      http.post(orgPath('/roles'), async ({ request }) => {
        body = await request.json();
        stored.push(created);
        return ok(created, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'New role' }));
    await user.type(await screen.findByLabelText('Name'), 'Auditor');
    await user.type(screen.getByLabelText('Description'), 'Reads the log.');
    // "Start from" copies an existing role's permissions.
    await user.selectOptions(screen.getByLabelText('Start from'), 'Reviewer');
    expect(screen.getByRole('checkbox', { name: /member\.invite/ })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /audit_log\.read/ }));
    expect(screen.getByText(`3 of ${testPermissions.length} selected`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(await screen.findByText('Role “Auditor” created')).toBeInTheDocument();
    expect(body).toEqual({
      name: 'Auditor',
      description: 'Reads the log.',
      permissions: ['audit_log.read', 'member.invite', 'member.read'],
    });
    // The new role opens in the editor.
    expect(await screen.findByRole('heading', { name: 'Auditor' })).toBeInTheDocument();
  });

  it('selects a whole category and filters the catalogue by search', async () => {
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'New role' }));

    await user.click(await screen.findByRole('checkbox', { name: 'Select all in Staff' }));
    const members = screen.getByRole('group', { name: 'Staff' });
    for (const checkbox of within(members).getAllByRole('checkbox')) expect(checkbox).toBeChecked();
    expect(screen.getByText(`4 of ${testPermissions.length} selected`)).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search permissions' }), 'audit');
    expect(screen.getByRole('group', { name: 'Audit' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Staff' })).not.toBeInTheDocument();
  });

  it('locks the permissions the current user does not hold', async () => {
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />, asAdmin);
    await user.click(await screen.findByRole('button', { name: 'New role' }));

    const locked = await screen.findByRole('checkbox', { name: /organization\.delete/ });
    expect(locked).toBeDisabled();
    expect(locked).toHaveAccessibleDescription(/You don't hold this permission yourself/);
    expect(screen.getByRole('checkbox', { name: /organization\.update/ })).toBeEnabled();
    expect(
      screen.getByText(/1 permission is locked because you do not hold it/),
    ).toBeInTheDocument();

    // "Select all" leaves the locked permission out.
    await user.click(screen.getByRole('checkbox', { name: 'Select all in Practice' }));
    expect(locked).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /organization\.read/ })).toBeChecked();

    // Hovering explains why.
    await user.hover(screen.getByText('Delete the practice'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      "You don't hold this permission yourself",
    );
  });

  it('renames a custom role and replaces its permissions', async () => {
    const calls: Array<{ method: string; body: unknown }> = [];
    const renamed: Role = { ...reviewerRole, name: 'Talent' };
    const saved: Role = { ...renamed, permissions: ['member.read'] };
    server.use(
      http.patch(orgPath(`/roles/${reviewerRole.id}`), async ({ request }) => {
        calls.push({ method: 'PATCH', body: await request.json() });
        return ok(renamed);
      }),
      http.put(orgPath(`/roles/${reviewerRole.id}/permissions`), async ({ request }) => {
        calls.push({ method: 'PUT', body: await request.json() });
        return ok(saved);
      }),
    );
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'Edit role Reviewer' }));
    const name = await screen.findByLabelText('Name');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await user.clear(name);
    await user.type(name, 'Talent');
    await user.click(screen.getByRole('checkbox', { name: /member\.invite/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Role saved')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'PATCH', body: { name: 'Talent', description: 'Adds new staff.' } },
      { method: 'PUT', body: { permissions: ['member.read'] } },
    ]);
  });

  it('puts a duplicate-name 409 on the name field', async () => {
    server.use(http.post(orgPath('/roles'), () => fail(409, 'CONFLICT', 'Conflict.')));
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'New role' }));
    await user.type(await screen.findByLabelText('Name'), 'Admin');
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    expect(await screen.findByText(/A role with this name already exists/)).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('explains a 409 when a deleted role is still held by staff', async () => {
    server.use(
      http.delete(orgPath(`/roles/${reviewerRole.id}`), () => fail(409, 'CONFLICT', 'Conflict.')),
    );
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'Edit role Reviewer' }));
    await user.click(await screen.findByRole('button', { name: 'Delete role' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete role?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete role' }));

    expect(
      await within(dialog).findByText(/still in use: staff members hold it/),
    ).toBeInTheDocument();
  });

  it('deletes an unused custom role and returns to the list', async () => {
    let stored = [...testRoles];
    server.use(
      http.get(orgPath('/roles'), () => ok(stored)),
      http.delete(orgPath(`/roles/${reviewerRole.id}`), () => {
        stored = stored.filter((role) => role.id !== reviewerRole.id);
        return ok(null);
      }),
    );
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'Edit role Reviewer' }));
    await user.click(await screen.findByRole('button', { name: 'Delete role' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete role?' })).getByRole('button', {
        name: 'Delete role',
      }),
    );

    expect(await screen.findByText('Role “Reviewer” deleted')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('table', { name: 'Roles' })).toBeInTheDocument());
    expect(screen.queryByRole('row', { name: /Reviewer/ })).not.toBeInTheDocument();
  });

  it('blocks deleting a role that has members before asking the server', async () => {
    const used: Role = { ...reviewerRole, member_count: 2 };
    server.use(...settingsHandlers({ roles: [adminRole, used] }));
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />);

    await user.click(await screen.findByRole('button', { name: 'Edit role Reviewer' }));
    await user.click(await screen.findByRole('button', { name: 'Delete role' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete role?' });
    expect(within(dialog).getByText(/2 staff members still have/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete role' })).toBeDisabled();
  });

  it('is view-only without role.manage', async () => {
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />, {
      context: orgContext({ role: staffRole, permissions: ['role.read', 'member.read'] }),
    });

    expect(await screen.findByRole('button', { name: 'View role Reviewer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New role' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View role Reviewer' }));
    expect(
      await screen.findByText('Your role lets you view roles but not change them.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('makes a custom role read-only when it holds permissions the user lacks', async () => {
    const powerful: Role = {
      ...reviewerRole,
      permissions: ['member.read', 'organization.delete'],
    };
    server.use(...settingsHandlers({ roles: [adminRole, powerful] }));
    const user = userEvent.setup();
    renderSettings(<RolesSettingsPage />, asAdmin);

    await user.click(await screen.findByRole('button', { name: 'Edit role Reviewer' }));
    expect(await screen.findByText("You can't edit this role.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
});

describe('RolesSettingsPage: mandatory fields', () => {
  it('stars the name of a new role, not the description or the starting point', async () => {
    const user = userEvent.setup();
    server.use(...settingsHandlers());
    mockDesktopViewport();
    renderSettings(<RolesSettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'New role' }));
    await screen.findByLabelText('Name');
    expectRequiredFields(document.body, {
      required: ['Name'],
      optional: ['Description', 'Start from'],
    });
  });
});
