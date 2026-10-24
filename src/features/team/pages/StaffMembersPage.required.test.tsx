import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';
import { expectRequiredFields } from '@/test/requiredFields';

import { teamHandlers } from '../test/handlers';
import StaffDetailPage from './StaffDetailPage';
import StaffMembersPage from './StaffMembersPage';

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  server.use(...teamHandlers());
});

async function openActions(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
}

describe('mandatory fields of the staff dialogs', () => {
  it('marks the add form: name, grade, start date, hours, working days', async () => {
    const user = userEvent.setup();
    renderInOrg(<StaffMembersPage />, { context: contextWith(OWNER_PERMISSIONS) });
    await user.click(await screen.findByRole('button', { name: 'Add staff member' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add staff member' });
    await within(dialog).findByRole('combobox', { name: 'Grade' });

    expectRequiredFields(dialog, {
      required: ['Full name', 'Grade', 'Start date', 'Hours per working day'],
      optional: [
        'Staff code',
        'Work email',
        'Job title',
        'Initials',
        'Chargeable target (%)',
        'Cost rate (£/h)',
        'Charge-out rate (£/h)',
        'Rates start',
      ],
    });
    expect(within(dialog).getByRole('group', { name: 'Working days' })).toHaveAttribute(
      'aria-required',
      'true',
    );
    expect(within(dialog).getByText('Working days')).toHaveClass('field-required');

    // The sign-in email is mandatory only while there is no work email to fall back on.
    await user.click(within(dialog).getByRole('radio', { name: /Invite by email/ }));
    expectRequiredFields(dialog, { required: ['Sign-in email'] });
    await user.type(within(dialog).getByLabelText('Work email'), 'new@example.com');
    expectRequiredFields(dialog, { required: [], optional: ['Sign-in email', 'Role'] });
  });

  it('marks the edit form: the code and the target are mandatory there', async () => {
    const user = userEvent.setup();
    renderInOrg(
      <Routes>
        <Route path="/acme/team/staff" element={<StaffMembersPage />} />
        <Route path="/acme/team/staff/:staffId" element={<StaffDetailPage />} />
      </Routes>,
      { route: '/acme/team/staff' },
    );
    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(await screen.findByRole('button', { name: 'Edit details' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit staff member' });
    await within(dialog).findByRole('combobox', { name: 'Grade' });

    expectRequiredFields(dialog, {
      required: [
        'Full name',
        'Staff code',
        'Grade',
        'Hours per working day',
        'Chargeable target (%)',
      ],
      optional: ['Start date', 'Work email', 'Job title', 'Initials', 'Leaving date'],
    });
  });

  it('marks the change-role, link-login and invite dialogs', async () => {
    const user = userEvent.setup();
    renderInOrg(<StaffMembersPage />, { context: contextWith(OWNER_PERMISSIONS) });

    await openActions(user, 'Grace Hopper');
    await user.click(screen.getByRole('menuitem', { name: 'Change role' }));
    let dialog = await screen.findByRole('dialog', { name: 'Change role' });
    expectRequiredFields(dialog, { required: ['Role'] });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Link login' }));
    dialog = await screen.findByRole('dialog', { name: 'Link a login' });
    // Sam has a work email, so a new account can fall back on it.
    expectRequiredFields(dialog, { required: [], optional: ['Sign-in email'] });
    await user.click(within(dialog).getByRole('radio', { name: /Link to an existing login/ }));
    expectRequiredFields(dialog, { required: ['Email of their existing login'] });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Invite to sign in' }));
    dialog = await screen.findByRole('dialog', { name: 'Invite to sign in' });
    expectRequiredFields(dialog, { required: [], optional: ['Sign-in email'] });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await openActions(user, 'Sam Staff');
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    dialog = await screen.findByRole('dialog', { name: 'Deactivate staff member?' });
    await user.click(within(dialog).getByRole('radio', { name: /Mark as left/ }));
    expectRequiredFields(dialog, { required: [], optional: ['Leaving date'] });
  });
});
