import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { findRowAction, rowAction, rowActionNames } from '@/test/rowActions';
import { server } from '@/test/server';

import { ACCOUNTS_JOB, entry, ME, SAM, WEEK } from '../test/fixtures';
import { callsTo, createBackend, timeHandlers } from '../test/handlers';
import { JobTimeCard } from './JobTimeCard';

const STAFF = ['organization.read', 'time.log'];
const APPROVER = ['organization.read', 'member.read', 'time.read_all', 'timesheet.approve'];

const mine = entry({ id: 'mine-open', user_id: ME, entry_date: '2026-10-12', minutes: 60 });
const approved = entry({
  id: 'sam-approved',
  user_id: SAM,
  entry_date: '2026-10-13',
  minutes: 90,
  status: 'approved',
});
const submitted = entry({
  id: 'sam-submitted',
  user_id: SAM,
  entry_date: '2026-10-07',
  minutes: 30,
  weekStart: '2026-10-05',
  status: 'submitted',
});
const billed = entry({
  id: 'sam-billed',
  user_id: SAM,
  entry_date: '2026-09-30',
  weekStart: '2026-09-28',
  minutes: 45,
  status: 'approved',
  billing_status: 'billed',
});
const otherJob = entry({
  id: 'other-job',
  user_id: ME,
  entry_date: '2026-10-12',
  minutes: 15,
  job: null,
});

function setup(permissions: string[], entries = [mine, approved, submitted, billed, otherJob]) {
  const backend = createBackend({ entries: entries.map((item) => ({ ...item })) });
  server.use(...timeHandlers(backend));
  renderInOrg(<JobTimeCard jobId={ACCOUNTS_JOB.id} jobNumber={ACCOUNTS_JOB.number} />, {
    context: contextWith(permissions),
  });
  return backend;
}

