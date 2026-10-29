import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { entry, SAM, WEEK } from '../../test/fixtures';
import { callsTo, createBackend, timeHandlers } from '../../test/handlers';
import type { TeamRow } from '../../utils/team';
import { PersonSheetDrawer } from './PersonSheetDrawer';

const ROW: TeamRow = {
  userId: SAM,
  name: 'Sam Staff',
  hasLogin: true,
  manager: null,
  status: 'approved',
  timesheetId: null,
  expected: 2250,
  logged: 360,
  missingDays: [],
  lastRemindedAt: null,
};

function setup(
  permissions: string[] = OWNER_PERMISSIONS,
  billing: 'unbilled' | 'billed' = 'unbilled',
) {
  const backend = createBackend({
    entries: [
      entry({
        id: 'sam-1',
        user_id: SAM,
        entry_date: WEEK,
        minutes: 360,
        status: 'approved',
        billing_status: billing,
      }),
    ],
  });
  server.use(...timeHandlers(backend));
  renderInOrg(
    <PersonSheetDrawer person={ROW} weekStart={WEEK} staff={undefined} onClose={() => {}} />,
    {
      context: contextWith(permissions),
    },
  );
  return backend;
}

describe('PersonSheetDrawer: fixing approved time', () => {
  it('revokes the approval of the week so its time can be changed again', async () => {
    const user = userEvent.setup();
    const backend = setup();

    await user.click(await screen.findByRole('button', { name: 'Revoke approval' }));
    const dialog = await screen.findByRole('dialog', { name: 'Revoke approval of this week?' });
    await user.click(within(dialog).getByRole('button', { name: 'Revoke approval' }));

    await waitFor(() =>
      expect(
        callsTo(backend, 'POST', `/timesheets/${backend.sheets[0]?.id ?? ''}/reopen`),
      ).toHaveLength(1),
    );
    expect(await screen.findByText('Approval revoked')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Revoke approval' })).not.toBeInTheDocument(),
    );
  });

  it('says why the week cannot be revoked when some of its time is billed', async () => {
    const user = userEvent.setup();
    setup(OWNER_PERMISSIONS, 'billed');

    await user.click(await screen.findByRole('button', { name: 'Revoke approval' }));
    const dialog = await screen.findByRole('dialog', { name: 'Revoke approval of this week?' });
    await user.click(within(dialog).getByRole('button', { name: 'Revoke approval' }));

    expect(
      await within(dialog).findByText('Some of this time has been billed.'),
    ).toBeInTheDocument();
  });

  it('removes one approved entry with a reason', async () => {
    const user = userEvent.setup();
    const backend = setup();

    await user.click(await screen.findByRole('button', { name: /^Remove the entry of/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this time' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove time' }));
    expect(
      await within(dialog).findByText('Say why the time is being removed'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Reason/), 'Posted to the wrong client');
    await user.click(within(dialog).getByRole('button', { name: 'Remove time' }));

    await waitFor(() =>
      expect(callsTo(backend, 'POST', '/time-entries/sam-1/remove')).toHaveLength(1),
    );
    expect(callsTo(backend, 'POST', '/time-entries/sam-1/remove')[0]?.body).toEqual({
      reason: 'Posted to the wrong client',
    });
    expect(await screen.findByText('Time removed')).toBeInTheDocument();
  });

  it('offers neither action to someone who cannot approve or manage time', async () => {
    setup(['organization.read', 'time.log']);

    await screen.findByText(/Week of/);
    expect(screen.queryByRole('button', { name: 'Revoke approval' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove the entry of/ })).not.toBeInTheDocument();
  });

  it('does not offer to remove billed time', async () => {
    setup(OWNER_PERMISSIONS, 'billed');

    await screen.findByText(/Week of/);
    expect(screen.queryByRole('button', { name: /^Remove the entry of/ })).not.toBeInTheDocument();
  });
});
