import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ACME, entry } from '@/features/time/test/fixtures';
import { callsTo, createBackend, timeHandlers } from '@/features/time/test/handlers';
import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { findRowAction, rowAction, rowActionNames } from '@/test/rowActions';
import { server } from '@/test/server';

import { TimeTab } from '../workspace/tabs/TimeTab';

const OPEN = /^Actions for the entry of 1:00 on 12\/10\/2026/;
const SUBMITTED = /^Actions for the entry of 0:30 on 07\/10\/2026/;

function setup(permissions: string[] = OWNER_PERMISSIONS) {
  // Both on a job of the client, so the tab lists them.
  const backend = createBackend({
    entries: [
      entry({ id: 'open', entry_date: '2026-10-12', minutes: 60 }),
      entry({
        id: 'sent',
        entry_date: '2026-10-07',
        weekStart: '2026-10-05',
        minutes: 30,
        status: 'submitted',
      }),
    ],
  });
  server.use(...timeHandlers(backend));
  renderInOrg(<TimeTab clientId={ACME.id} clientName={ACME.name} overview={undefined} />, {
    context: contextWith(permissions),
  });
  return backend;
}

describe('TimeTab: edit and delete time', () => {
  it('edits an entry in the time panel and shows the new time', async () => {
    const user = userEvent.setup();
    const backend = setup();

    await user.click(await findRowAction(OPEN, 'Edit entry'));
    const form = await screen.findByRole('region', { name: 'Edit time entry' });
    const time = within(form).getByLabelText(/^Time/);
    await user.clear(time);
    await user.type(time, '1:30');
    await user.click(within(form).getByRole('button', { name: 'Save entry' }));

    await waitFor(() =>
      expect(callsTo(backend, 'PATCH', '/time-entries/open')[0]?.body).toEqual({ minutes: 90 }),
    );
    // The tab asks for the list again, so the change is there without a reload.
    expect(await screen.findByRole('row', { name: /1:30/ })).toBeInTheDocument();
  });

  it('deletes an entry after asking', async () => {
    const user = userEvent.setup();
    const backend = setup();

    await user.click(await findRowAction(OPEN, 'Delete entry'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this time entry?' });
    expect(dialog).toHaveTextContent('1:00 on 12/10/2026 will be removed for good.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete entry' }));

    await waitFor(() => expect(callsTo(backend, 'DELETE', '/time-entries/open')).toHaveLength(1));
    expect(await screen.findByText('Time entry deleted')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('group', { name: OPEN })).toBeNull());
    expect(screen.getByRole('group', { name: SUBMITTED })).toBeInTheDocument();
  });

  it('says why submitted time cannot be deleted, and opens it read-only', async () => {
    const user = userEvent.setup();
    const backend = setup();

    await screen.findByRole('group', { name: SUBMITTED });
    expect(rowActionNames(SUBMITTED)).toEqual([
      'View entry',
      'Delete entry (the timesheet is submitted)',
    ]);
    expect(rowAction(SUBMITTED, /^Delete entry/)).toBeDisabled();

    await user.click(rowAction(SUBMITTED, 'View entry'));
    const form = await screen.findByRole('region', { name: 'Time entry' });
    expect(within(form).getByText('This time is locked')).toBeInTheDocument();
    expect(within(form).queryByRole('button', { name: 'Save entry' })).not.toBeInTheDocument();
    expect(callsTo(backend, 'DELETE', '/time-entries/sent')).toHaveLength(0);
  });

  it('offers nothing to change to someone who may only read the time', async () => {
    setup(['organization.read', 'client.read', 'time.read_all']);
    await screen.findByRole('row', { name: /1:00/ });
    expect(screen.queryByRole('group', { name: OPEN })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete entry/ })).not.toBeInTheDocument();
  });
});
