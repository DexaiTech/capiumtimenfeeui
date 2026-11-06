import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ownerContext } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';
import { addDays } from '@/utils/dates';

import { useRangeEntries, useWeek } from '../../api';
import { entry, PREVIOUS_WEEK, runningTimer, weekEntries, WEEK } from '../../test/fixtures';
import { callsTo, createBackend, timeHandlers, type TimeBackend } from '../../test/handlers';
import { CopyEntryDialog } from './CopyEntryDialog';
import { CopyWeekDialog } from './CopyWeekDialog';
import { TimerCard } from './TimerCard';
import { WeekView } from './WeekView';

/**
 * The write paths of My Timesheet besides the entry panel (APT81): the week grid, the timer, copy
 * an entry and copy a week. Each asks "Add overtime hours?" when the API answers 409
 * `OVERTIME_CONFIRMATION_REQUIRED`, sends the same request again with `confirm_overtime: true` on
 * confirm, and saves nothing on Cancel. My week holds 15 hours, my standard hours are 15 a week.
 */
const withOvertime = {
  ...ownerContext,
  organization: { ...ownerContext.organization, overtime_enabled: true },
};

function setup(overrides: Partial<TimeBackend> = {}) {
  const backend = createBackend({ standardMinutes: 900, ...overrides });
  server.use(...timeHandlers(backend));
  return backend;
}

// A grid cell is written through the autosave: allow the dialog more than the default second.
const overtimeDialog = () =>
  screen.findByRole('dialog', { name: 'Add overtime hours?' }, { timeout: 5000 });

function Week() {
  const week = useWeek('me', WEEK);
  const entries = useRangeEntries('me', WEEK, addDays(WEEK, 6));
  if (!week.data || !entries.data) return <p>Loading the week</p>;
  return <WeekView grid={week.data} entries={entries.data} canRecord onOpenDay={() => undefined} />;
}

const WEDNESDAY = 'Acme Ltd · J00001 Year-end accounts 2026 · Preparation, Wednesday 14/10/2026';

async function typeWednesday() {
  const user = userEvent.setup();
  renderInOrg(<Week />, { context: withOvertime });
  const cell = await screen.findByRole('textbox', { name: WEDNESDAY });
  await user.type(cell, '2');
  await user.tab();
  return { user, cell };
}

describe('Week grid: overtime', () => {
  it('asks before a cell adds overtime, and saves it with confirm_overtime', async () => {
    const backend = setup();
    const { user } = await typeWednesday();

    const dialog = await overtimeDialog();
    expect(dialog).toHaveTextContent('2h of these are overtime (standard hours: 15h per week).');
    await user.click(within(dialog).getByRole('button', { name: 'Add overtime' }));

    await waitFor(() => expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(2));
    expect(callsTo(backend, 'POST', '/time-entries')[1]?.body).toMatchObject({
      entry_date: '2026-10-14',
      minutes: 120,
      confirm_overtime: true,
    });
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
    expect(backend.entries).toHaveLength(4);
  });

  it('saves nothing on Cancel and empties the cell again', async () => {
    const backend = setup();
    const { user, cell } = await typeWednesday();

    const dialog = await overtimeDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(cell).toHaveValue(''));
    expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(1);
    expect(backend.entries).toHaveLength(3);
    expect(screen.queryByText('Some changes could not be saved')).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument();
  });

  it('asks when a filled cell grows, and patches it with confirm_overtime', async () => {
    const backend = setup();
    const user = userEvent.setup();
    renderInOrg(<Week />, { context: withOvertime });
    const monday = await screen.findByRole('textbox', {
      name: 'Acme Ltd · J00001 Year-end accounts 2026 · Preparation, Monday 12/10/2026',
    });
    await user.clear(monday);
    await user.type(monday, '5');
    await user.tab();

    const dialog = await overtimeDialog();
    expect(dialog).toHaveTextContent('1h of these are overtime');
    await user.click(within(dialog).getByRole('button', { name: 'Add overtime' }));

    await waitFor(() => expect(callsTo(backend, 'PATCH', '/time-entries/e-mon-1')).toHaveLength(2));
    expect(callsTo(backend, 'PATCH', '/time-entries/e-mon-1')[1]?.body).toEqual({
      minutes: 300,
      confirm_overtime: true,
    });
  });
});

