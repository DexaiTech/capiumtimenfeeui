import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { server } from '@/test/server';

import {
  historyOf,
  lockedPeriod,
  lockedWith,
  lockEvent,
  PERIODS,
  q2Event,
  SETTINGS,
} from '../test/adminFixtures';
import { adminHandlers, callsOf, createBackend, type AdminBackend } from '../test/adminHandlers';
import type { PeriodLockSettings } from '../adminTypes';
import PeriodLockPage from './PeriodLockPage';

const READ = ['organization.read', 'period_lock.read'];
const PARTNER = [...READ, 'period_lock.manage'];

const WEEKLY: PeriodLockSettings = { ...SETTINGS, granularity: 'weekly' };
const UNCONFIGURED: PeriodLockSettings = { ...WEEKLY, configured: false };

function setup(init: Partial<AdminBackend> = {}, permissions = OWNER_PERMISSIONS) {
  const backend = createBackend({
    lock: lockedWith(PERIODS, q2Event()),
    history: historyOf(),
    ...init,
  });
  server.use(...adminHandlers(backend));
  renderInOrg(<PeriodLockPage />, { context: contextWith(permissions) });
  return backend;
}

const history = async () => {
  const element = await screen.findByRole('table', { name: 'Lock history' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

/** The grid of periods, once the year has loaded. */
const grid = (label = '2026') => screen.findByRole('table', { name: `Periods of ${label}` });

const rowNamed = (table: HTMLElement, text: string) => {
  const row = rowsOf(table).find((entry) => within(entry).queryByText(text) !== null);
  if (!row) throw new Error(`No row for ${text}`);
  return row;
};

const closed = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

async function openUnlockDialog(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(await screen.findByRole('button', { name: `Unlock ${label}` }));
  return screen.findByRole('dialog', { name: `Unlock ${label}` });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('where the locks stand', () => {
  it('lists the months of the year with the locked ones marked, and what a lock closes', async () => {
    setup();

    const table = await grid();
    const rows = rowsOf(table);
    expect(rows).toHaveLength(12);
    expect(screen.getByRole('heading', { name: 'Periods of 2026' })).toBeInTheDocument();
    expect(screen.getByText(/· 1 of 12 locked\./)).toBeInTheDocument();
    const january = rowNamed(table, 'January 2026');
    expect(january).toHaveTextContent('01/01/2026 to 31/01/2026');
    expect(january).toHaveTextContent('Locked');
    expect(january).toHaveTextContent('by Ada Lovelace');
    expect(within(january).getByRole('button', { name: 'Unlock January 2026' })).toBeEnabled();
    expect(await screen.findByRole('heading', { name: 'What a lock closes' })).toBeInTheDocument();
    expect(screen.getByText(/disbursements and expense claim lines/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What stays open' })).toBeInTheDocument();
  });

  it('offers an open month to lock, and rules out one inside a lock or not over yet', async () => {
    setup();
    const table = await grid();

    const february = rowNamed(table, 'February 2026');
    expect(february).toHaveTextContent('Open');
    expect(within(february).getByRole('button', { name: 'Lock February 2026' })).toBeEnabled();
    const may = rowNamed(table, 'May 2026');
    expect(may).toHaveTextContent('Within Q2 2026');
    expect(within(may).getByRole('button', { name: 'Lock May 2026' })).toBeDisabled();
    const october = rowNamed(table, 'October 2026');
    expect(october).toHaveTextContent('Not ended yet');
    expect(within(october).getByRole('button', { name: 'Lock October 2026' })).toBeDisabled();
  });

  it('lists a lock of another length apart, where it can be unlocked', async () => {
    setup();

    const region = await screen.findByRole('region', { name: 'Earlier locks' });
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Q2 2026');
    expect(items[0]).toHaveTextContent('01/04/2026 to 30/06/2026');
    expect(
      within(items[0] as HTMLElement).getByRole('button', { name: 'Unlock Q2 2026' }),
    ).toBeEnabled();
  });

  it('marks a lock from before periods existed', async () => {
    setup({
      lock: lockedWith(
        [
          {
            ...lockedPeriod(),
            id: 'lp-old',
            period_type: 'legacy',
            start_date: '2000-01-01',
            end_date: '2026-08-31',
            label: 'Through 31/08/2026',
          },
        ],
        q2Event(),
      ),
    });

    const region = await screen.findByRole('region', { name: 'Earlier locks' });
    const item = within(region).getByRole('listitem');
    expect(item).toHaveTextContent('Through 31/08/2026');
    expect(item).toHaveTextContent('Before periods');
  });

  it('has no list of earlier locks when every lock is of the current length', async () => {
    setup({ lock: lockedWith([lockedPeriod()], q2Event()) });
    await grid();

    expect(screen.queryByRole('region', { name: 'Earlier locks' })).not.toBeInTheDocument();
  });

  it('shows another accounting year from the selector', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await grid();

    const select = screen.getByLabelText('Accounting year');
    expect(
      within(select).getByRole('option', { name: '2026 (1 of 12 locked)' }),
    ).toBeInTheDocument();
    expect(within(select).getAllByRole('option')).toHaveLength(6);
    await user.selectOptions(select, '2025');

    const table = await grid('2025');
    expect(rowNamed(table, 'January 2025')).toHaveTextContent('Open');
    expect(callsOf(backend, 'GET', '/period-locks/calendar').at(-1)?.params?.get('year')).toBe(
      '2025',
    );
  });
});

describe('weekly locking, the default', () => {
  it('shows every week of the year in one list, each with a Lock button', async () => {
    setup({ lock: lockedWith([], q2Event(), WEEKLY), history: [] });

    const table = await grid();
    const rows = rowsOf(table);
    expect(rows).toHaveLength(52);
    expect(screen.getByText(/· 0 of 52 locked\./)).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('Week 1');
    expect(rows[0]).toHaveTextContent('05/01/2026 to 11/01/2026');
    expect(
      within(rows[0] as HTMLElement).getByRole('button', { name: 'Lock Week 1' }),
    ).toBeEnabled();
    // The week of 19 October has not ended on the 18th.
    expect(
      within(rows[42] as HTMLElement).getByRole('button', { name: 'Lock Week 43' }),
    ).toBeDisabled();
    expect(rows[51]).toHaveTextContent('28/12/2026 to 03/01/2027');
  });

  it('locks a week with one click, and the row follows', async () => {
    const user = userEvent.setup();
    const backend = setup({ lock: lockedWith([], q2Event(), WEEKLY), history: [] });
    const table = await grid();

    await user.click(within(table).getByRole('button', { name: 'Lock Week 3' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks')).toHaveLength(1));
    expect(callsOf(backend, 'POST', '/period-locks')[0]?.body).toEqual({
      period_type: 'week',
      year: 2026,
      period: 3,
    });
    expect(await screen.findByText('Week 3 locked')).toBeInTheDocument();
    const week = rowNamed(await grid(), 'Week 3');
    await waitFor(() => expect(week).toHaveTextContent('Locked'));
    expect(within(week).getByRole('button', { name: 'Unlock Week 3' })).toBeEnabled();
    expect(screen.getByText(/· 1 of 52 locked\./)).toBeInTheDocument();
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Lock history' }))[0]).toHaveTextContent(
        'Locked Week of 19/01/2026',
      ),
    );
  });

  it('unlocks a week, asking why', async () => {
    const user = userEvent.setup();
    const backend = setup({ lock: lockedWith([], q2Event(), WEEKLY), history: [] });
    await user.click(await screen.findByRole('button', { name: 'Lock Week 3' }));
    await screen.findByRole('button', { name: 'Unlock Week 3' });

    const dialog = await openUnlockDialog(user, 'Week 3');
    expect(dialog).toHaveTextContent('19/01/2026 to 25/01/2026');
    await user.type(within(dialog).getByLabelText('Reason'), 'Late invoice');
    await user.click(within(dialog).getByRole('button', { name: 'Unlock period' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks/reopen')).toHaveLength(1));
    expect(await screen.findByRole('button', { name: 'Lock Week 3' })).toBeEnabled();
    await closed('Unlock Week 3');
  });

  it('shows why a week could not be locked', async () => {
    const user = userEvent.setup();
    setup({
      lock: lockedWith([], q2Event(), WEEKLY),
      history: [],
      refusals: {
        'POST /period-locks': {
          status: 422,
          code: 'PERIOD_LOCK_OVERLAPS',
          message: 'Week of 05/01/2026 overlaps a period that is already locked.',
        },
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Lock Week 1' }));

    expect(await screen.findByText('Could not lock')).toBeInTheDocument();
    expect(
      screen.getByText(/Week of 05\/01\/2026 overlaps a period that is already locked\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock Week 1' })).toBeEnabled();
  });

  it('follows an accounting year that starts on 6 April', async () => {
    setup({
      lock: lockedWith([], q2Event(), {
        ...WEEKLY,
        financial_year_start_month: 4,
        financial_year_start_day: 6,
      }),
      history: [],
    });

    const table = await grid('2026/27');
    expect(rowsOf(table)[0]).toHaveTextContent('Week 1');
    expect(rowsOf(table)[0]).toHaveTextContent('06/04/2026 to 12/04/2026');
    expect(screen.getByText(/06\/04\/2026 to 05\/04\/2027/)).toBeInTheDocument();
    // The year that began on 6 April 2026 is the current one on 18 October.
    expect(
      within(screen.getByLabelText('Accounting year')).getAllByRole('option')[0],
    ).toHaveTextContent('2026/27');
  });
});

describe('how periods are locked', () => {
  it('summarises the setting, with a way to change it', async () => {
    setup();

    const region = await screen.findByRole('region', { name: 'How periods are locked' });
    expect(region).toHaveTextContent('Monthly locks');
    expect(region).toHaveTextContent('accounting year starts 1 January');
    expect(within(region).getByRole('button', { name: 'Change' })).toBeEnabled();
  });

  it('asks the first time, with weekly chosen, and saves the choice', async () => {
    const user = userEvent.setup();
    const backend = setup({ lock: lockedWith([], q2Event(), UNCONFIGURED), history: [] });

    const region = await screen.findByRole('region', { name: 'Set up period locking' });
    expect(within(region).getByRole('button', { name: 'Weekly' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(region).getByRole('button', { name: 'Quarterly' }));
    await user.selectOptions(within(region).getByLabelText('Accounting year starts in'), '4');
    fireEvent.change(within(region).getByLabelText('On day'), { target: { value: '6' } });
    await user.click(within(region).getByRole('button', { name: 'Save and start' }));

    await waitFor(() => expect(callsOf(backend, 'PUT', '/period-locks/settings')).toHaveLength(1));
    expect(callsOf(backend, 'PUT', '/period-locks/settings')[0]?.body).toEqual({
      granularity: 'quarterly',
      financial_year_start_month: 4,
      financial_year_start_day: 6,
    });
    expect(await screen.findByRole('region', { name: 'How periods are locked' })).toHaveTextContent(
      'Quarterly locks · accounting year starts 6 April',
    );
    const table = await grid('2026/27');
    expect(rowsOf(table)).toHaveLength(4);
  });

  it('changes it later, without touching the locks that exist', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog', { name: 'How periods are locked' });

    await user.click(within(dialog).getByRole('button', { name: 'Annually' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(callsOf(backend, 'PUT', '/period-locks/settings')).toHaveLength(1));
    expect(callsOf(backend, 'PUT', '/period-locks/settings')[0]?.body).toEqual({
      granularity: 'annually',
      financial_year_start_month: 1,
      financial_year_start_day: 1,
    });
    await closed('How periods are locked');
    const table = await grid();
    expect(rowsOf(table)).toHaveLength(1);
    // The January lock is a month now, so it moves to the earlier locks.
    const region = await screen.findByRole('region', { name: 'Earlier locks' });
    expect(within(region).getAllByRole('listitem')).toHaveLength(2);
  });

  it('refuses a day the accounting year cannot start on, without asking the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog', { name: 'How periods are locked' });

    fireEvent.change(within(dialog).getByLabelText('On day'), { target: { value: '31' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('Use a day from 1 to 28')).toBeInTheDocument();
    expect(callsOf(backend, 'PUT', '/period-locks/settings')).toHaveLength(0);
  });

  it('can be cancelled without saving', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    const dialog = await screen.findByRole('dialog', { name: 'How periods are locked' });

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await closed('How periods are locked');
    expect(callsOf(backend, 'PUT', '/period-locks/settings')).toHaveLength(0);
  });
});

describe('the history', () => {
  it('lists every lock and unlock, newest first, with who did it and why', async () => {
    setup();
    const rows = rowsOf(await history());

    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('Locked Q2 2026');
    expect(rows[0]).toHaveTextContent('Q2 VAT return filed');
    expect(rows[1]).toHaveTextContent('Unlocked');
    expect(rows[1]).toHaveTextContent('Unlocked March 2026');
    expect(rows[1]).toHaveTextContent('Ada Lovelace');
    expect(rows[1]).toHaveTextContent('Late invoice from the supplier');
    expect(rows[2]).toHaveTextContent('Locked March 2026');
    expect(rows[3]).toHaveTextContent('Locked January 2026');
  });

  it('still reads the events from before periods existed', async () => {
    setup({
      history: [
        {
          ...lockEvent(),
          id: 'ev-old',
          period_type: null,
          period_start: null,
          period_end: null,
          period_label: null,
          previous_locked_through: '2026-02-28',
          locked_through: '2026-03-31',
        },
      ],
    });
    const rows = rowsOf(await history());

    expect(rows[0]).toHaveTextContent('Locked through 31/03/2026');
    expect(rows[0]).toHaveTextContent('Was locked through 28/02/2026');
  });

  it('loads older changes a page at a time', async () => {
    const user = userEvent.setup();
    const backend = setup({ pageSize: 3 });
    expect(rowsOf(await history())).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Load older changes' }));

    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Lock history' }))).toHaveLength(4),
    );
    expect(callsOf(backend, 'GET', '/period-locks/history')).toHaveLength(2);
    expect(callsOf(backend, 'GET', '/period-locks/history')[1]?.params?.get('cursor')).toBe('3');
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: {
        'GET /period-locks/history': { status: 500, code: 'SERVER_ERROR', message: 'Down.' },
      },
    });

    expect(await screen.findByText('Could not load the history')).toBeInTheDocument();
    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(rowsOf(await history())).toHaveLength(4);
  });
});

describe('unlocking a period', () => {
  it('unlocks that period only, with a reason', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openUnlockDialog(user, 'January 2026');

    expect(dialog).toHaveTextContent('01/01/2026 to 31/01/2026');
    await user.type(within(dialog).getByLabelText('Reason'), 'Supplier invoice');
    await user.click(within(dialog).getByRole('button', { name: 'Unlock period' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks/reopen')).toHaveLength(1));
    expect(callsOf(backend, 'POST', '/period-locks/reopen')[0]?.body).toEqual({
      lock_id: 'lp-jan',
      reason: 'Supplier invoice',
    });
    expect(await screen.findByText('January 2026 unlocked')).toBeInTheDocument();
    const january = rowNamed(await grid(), 'January 2026');
    await waitFor(() => expect(january).toHaveTextContent('Open'));
    expect(within(january).getByRole('button', { name: 'Lock January 2026' })).toBeEnabled();
    expect(screen.getByRole('region', { name: 'Earlier locks' })).toHaveTextContent('Q2 2026');
    await closed('Unlock January 2026');
  });

  it('unlocks a lock of another length from the earlier locks', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openUnlockDialog(user, 'Q2 2026');

    await user.type(within(dialog).getByLabelText('Reason'), 'Restating Q2');
    await user.click(within(dialog).getByRole('button', { name: 'Unlock period' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks/reopen')).toHaveLength(1));
    expect(callsOf(backend, 'POST', '/period-locks/reopen')[0]?.body).toEqual({
      lock_id: 'lp-q2',
      reason: 'Restating Q2',
    });
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Earlier locks' })).not.toBeInTheDocument(),
    );
    expect(rowNamed(await grid(), 'May 2026')).toHaveTextContent('Open');
  });

  it('needs a reason, without asking the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openUnlockDialog(user, 'Q2 2026');

    await user.click(within(dialog).getByRole('button', { name: 'Unlock period' }));

    expect(await within(dialog).findByText('Say why the period is unlocked')).toBeInTheDocument();
    expect(callsOf(backend, 'POST', '/period-locks/reopen')).toHaveLength(0);
  });
});

describe('the permissions', () => {
  it('lets someone who may only read see the locks but not change them', async () => {
    setup({}, READ);

    const table = await grid();
    expect(within(table).getByRole('button', { name: 'Unlock January 2026' })).toBeDisabled();
    expect(within(table).getByRole('button', { name: 'Lock February 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change' })).toBeDisabled();
    expect(
      screen.getByText('Locking and unlocking periods need their own permissions.'),
    ).toBeInTheDocument();
  });

  it('lets a partner lock but not unlock', async () => {
    setup({}, PARTNER);

    const table = await grid();
    expect(within(table).getByRole('button', { name: 'Lock February 2026' })).toBeEnabled();
    expect(within(table).getByRole('button', { name: 'Unlock January 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unlock Q2 2026' })).toBeDisabled();
    expect(screen.getByText('Unlocking a period needs its own permission.')).toBeInTheDocument();
  });

  it('leaves the first-time choice to someone who may manage locks', async () => {
    setup({ lock: lockedWith([], q2Event(), UNCONFIGURED), history: [] }, READ);

    const region = await screen.findByRole('region', { name: 'Set up period locking' });
    expect(
      within(region).queryByRole('button', { name: 'Save and start' }),
    ).not.toBeInTheDocument();
    expect(region).toHaveTextContent('Locking weekly until someone');
  });

  it('needs permission to read the locks, and asks the API for nothing without it', async () => {
    const backend = setup({}, ['organization.read']);

    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(callsOf(backend, 'GET', '/period-locks')).toHaveLength(0);
    expect(callsOf(backend, 'GET', '/period-locks/calendar')).toHaveLength(0);
  });
});

describe('a failed load', () => {
  it('shows the error of the lock with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /period-locks': { status: 500, code: 'SERVER_ERROR', message: 'Down.' } },
    });

    expect(await screen.findByText('Could not load the period lock')).toBeInTheDocument();
    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await grid()).toBeInTheDocument();
  });

  it('shows the error of the periods with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: {
        'GET /period-locks/calendar': { status: 500, code: 'SERVER_ERROR', message: 'Down.' },
      },
    });

    expect(await screen.findByText('Could not load the periods')).toBeInTheDocument();
    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await grid()).toBeInTheDocument();
  });
});

describe('mandatory fields of the period lock dialogs', () => {
  it('stars the reason of an unlock', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openUnlockDialog(user, 'January 2026');
    expectRequiredFields(dialog, { required: ['Reason'] });
  });
});
