import { screen, waitFor, within } from '@testing-library/react';
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
  NOT_LOCKED,
  PERIODS,
  q2Event,
} from '../test/adminFixtures';
import { adminHandlers, callsOf, createBackend, type AdminBackend } from '../test/adminHandlers';
import PeriodLockPage from './PeriodLockPage';

const READ = ['organization.read', 'period_lock.read'];
const PARTNER = [...READ, 'period_lock.manage'];

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

const closed = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

async function openLockDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Lock a period' }));
  return screen.findByRole('dialog', { name: 'Lock a period' });
}

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
  it('lists each locked period, with who locked it and why', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: 'Locked periods' })).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Locked periods' });
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('January 2026');
    expect(items[0]).toHaveTextContent('01/01/2026 to 31/01/2026');
    expect(items[0]).toHaveTextContent('by Ada Lovelace: January VAT return filed');
    expect(items[1]).toHaveTextContent('Q2 2026');
    expect(items[1]).toHaveTextContent('01/04/2026 to 30/06/2026');
  });

  it('says that nothing is locked, and has nothing to unlock', async () => {
    setup({ lock: NOT_LOCKED, history: [] });

    expect(await screen.findByRole('heading', { name: 'Nothing is locked' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Unlock/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock a period' })).toBeEnabled();
    expect(await screen.findByText('Nothing has been locked yet')).toBeInTheDocument();
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

    const region = await screen.findByRole('region', { name: 'Locked periods' });
    const item = within(region).getByRole('listitem');
    expect(item).toHaveTextContent('Through 31/08/2026');
    expect(item).toHaveTextContent('Earlier lock');
  });

  it('explains what a lock closes and what stays open', async () => {
    setup();
    await screen.findByRole('heading', { name: 'What a lock closes' });

    expect(screen.getByText(/disbursements and expense claim lines/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What stays open' })).toBeInTheDocument();
    expect(screen.getByText(/Invoices, credit notes, payments and statements/)).toBeInTheDocument();
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

describe('locking a period', () => {
  it('suggests the month that has just ended, and rules out what is locked or not over yet', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openLockDialog(user);

    expect(within(dialog).getByLabelText(/^Year/)).toHaveValue('2026');
    const month = within(dialog).getByLabelText(/^Month/);
    expect(month).toHaveValue('9');
    expect(within(month).getByRole('option', { name: 'January (already locked)' })).toBeDisabled();
    expect(within(month).getByRole('option', { name: 'February' })).toBeEnabled();
    expect(within(month).getByRole('option', { name: 'May (already locked)' })).toBeDisabled();
    expect(within(month).getByRole('option', { name: 'October (not ended yet)' })).toBeDisabled();
  });

  it('locks the month with a reason, and the page follows', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openLockDialog(user);

    await user.type(within(dialog).getByLabelText('Reason (optional)'), '  September filed  ');
    await user.click(within(dialog).getByRole('button', { name: 'Lock period' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks')).toHaveLength(1));
    expect(callsOf(backend, 'POST', '/period-locks')[0]?.body).toEqual({
      period_type: 'month',
      year: 2026,
      period: 9,
      reason: 'September filed',
    });
    expect(await screen.findByText('September 2026 locked')).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Locked periods' });
    await waitFor(() => expect(within(region).getAllByRole('listitem')).toHaveLength(3));
    await closed('Lock a period');
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Lock history' }))[0]).toHaveTextContent(
        'Locked September 2026',
      ),
    );
  });

  it('locks a quarter, which has no month to send', async () => {
    const user = userEvent.setup();
    const backend = setup({ lock: NOT_LOCKED, history: [] });
    const dialog = await openLockDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Quarter' }));
    expect(within(dialog).queryByLabelText(/^Month/)).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText(/^Quarter/), '2');
    await user.click(within(dialog).getByRole('button', { name: 'Lock period' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks')).toHaveLength(1));
    expect(callsOf(backend, 'POST', '/period-locks')[0]?.body).toEqual({
      period_type: 'quarter',
      year: 2026,
      period: 2,
      reason: null,
    });
  });

  it('locks a year with only the year to choose', async () => {
    const user = userEvent.setup();
    const backend = setup({ lock: NOT_LOCKED, history: [] });
    const dialog = await openLockDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Year' }));
    expect(within(dialog).queryByLabelText(/^Month/)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/^Quarter/)).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText(/^Year/), '2025');
    await user.click(within(dialog).getByRole('button', { name: 'Lock period' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks')).toHaveLength(1));
    expect(callsOf(backend, 'POST', '/period-locks')[0]?.body).toEqual({
      period_type: 'year',
      year: 2025,
      reason: null,
    });
  });

  it('refuses a year that has not ended, without asking the API', async () => {
    const user = userEvent.setup();
    const backend = setup({ lock: NOT_LOCKED, history: [] });
    const dialog = await openLockDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Year' }));
    await user.selectOptions(within(dialog).getByLabelText(/^Year/), '2026');
    await user.click(within(dialog).getByRole('button', { name: 'Lock period' }));

    expect(await within(dialog).findByText('That period is not ended yet')).toBeInTheDocument();
    expect(callsOf(backend, 'POST', '/period-locks')).toHaveLength(0);
  });

  it('shows the refusal of the API on the period field', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /period-locks': {
          status: 422,
          code: 'PERIOD_LOCK_OVERLAPS',
          message: 'That overlaps a locked period.',
          details: [
            {
              field: 'period',
              code: 'PERIOD_LOCK_OVERLAPS',
              message: 'September 2026 overlaps a period that is already locked (Q3 2026).',
            },
          ],
        },
      },
    });
    const dialog = await openLockDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Lock period' }));

    expect(
      await within(dialog).findByText(
        'September 2026 overlaps a period that is already locked (Q3 2026).',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Lock a period' })).toBeInTheDocument();
  });

  it('can be cancelled without locking anything', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openLockDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await closed('Lock a period');
    expect(callsOf(backend, 'POST', '/period-locks')).toHaveLength(0);
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
    const region = screen.getByRole('region', { name: 'Locked periods' });
    await waitFor(() => expect(within(region).getAllByRole('listitem')).toHaveLength(1));
    expect(within(region).getByText('Q2 2026')).toBeInTheDocument();
    await closed('Unlock January 2026');
  });

  it('says that nothing is locked once the last period is unlocked', async () => {
    const user = userEvent.setup();
    setup({ lock: lockedWith([lockedPeriod()], q2Event()) });
    const dialog = await openUnlockDialog(user, 'January 2026');

    await user.type(within(dialog).getByLabelText('Reason'), 'Starting again');
    await user.click(within(dialog).getByRole('button', { name: 'Unlock period' }));

    expect(await screen.findByRole('heading', { name: 'Nothing is locked' })).toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { name: 'Locked periods' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock a period' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unlock January 2026' })).toBeDisabled();
    expect(
      screen.getByText('Locking and unlocking periods need their own permissions.'),
    ).toBeInTheDocument();
  });

  it('lets a partner lock but not unlock', async () => {
    setup({}, PARTNER);

    expect(await screen.findByRole('button', { name: 'Lock a period' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Unlock Q2 2026' })).toBeDisabled();
    expect(screen.getByText('Unlocking a period needs its own permission.')).toBeInTheDocument();
  });

  it('needs permission to read the locks, and asks the API for nothing without it', async () => {
    const backend = setup({}, ['organization.read']);

    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(callsOf(backend, 'GET', '/period-locks')).toHaveLength(0);
  });
});

describe('a failed load', () => {
  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /period-locks': { status: 500, code: 'SERVER_ERROR', message: 'Down.' } },
    });

    expect(await screen.findByText('Could not load the period lock')).toBeInTheDocument();
    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Locked periods' })).toBeInTheDocument();
  });
});

describe('mandatory fields of the period lock dialogs', () => {
  it('stars the year and the month, not the reason', async () => {
    setup();
    const dialog = await openLockDialog(userEvent.setup());
    expectRequiredFields(dialog, { required: ['Year', 'Month'], optional: ['Reason (optional)'] });
  });

  it('stars the reason of an unlock', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openUnlockDialog(user, 'January 2026');
    expectRequiredFields(dialog, { required: ['Reason'] });
  });
});
