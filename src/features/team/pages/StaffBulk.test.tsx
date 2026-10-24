import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields, isMarkedRequired } from '@/test/requiredFields';
import { fail, ok, server } from '@/test/server';

import { sam, seniorGrade } from '../test/fixtures';
import { teamHandlers } from '../test/handlers';
import type { StaffBulkRequest } from '../types';
import StaffMembersPage from './StaffMembersPage';

const EDIT_ONLY = ['organization.read', 'member.read', 'member.update'];
const BAR = 'Bulk actions for staff';

/** Serves the list and records every bulk call; `refuse` turns it into a 409. */
function setup(
  permissions = OWNER_PERMISSIONS,
  refuse?: (body: StaffBulkRequest) => Response | null,
) {
  const calls: StaffBulkRequest[] = [];
  server.use(
    ...teamHandlers(),
    http.post(orgApiPath('/staff/bulk'), async ({ request }) => {
      const body = (await request.json()) as StaffBulkRequest;
      calls.push(body);
      const refusal = refuse?.(body);
      if (refusal) return refusal;
      return ok({
        action: body.action,
        affected: body.staff_ids.length,
        changed: body.staff_ids.length,
      });
    }),
  );
  renderInOrg(<StaffMembersPage />, { context: contextWith(permissions) });
  return calls;
}

async function tick(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  for (const name of names) {
    const row = await screen.findByRole('row', { name: new RegExp(`^Select ${name}`) });
    await user.click(within(row).getByRole('checkbox', { name: `Select ${name}` }));
  }
  return screen.findByRole('region', { name: BAR });
}

describe('bulk actions on the staff list', () => {
  it('shows the bar with the count, and Clear unticks the rows', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('row', { name: /^Select Sam Staff/ });
    expect(screen.queryByRole('region', { name: BAR })).toBeNull();
    const bar = await tick(user, 'Sam Staff', 'Grace Hopper');
    expect(within(bar).getByText('2 selected')).toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('region', { name: BAR })).toBeNull();
  });

  it('sets the grade of the selected people in one call and clears the selection', async () => {
    const user = userEvent.setup();
    const calls = setup();
    const bar = await tick(user, 'Sam Staff', 'Grace Hopper');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set grade' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set the grade of 2 people' });
    expect(within(dialog).getByRole('button', { name: 'Update 2 people' })).toBeDisabled();
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'New grade' }), 'Senior');
    await user.click(within(dialog).getByRole('button', { name: 'Update 2 people' }));

    expect(await screen.findByText('2 people updated')).toBeInTheDocument();
    expect(calls).toEqual([
      { staff_ids: ['staff-grace', sam.id], action: 'set_grade', value: seniorGrade.id },
    ]);
    await waitFor(() => expect(screen.queryByRole('region', { name: BAR })).toBeNull());
  });

  it('clears the approver and reactivates', async () => {
    const user = userEvent.setup();
    const calls = setup();
    let bar = await tick(user, 'Sam Staff');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Clear approver' }));
    let dialog = await screen.findByRole('dialog', { name: 'Clear the approver of 1 person' });
    await user.click(within(dialog).getByRole('button', { name: 'Clear 1 person' }));
    await waitFor(() => expect(calls).toHaveLength(1));

    bar = await tick(user, 'Sam Staff');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Reactivate' }));
    dialog = await screen.findByRole('dialog', { name: 'Reactivate 1 person' });
    await user.click(within(dialog).getByRole('button', { name: 'Reactivate 1 person' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls).toEqual([
      { staff_ids: [sam.id], action: 'clear_approver' },
      { staff_ids: [sam.id], action: 'reactivate' },
    ]);
  });

  it('deactivates, or marks as left from a date', async () => {
    const user = userEvent.setup();
    const calls = setup();
    let bar = await tick(user, 'Sam Staff');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Deactivate…' }));
    let dialog = await screen.findByRole('dialog', { name: 'Deactivate 1 person' });
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate 1 person' }));
    await waitFor(() => expect(calls).toHaveLength(1));

    bar = await tick(user, 'Sam Staff');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Deactivate…' }));
    dialog = await screen.findByRole('dialog', { name: 'Deactivate 1 person' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'What happens to them' }),
      'left',
    );
    await user.type(within(dialog).getByLabelText('Leaving date'), '2026-12-31');
    await user.click(within(dialog).getByRole('button', { name: 'Mark 1 person as left' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls).toEqual([
      { staff_ids: [sam.id], action: 'deactivate', value: 'inactive' },
      { staff_ids: [sam.id], action: 'deactivate', value: 'left', leaving_date: '2026-12-31' },
    ]);
  });

  it('deletes after a confirmation and names every person the API refuses', async () => {
    const user = userEvent.setup();
    const calls = setup(OWNER_PERMISSIONS, () =>
      fail(409, 'BULK_REFUSED', '1 of 2 could not be changed; nothing was changed.', {
        details: [
          {
            staff_id: sam.id,
            number: 'S002',
            name: 'Sam Staff',
            error_code: 'STAFF_IN_USE',
            reason: 'Time and expenses refer to this person.',
          },
        ],
      }),
    );
    const bar = await tick(user, 'Sam Staff', 'Grace Hopper');
    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 people?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete 2 people' }));

    expect(await within(dialog).findByText(/nothing was changed/)).toBeInTheDocument();
    expect(within(dialog).getByText('S002')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Time and expenses refer to this person\./),
    ).toBeInTheDocument();
    expect(calls).toEqual([{ staff_ids: ['staff-grace', sam.id], action: 'delete' }]);
    // The selection stays so the person can adjust it.
    expect(screen.getByRole('region', { name: BAR })).toBeInTheDocument();
  });

  it('offers only what the role may do', async () => {
    const user = userEvent.setup();
    setup(EDIT_ONLY);
    const bar = await tick(user, 'Sam Staff');
    expect(within(bar).queryByRole('button', { name: 'Delete' })).toBeNull();
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    const items = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(items).toEqual(['Set grade', 'Set approver', 'Clear approver', 'Reactivate']);
  });

  it('has no bar for a role that may neither edit nor remove', async () => {
    const user = userEvent.setup();
    setup(['organization.read', 'member.read']);
    await screen.findByRole('row', { name: /^Select Sam Staff/ });
    await user.click(screen.getByRole('checkbox', { name: 'Select Sam Staff' }));
    expect(screen.queryByRole('region', { name: BAR })).toBeNull();
  });
});

describe('mandatory fields of the bulk dialogs', () => {
  it('marks the new grade and the new approver', async () => {
    const user = userEvent.setup();
    setup();
    const bar = await tick(user, 'Sam Staff');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set grade' }));
    let dialog = await screen.findByRole('dialog', { name: /Set the grade of/ });
    expectRequiredFields(dialog, { required: ['New grade'] });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set approver' }));
    dialog = await screen.findByRole('dialog', { name: /Set the approver of/ });
    expect(isMarkedRequired(within(dialog).getByRole('combobox', { name: 'New approver' }))).toBe(
      true,
    );
  });
});
