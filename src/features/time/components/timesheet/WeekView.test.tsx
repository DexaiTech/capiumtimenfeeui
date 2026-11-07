import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { rowAction, rowActionNames } from '@/test/rowActions';
import { server } from '@/test/server';
import { addDays } from '@/utils/dates';

import { useRangeEntries, useWeek } from '../../api';
import { ACME, entry, VAT_JOB, weekEntries, WEEK } from '../../test/fixtures';
import { callsTo, createBackend, timeHandlers } from '../../test/handlers';
import type { TimeEntry } from '../../types';
import { WeekView } from './WeekView';

/** My Timesheet's week: the grid and its entries, read again after every change. */
function Week() {
  const week = useWeek('me', WEEK);
  const entries = useRangeEntries('me', WEEK, addDays(WEEK, 6));
  if (!week.data || !entries.data) return <p>Loading the week</p>;
  return <WeekView grid={week.data} entries={entries.data} canRecord onOpenDay={() => undefined} />;
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

describe('WeekView: a row needs a client and a job (APT64)', () => {
  it('does not add a row without a client and a job, and saves the hours of one that has them', async () => {
    const backend = setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Add row' }));
    const panel = await screen.findByRole('region', { name: 'Add a row' });
    expect(panel).not.toHaveTextContent('internal time)');

    // The tester's row: no client, no job, no activity.
    await user.click(within(panel).getByRole('button', { name: 'Add row' }));
    expect(
      await within(panel).findByText('Choose a client and a job for the row.'),
    ).toBeInTheDocument();
    await user.click(within(panel).getByRole('combobox', { name: 'Client' }));
    await user.click(await screen.findByRole('option', { name: /Acme Ltd/ }));
    await user.click(within(panel).getByRole('button', { name: 'Add row' }));
    expect(await within(panel).findByText('Choose a job for the row.')).toBeInTheDocument();
    expect(screen.queryByText('New row')).not.toBeInTheDocument();

    await user.click(within(panel).getByRole('combobox', { name: 'Job' }));
    await user.click(await screen.findByRole('option', { name: /J00002 · VAT returns/ }));
    await user.click(within(panel).getByRole('button', { name: 'Add row' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Add a row' })).not.toBeInTheDocument(),
    );
    const cell = await screen.findByRole('textbox', {
      name: 'Acme Ltd · J00002 VAT returns, Wednesday 14/10/2026',
    });
    await user.type(cell, '10:00');
    await user.tab();

    await waitFor(
      () =>
        expect(callsTo(backend, 'POST', '/time-entries')[0]?.body).toMatchObject({
          entry_date: '2026-10-14',
          minutes: 600,
          client_id: ACME.id,
          job_id: VAT_JOB.id,
        }),
      { timeout: 3000 },
    );
  });

  it('keeps an older row without a client or job, but its hours change only through the entry', async () => {
    setup([
      ...weekEntries(),
      entry({
        id: 'old',
        entry_date: '2026-10-14',
        minutes: 600,
        job: null,
        client: null,
        activity: null,
        is_billable: false,
      }),
    ]);

    expect(
      await screen.findByLabelText('No client, Wednesday 14/10/2026: 10:00'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'No client, Wednesday 14/10/2026' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'No client, Thursday 15/10/2026' }),
    ).not.toBeInTheDocument();
    // A row with a client and a job stays editable.
    expect(
      screen.getByRole('textbox', {
        name: 'Acme Ltd · J00001 Year-end accounts 2026 · Preparation, Wednesday 14/10/2026',
      }),
    ).toBeInTheDocument();
  });

  it('marks an older row as needing a client and a job, and opens its entry to add them', async () => {
    const user = userEvent.setup();
    setup([
      ...weekEntries(),
      entry({
        id: 'old',
        entry_date: '2026-10-14',
        minutes: 600,
        job: null,
        client: null,
        activity: null,
        is_billable: false,
      }),
    ]);

    const needs = await screen.findByRole('button', { name: 'Needs a client and job' });
    expect(screen.getAllByRole('button', { name: 'Needs a client and job' })).toHaveLength(1);
    await user.click(needs);
    const form = await screen.findByRole('region', { name: 'Edit time entry' });
    expect(within(form).getByLabelText(/^Time/)).toHaveValue('10:00');
    expect(within(form).getByRole('combobox', { name: 'Job' })).toBeInTheDocument();
  });
});

describe('WeekView: rows that differ only by task (TIME-01)', () => {
  it('shows the task as its own row and saves a cell to the entry of that row', async () => {
    const backend = setup([
      ...weekEntries(),
      {
        ...entry({ id: 'e-task', entry_date: '2026-10-12', minutes: 60 }),
        task_id: 't-1',
        task_name: 'Draft accounts',
      },
    ]);
    const user = userEvent.setup();
    const taskRow = 'Acme Ltd · J00001 Year-end accounts 2026 · Draft accounts · Preparation';

    const monday = await screen.findByRole('textbox', { name: `${taskRow}, Monday 12/10/2026` });
    expect(monday).toHaveValue('1:00');
    expect(screen.getByRole('textbox', { name: MONDAY_CELL })).toHaveValue('4:00');

    await user.clear(monday);
    await user.type(monday, '2:00');
    await user.tab();
    await waitFor(
      () =>
        expect(callsTo(backend, 'PATCH', '/time-entries/e-task')[0]?.body).toMatchObject({
          minutes: 120,
        }),
      { timeout: 3000 },
    );
    expect(callsTo(backend, 'PATCH', '/time-entries/e-mon-1')).toHaveLength(0);

    const tuesday = screen.getByRole('textbox', { name: `${taskRow}, Tuesday 13/10/2026` });
    await user.type(tuesday, '0:30');
    await user.tab();
    await waitFor(
      () =>
        expect(callsTo(backend, 'POST', '/time-entries')[0]?.body).toMatchObject({
          entry_date: '2026-10-13',
          minutes: 30,
          task_id: 't-1',
        }),
      { timeout: 3000 },
    );
  });
});
