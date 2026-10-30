import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { rowAction, rowActionNames } from '@/test/rowActions';
import { server } from '@/test/server';
import { addDays } from '@/utils/dates';

import { useRangeEntries, useWeek } from '../../api';
import { entry, weekEntries, WEEK } from '../../test/fixtures';
import { callsTo, createBackend, timeHandlers } from '../../test/handlers';
import type { TimeEntry } from '../../types';
import { WeekView } from './WeekView';

/** My Timesheet's week: the grid and its entries, read again after every change. */
function Week() {
  const week = useWeek('me', WEEK);
  const entries = useRangeEntries('me', WEEK, addDays(WEEK, 6));
  if (!week.data || !entries.data) return <p>Loading the week</p>;
  return (
    <WeekView grid={week.data} entries={entries.data} canRecord onOpenDay={() => undefined} />
  );
}

function setup(entries: TimeEntry[] = weekEntries()) {
  const backend = createBackend({ entries });
  server.use(...timeHandlers(backend));
  renderInOrg(<Week />);
  return backend;
}

const MONDAY_CELL = 'Acme Ltd · J00001 Year-end accounts 2026 · Preparation, Monday 12/10/2026';
const ENTRY = /^Actions for the entry of 4:00 on 12\/10\/2026/;

async function openMonday() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: `Details of ${MONDAY_CELL}` }));
  const panel = await screen.findByRole('region', { name: MONDAY_CELL });
  return { user, panel };
}

describe('WeekView: the entries of a cell', () => {
  it('lists the entry of a cell with its description, and edits it', async () => {
    const backend = setup();
    const { user, panel } = await openMonday();
    expect(panel).toHaveTextContent('Trial balance');
    expect(rowActionNames(ENTRY)).toEqual(['Edit entry', 'Delete entry']);

    await user.click(rowAction(ENTRY, 'Edit entry'));
    const form = await screen.findByRole('region', { name: 'Edit time entry' });
    const description = within(form).getByLabelText(/^Description/);
    await user.clear(description);
    await user.type(description, 'Trial balance, checked');
    await user.click(within(form).getByRole('button', { name: 'Save entry' }));

    await waitFor(() =>
      expect(callsTo(backend, 'PATCH', '/time-entries/e-mon-1')[0]?.body).toEqual({
        description: 'Trial balance, checked',
      }),
    );
    // The week is read again, so the list shows the change.
    expect(await within(panel).findByText('Trial balance, checked')).toBeInTheDocument();
  });

  it('deletes an entry after asking, and the week totals follow', async () => {
    const backend = setup();
    const { user, panel } = await openMonday();

    await user.click(rowAction(ENTRY, 'Delete entry'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this time entry?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete entry' }));

    await waitFor(() =>
      expect(callsTo(backend, 'DELETE', '/time-entries/e-mon-1')).toHaveLength(1),
    );
    expect(await screen.findByText('Time entry deleted')).toBeInTheDocument();
    expect(await within(panel).findByText('No time left here.')).toBeInTheDocument();
    // The grid is read again: Monday keeps only the other job's 3:30.
    const grid = screen.getByRole('table', { name: /^Time recorded from 12\/10\/2026/ });
    const total = () => within(grid).getByRole('row', { name: /^Total/ });
    await waitFor(() => expect(total()).toHaveTextContent('3:30'));
  });

  it('lists every entry of a cell that holds several', async () => {
    setup([
      ...weekEntries(),
      entry({ id: 'e-mon-3', entry_date: '2026-10-12', minutes: 30, description: 'Client call' }),
    ]);
    const { panel } = await openMonday();

    const list = within(panel).getByRole('list', { name: 'Time entries' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('aria-label')).sort()).toEqual([
      '0:30 on 12/10/2026',
      '4:00 on 12/10/2026',
    ]);
    expect(panel).toHaveTextContent('Client call');
    expect(panel).toHaveTextContent('2 entries, 4:30');
    const call = /^Actions for the entry of 0:30 on 12\/10\/2026/;
    expect(rowActionNames(call)).toEqual(['Edit entry', 'Delete entry']);
  });

  it('says why the time of a submitted week cannot be changed', async () => {
    setup(
      weekEntries().map((item) => ({
        ...item,
        timesheet_status: 'submitted' as const,
        is_locked: true,
      })),
    );
    const { panel } = await openMonday();

    expect(rowActionNames(ENTRY)).toEqual([
      'View entry',
      'Delete entry (the timesheet is submitted)',
    ]);
    expect(rowAction(ENTRY, /^Delete entry/)).toBeDisabled();
    expect(panel).toHaveTextContent('Locked: the timesheet is submitted.');
  });
});
