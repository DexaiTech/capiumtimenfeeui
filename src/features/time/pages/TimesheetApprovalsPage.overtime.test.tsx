import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { contextWith, ownerContext } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { entry, LEE, ME, overtimeOf, SAM, sheetId, WEEK } from '../test/fixtures';
import { callsTo, createBackend, timeHandlers, type Sheet } from '../test/handlers';
import TimesheetApprovalsPage from './TimesheetApprovalsPage';

const withOvertime = {
  ...ownerContext,
  organization: { ...ownerContext.organization, overtime_enabled: true },
};

const submitted = (userId: string): Sheet => ({
  id: sheetId(userId, WEEK),
  user_id: userId,
  week_start: WEEK,
  status: 'submitted',
  submitted_at: '2026-10-16T16:00:00Z',
  decided_at: null,
  decision_note: null,
});

/** Sam's week: Tuesday's 3:00 has 1:00 of overtime waiting; Lee's week has none. */
function setup(context = withOvertime, people: string[] = [SAM, LEE]) {
  const late = {
    ...entry({ id: 'e-sam-tue', entry_date: '2026-10-13', minutes: 180, user_id: SAM }),
    timesheet_status: 'submitted' as const,
    is_overtime: true,
  };
  const ordinary = entry({ id: 'e-sam-mon', entry_date: '2026-10-12', minutes: 120, user_id: SAM });
  const lees = entry({ id: 'e-lee-mon', entry_date: '2026-10-12', minutes: 240, user_id: LEE });
  const mine = {
    ...entry({ id: 'e-me-tue', entry_date: '2026-10-13', minutes: 120, user_id: ME }),
    is_overtime: true,
  };
  const backend = createBackend({
    entries: [ordinary, late, lees, mine],
    sheets: people.map(submitted),
    overtime: [overtimeOf(late, 60), overtimeOf(mine, 30)],
  });
  server.use(...timeHandlers(backend));
  renderInOrg(<TimesheetApprovalsPage />, { route: '/acme/time/approvals', context });
  return backend;
}

async function openSamsEntries() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Entries of Sam Staff, week of 12/10/2026' }),
  );
  const table = await screen.findByRole('table', { name: 'Entries of Sam Staff' });
  return { user, table };
}

const rowOf = (table: HTMLElement, text: string) => {
  const row = within(table)
    .getAllByRole('row')
    .find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`No row with ${text}`);
  return row;
};

describe('TimesheetApprovalsPage: overtime (APT81)', () => {
  it('marks the sheet with overtime waiting for a decision', async () => {
    setup();
    await screen.findByRole('button', { name: /Approve the timesheet of Sam Staff/ });
    const markers = await screen.findAllByText('1 overtime pending');
    expect(markers).toHaveLength(1);
    expect(markers[0]?.parentElement).toHaveTextContent('Sam Staff');
  });

  it('marks the overtime entry, with its hours and status, in the entries of the sheet', async () => {
    setup();
    const { table } = await openSamsEntries();
    expect(within(table).getByRole('columnheader', { name: 'Overtime' })).toBeInTheDocument();
    const late = await waitFor(() => {
      const row = rowOf(table, '3:00');
      expect(row).toHaveTextContent('Pending');
      return row;
    });
    expect(late).toHaveTextContent('Overtime');
    expect(late).toHaveTextContent('1:00');
    expect(rowOf(table, '2:00')).not.toHaveTextContent('Overtime');
  });

  it('approves pending overtime', async () => {
    const backend = setup();
    const { user, table } = await openSamsEntries();
    await user.click(
      await within(table).findByRole('button', {
        name: 'Approve the overtime of 1:00 on 13/10/2026',
      }),
    );

    await waitFor(() =>
      expect(callsTo(backend, 'POST', '/overtime/ot-e-sam-tue/approve')).toHaveLength(1),
    );
    expect(await screen.findByText('Overtime approved')).toBeInTheDocument();
    await waitFor(() => expect(rowOf(table, '3:00')).toHaveTextContent('Approved'));
    expect(within(table).queryByRole('button', { name: /^Approve the overtime/ })).toBeNull();
  });

  it('rejects pending overtime with a required note', async () => {
    const backend = setup();
    const { user, table } = await openSamsEntries();
    await user.click(
      await within(table).findByRole('button', {
        name: 'Reject the overtime of 1:00 on 13/10/2026',
      }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Reject this overtime' });
    await user.click(within(dialog).getByRole('button', { name: 'Reject overtime' }));
    expect(
      await within(dialog).findByText('Enter a note for rejecting the overtime'),
    ).toBeInTheDocument();
    expect(callsTo(backend, 'POST', '/overtime/ot-e-sam-tue/reject')).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/^Note/), 'Not agreed in advance');
    await user.click(within(dialog).getByRole('button', { name: 'Reject overtime' }));

    await waitFor(() =>
      expect(callsTo(backend, 'POST', '/overtime/ot-e-sam-tue/reject')).toHaveLength(1),
    );
    expect(callsTo(backend, 'POST', '/overtime/ot-e-sam-tue/reject')[0]?.body).toEqual({
      note: 'Not agreed in advance',
    });
    expect(await screen.findByText('Overtime rejected')).toBeInTheDocument();
    await waitFor(() => expect(rowOf(table, '3:00')).toHaveTextContent('Rejected'));
    expect(rowOf(table, '3:00')).toHaveTextContent('Not agreed in advance');
  });

  it('lets nobody decide on their own overtime unless they may change the practice', async () => {
    setup(contextWith(['timesheet.approve', 'time.read_all'], withOvertime), [ME]);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Entries of Ada Lovelace, week of 12/10/2026' }),
    );
    const table = await screen.findByRole('table', { name: 'Entries of Ada Lovelace' });
    await waitFor(() => expect(rowOf(table, '2:00')).toHaveTextContent('Pending'));
    expect(within(table).queryByRole('button', { name: /the overtime of/ })).toBeNull();
  });

  it('shows no overtime and asks nothing about it while the practice has overtime off', async () => {
    const backend = setup(ownerContext);
    const { table } = await openSamsEntries();
    await within(table).findByText('3:00');
    expect(within(table).queryByRole('columnheader', { name: 'Overtime' })).toBeNull();
    expect(screen.queryByText(/overtime pending/)).toBeNull();
    expect(callsTo(backend, 'GET', '/overtime')).toHaveLength(0);
  });

  it('is not shown to a role that cannot approve timesheets', async () => {
    const backend = setup(contextWith(['time.log'], withOvertime));
    expect(await screen.findByText(/approving timesheets/)).toBeInTheDocument();
    expect(callsTo(backend, 'GET', '/overtime')).toHaveLength(0);
  });
});