describe('JobTimeCard', () => {
  it("lists the job's time only, with its timesheet and billing status", async () => {
    const backend = setup(OWNER_PERMISSIONS);

    const table = await screen.findByRole('table', { name: 'Time on J00001' });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(5));
    expect(callsTo(backend, 'GET', '/time-entries')[0]?.query.get('job_id')).toBe(ACCOUNTS_JOB.id);
    expect(callsTo(backend, 'GET', '/time-entries')[0]?.query.get('user_id')).toBe('all');
    expect(within(table).queryByText('0:15')).not.toBeInTheDocument();
    expect(table).toHaveTextContent('Approved');
    expect(table).toHaveTextContent('Billed');
  });

  it('deletes an open entry after asking', async () => {
    const user = userEvent.setup();
    const backend = setup(OWNER_PERMISSIONS);

    await user.click(
      await findRowAction(/^Actions for the entry of .* on 12\/10\/2026/, 'Delete entry'),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Delete this time entry?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete entry' }));

    await waitFor(() =>
      expect(callsTo(backend, 'DELETE', '/time-entries/mine-open')).toHaveLength(1),
    );
    expect(await screen.findByText('Time entry deleted')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('group', { name: /^Actions for the entry of .* on 12\/10\/2026/ }),
      ).toBeNull(),
    );
  });

  it('revokes the approval of approved time, then lets it be deleted', async () => {
    const user = userEvent.setup();
    const backend = setup(OWNER_PERMISSIONS);
    const row = /^Actions for the entry of .* on 13\/10\/2026/;

    // Locked: the delete is there but disabled, and says what to do first.
    await screen.findByRole('group', { name: row });
    expect(rowAction(row, /^Delete entry \(revoke approval first\)/)).toBeDisabled();

    await user.click(rowAction(row, 'Revoke approval'));
    const dialog = await screen.findByRole('dialog', { name: 'Revoke approval of this week?' });
    await user.click(within(dialog).getByRole('button', { name: 'Revoke approval' }));

    await waitFor(() =>
      expect(callsTo(backend, 'POST', `/timesheets/${approved.timesheet_id}/reopen`)).toHaveLength(
        1,
      ),
    );
    expect(await screen.findByText('Approval revoked')).toBeInTheDocument();
    await waitFor(() => expect(rowAction(row, 'Delete entry')).toBeEnabled());
    expect(rowActionNames(row)).toEqual(['Edit entry', 'Delete entry']);

    await user.click(rowAction(row, 'Delete entry'));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this time entry?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete entry' }));
    await waitFor(() =>
      expect(callsTo(backend, 'DELETE', '/time-entries/sam-approved')).toHaveLength(1),
    );
  });

  it('shows the reason when the week cannot be reopened because some of it is billed', async () => {
    const user = userEvent.setup();
    setup(OWNER_PERMISSIONS, [
      approved,
      entry({
        id: 'sam-billed-same-week',
        user_id: SAM,
        entry_date: '2026-10-14',
        minutes: 15,
        status: 'approved',
        billing_status: 'billed',
      }),
    ]);

    await user.click(
      await findRowAction(/^Actions for the entry of .* on 13\/10\/2026/, 'Revoke approval'),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Revoke approval of this week?' });
    await user.click(within(dialog).getByRole('button', { name: 'Revoke approval' }));
    expect(
      await within(dialog).findByText('Some of this time has been billed.'),
    ).toBeInTheDocument();
  });

  it('says why a submitted or billed entry cannot be deleted and offers no revoke for them', async () => {
    setup(OWNER_PERMISSIONS);

    await screen.findByRole('group', { name: /^Actions for the entry of .* on 07\/10\/2026/ });
    const submittedActions = rowActionNames(/^Actions for the entry of .* on 07\/10\/2026/);
    expect(submittedActions).toEqual(['Delete entry (the timesheet is submitted)']);
    expect(rowActionNames(/^Actions for the entry of .* on 30\/09\/2026/)).toEqual([
      'Delete entry (billed time is locked)',
    ]);
  });

  it('shows someone with only time.log their own time, without revoke or other people’s entries', async () => {
    const backend = setup(STAFF);

    await screen.findByRole('group', { name: /^Actions for the entry of .* on 12\/10\/2026/ });
    expect(callsTo(backend, 'GET', '/time-entries')[0]?.query.get('user_id')).toBe('me');
    expect(rowActionNames(/^Actions for the entry of .* on 12\/10\/2026/)).toEqual([
      'Edit entry',
      'Delete entry',
    ]);
    expect(screen.queryByRole('button', { name: 'Revoke approval' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Person' })).not.toBeInTheDocument();
  });

  it('lets an approver revoke approval but not delete or edit other people’s time', async () => {
    setup(APPROVER);

    await screen.findByRole('group', { name: /^Actions for the entry of .* on 13\/10\/2026/ });
    expect(rowActionNames(/^Actions for the entry of .* on 13\/10\/2026/)).toEqual([
      'Revoke approval',
    ]);
    // Open time of their own: they hold no time.log, so nothing is offered.
    expect(
      screen.queryByRole('group', { name: /^Actions for the entry of .* on 12\/10\/2026/ }),
    ).toBeNull();
  });

  it('does not offer to revoke the approval of one’s own week without organization.update', async () => {
    setup(
      [...APPROVER, 'time.log'],
      [
        entry({
          id: 'my-approved',
          user_id: ME,
          entry_date: WEEK,
          minutes: 60,
          status: 'approved',
        }),
      ],
    );

    await screen.findByRole('group', { name: /^Actions for the entry of .* on 12\/10\/2026/ });
    expect(rowActionNames(/^Actions for the entry of .* on 12\/10\/2026/)).toEqual([
      'Delete entry (approved time is locked)',
    ]);
  });

  it('is not drawn for someone who may see no time', () => {
    setup(['organization.read']);
    expect(screen.queryByRole('table', { name: 'Time on J00001' })).not.toBeInTheDocument();
    expect(screen.queryByText('Time')).not.toBeInTheDocument();
  });
});