describe('Timer: overtime', () => {
  it('asks before stopping saves overtime, and stops with confirm_overtime', async () => {
    const user = userEvent.setup();
    const backend = setup({ timer: runningTimer() });
    renderInOrg(<TimerCard />, { context: withOvertime });
    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    const stop = await screen.findByRole('dialog', { name: 'Stop the timer' });
    await user.click(within(stop).getByRole('button', { name: 'Stop and save' }));

    const dialog = await overtimeDialog();
    expect(dialog).toHaveTextContent('1h 6m of these are overtime');
    await user.click(within(dialog).getByRole('button', { name: 'Add overtime' }));

    await waitFor(() => expect(callsTo(backend, 'POST', '/timer/stop')).toHaveLength(2));
    expect(callsTo(backend, 'POST', '/timer/stop')[0]?.body).toBeUndefined();
    expect(callsTo(backend, 'POST', '/timer/stop')[1]?.body).toEqual({ confirm_overtime: true });
    expect(await screen.findByText('Timer stopped')).toBeInTheDocument();
    expect(backend.timer).toBeNull();
  });

  it('keeps the timer and saves nothing on Cancel', async () => {
    const user = userEvent.setup();
    const backend = setup({ timer: runningTimer() });
    renderInOrg(<TimerCard />, { context: withOvertime });
    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    const stop = await screen.findByRole('dialog', { name: 'Stop the timer' });
    const description = within(stop).getByLabelText(/^Description/);
    await user.clear(description);
    await user.type(description, 'Bank reconciliation, done');
    await user.click(within(stop).getByRole('button', { name: 'Stop and save' }));

    const dialog = await overtimeDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add overtime hours?' })).not.toBeInTheDocument(),
    );
    expect(callsTo(backend, 'POST', '/timer/stop')).toHaveLength(1);
    expect(callsTo(backend, 'POST', '/timer/stop')[0]?.body).toEqual({
      description: 'Bank reconciliation, done',
    });
    expect(backend.timer).not.toBeNull();
    expect(backend.entries).toHaveLength(3);
    expect(screen.queryByText('Timer stopped')).not.toBeInTheDocument();
  });
});

describe('Copy an entry: overtime', () => {
  it('asks before the copy adds overtime, and copies with confirm_overtime', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const source = backend.entries[0] ?? entry({ entry_date: WEEK, minutes: 240 });
    const onClose = vi.fn();
    renderInOrg(<CopyEntryDialog open entry={source} onClose={onClose} />, {
      context: withOvertime,
    });
    const copy = await screen.findByRole('dialog', { name: 'Copy to another day' });
    await user.click(within(copy).getByRole('button', { name: 'Copy time' }));

    const dialog = await overtimeDialog();
    expect(dialog).toHaveTextContent('4h of these are overtime');
    await user.click(within(dialog).getByRole('button', { name: 'Add overtime' }));

    const path = `/time-entries/${source.id}/copy`;
    await waitFor(() => expect(callsTo(backend, 'POST', path)).toHaveLength(2));
    expect(callsTo(backend, 'POST', path)[1]?.body).toEqual({
      date: '2026-10-13',
      confirm_overtime: true,
    });
    expect(await screen.findByText('Time copied')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('copies nothing on Cancel', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const source = backend.entries[0] ?? entry({ entry_date: WEEK, minutes: 240 });
    const onClose = vi.fn();
    renderInOrg(<CopyEntryDialog open entry={source} onClose={onClose} />, {
      context: withOvertime,
    });
    const copy = await screen.findByRole('dialog', { name: 'Copy to another day' });
    await user.click(within(copy).getByRole('button', { name: 'Copy time' }));
    await user.click(within(await overtimeDialog()).getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add overtime hours?' })).not.toBeInTheDocument(),
    );
    expect(callsTo(backend, 'POST', `/time-entries/${source.id}/copy`)).toHaveLength(1);
    expect(backend.entries).toHaveLength(3);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Copy a week: overtime', () => {
  const previous = () => [
    ...weekEntries(),
    entry({ id: 'p-mon-1', entry_date: PREVIOUS_WEEK, minutes: 300, weekStart: PREVIOUS_WEEK }),
  ];

  it('asks before the copies add overtime, and copies with confirm_overtime', async () => {
    const user = userEvent.setup();
    const backend = setup({ entries: previous() });
    renderInOrg(
      <CopyWeekDialog
        open
        onClose={() => undefined}
        fromWeekStart={PREVIOUS_WEEK}
        toWeekStart={WEEK}
      />,
      { context: withOvertime },
    );
    const copy = await screen.findByRole('dialog', { name: 'Copy the previous week' });
    expect(await within(copy).findByText('1 entry to copy.')).toBeInTheDocument();
    await user.click(within(copy).getByRole('button', { name: 'Copy time' }));

    const dialog = await overtimeDialog();
    expect(dialog).toHaveTextContent('5h of these are overtime');
    await user.click(within(dialog).getByRole('button', { name: 'Add overtime' }));

    await waitFor(() =>
      expect(callsTo(backend, 'POST', '/time-entries/copy-week')).toHaveLength(2),
    );
    expect(callsTo(backend, 'POST', '/time-entries/copy-week')[1]?.body).toEqual({
      from_week_start: PREVIOUS_WEEK,
      to_week_start: WEEK,
      confirm_overtime: true,
    });
    expect(await screen.findByText('Time copied')).toBeInTheDocument();
  });

  it('copies nothing on Cancel', async () => {
    const user = userEvent.setup();
    const backend = setup({ entries: previous() });
    renderInOrg(
      <CopyWeekDialog
        open
        onClose={() => undefined}
        fromWeekStart={PREVIOUS_WEEK}
        toWeekStart={WEEK}
      />,
      { context: withOvertime },
    );
    const copy = await screen.findByRole('dialog', { name: 'Copy the previous week' });
    expect(await within(copy).findByText('1 entry to copy.')).toBeInTheDocument();
    await user.click(within(copy).getByRole('button', { name: 'Copy time' }));
    await user.click(within(await overtimeDialog()).getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add overtime hours?' })).not.toBeInTheDocument(),
    );
    expect(callsTo(backend, 'POST', '/time-entries/copy-week')).toHaveLength(1);
    expect(backend.entries).toHaveLength(4);
    expect(screen.getByRole('dialog', { name: 'Copy the previous week' })).toBeInTheDocument();
  });
});
