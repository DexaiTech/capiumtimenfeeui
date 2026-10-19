import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { historyOf, lockedThrough, NOT_LOCKED, reopenedEvent } from '../test/adminFixtures';
import { adminHandlers, callsOf, createBackend, type AdminBackend } from '../test/adminHandlers';
import PeriodLockPage from './PeriodLockPage';

const READ = ['organization.read', 'period_lock.read'];
const PARTNER = [...READ, 'period_lock.manage'];

function setup(init: Partial<AdminBackend> = {}, permissions = OWNER_PERMISSIONS) {
  const backend = createBackend({
    lock: lockedThrough('2026-02-28', reopenedEvent()),
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

async function openReopenDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Reopen a period' }));
  return screen.findByRole('dialog', { name: 'Reopen a period' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('where the lock stands', () => {
  it('says the day the practice is locked through, and who last changed it', async () => {
    setup();

    expect(
      await screen.findByRole('heading', { name: 'Locked through 28/02/2026' }),
    ).toBeInTheDocument();
    const current = screen.getByRole('region', { name: 'Current lock' });
    expect(current).toHaveTextContent('cannot be created, changed or deleted by anybody');
    expect(current).toHaveTextContent('Reopened');
    expect(current).toHaveTextContent('by Ada Lovelace: Late invoice from the supplier');
  });

  it('says that nothing is locked, and has no period to reopen', async () => {
    setup({ lock: NOT_LOCKED, history: [] });

    expect(await screen.findByRole('heading', { name: 'Nothing is locked' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen a period' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lock a period' })).toBeEnabled();
    expect(await screen.findByText('Nothing has been locked yet')).toBeInTheDocument();
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
  it('lists every lock and reopening, newest first, with who did it and why', async () => {
    setup();
    const rows = rowsOf(await history());

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Reopened');
    expect(rows[0]).toHaveTextContent('Reopened to 28/02/2026');
    expect(rows[0]).toHaveTextContent('Was locked through 31/03/2026');
    expect(rows[0]).toHaveTextContent('Ada Lovelace');
    expect(rows[0]).toHaveTextContent('Late invoice from the supplier');
    expect(rows[1]).toHaveTextContent('Locked through 31/03/2026');
    expect(rows[1]).toHaveTextContent('Was locked through 28/02/2026');
    expect(rows[1]).toHaveTextContent('March VAT return filed');
    expect(rows[2]).toHaveTextContent('Locked through 28/02/2026');
    expect(rows[2]).toHaveTextContent('Nothing was locked before');
    expect(rows[2]).toHaveTextContent('—');
  });

  it('says when a lock was removed', async () => {
    setup({
      lock: NOT_LOCKED,
      history: [
        {
          ...reopenedEvent(),
          id: 'ev-9',
          locked_through: null,
          previous_locked_through: '2026-02-28',
          reason: 'Starting again',
        },
      ],
    });
    const rows = rowsOf(await history());

    expect(rows[0]).toHaveTextContent('Lock removed');
    expect(rows[0]).toHaveTextContent('Was locked through 28/02/2026');
  });

  it('loads older changes a page at a time', async () => {
    const user = userEvent.setup();
    const backend = setup({ pageSize: 2 });
    expect(rowsOf(await history())).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Load older changes' }));

    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Lock history' }))).toHaveLength(3),
    );
    expect(callsOf(backend, 'GET', '/period-locks/history')).toHaveLength(2);
    expect(callsOf(backend, 'GET', '/period-locks/history')[1]?.params?.get('cursor')).toBe('2');
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
    expect(rowsOf(await history())).toHaveLength(3);
  });
});

describe('locking a period', () => {
  it('suggests the end of last month, and limits the day to after the lock and up to today', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openLockDialog(user);

    const day = within(dialog).getByLabelText('Lock through');
    expect(day).toHaveValue('2026-09-30');
    expect(day).toHaveAttribute('min', '2026-03-01');
    expect(day).toHaveAttribute('max', '2026-10-18');
    expect(dialog).toHaveTextContent(
      'Now locked through 28/02/2026. Choose a later day, up to today.',
    );
  });

  it('locks through a day with a reason, and the page follows', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openLockDialog(user);

    await user.type(within(dialog).getByLabelText('Reason (optional)'), '  September filed  ');
    await user.click(within(dialog).getByRole('button', { name: 'Lock period' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks')).toHaveLength(1));
    expect(callsOf(backend, 'POST', '/period-locks')[0]?.body).toEqual({
      locked_through: '2026-09-30',
      reason: 'September filed',
    });
    expect(await screen.findByText('Period locked through 30/09/2026')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Locked through 30/09/2026' }),
    ).toBeInTheDocument();
    await closed('Lock a period');
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Lock history' }))[0]).toHaveTextContent(
        'Locked through 30/09/2026',
      ),
    );
  });

  it('sends no reason when none is given', async () => {
    const user = userEvent.setup();
    const backend = setup({ lock: NOT_LOCKED, history: [] });
    const dialog = await openLockDialog(user);

    expect(dialog).toHaveTextContent('The last day to close, up to today. That day is locked too.');
    await user.click(within(dialog).getByRole('button', { name: 'Lock period' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks')).toHaveLength(1));
    expect(callsOf(backend, 'POST', '/period-locks')[0]?.body).toEqual({
      locked_through: '2026-09-30',
      reason: null,
    });
  });

  it('refuses a day that is already locked, a day to come and no day, without asking the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openLockDialog(user);
    const day = within(dialog).getByLabelText('Lock through');
    const submit = within(dialog).getByRole('button', { name: 'Lock period' });

    fireEvent.change(day, { target: { value: '2026-02-01' } });
    await user.click(submit);
    expect(
      await within(dialog).findByText('Choose a day after 28/02/2026, which is already locked'),
    ).toBeInTheDocument();

    fireEvent.change(day, { target: { value: '2026-10-19' } });
    await user.click(submit);
    expect(
      await within(dialog).findByText('Choose a day that is not in the future'),
    ).toBeInTheDocument();

    fireEvent.change(day, { target: { value: '' } });
    await user.click(submit);
    expect(await within(dialog).findByText('Choose the last day to lock')).toBeInTheDocument();
    expect(callsOf(backend, 'POST', '/period-locks')).toHaveLength(0);
  });

  it('shows the refusal of the API on the day field', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /period-locks': {
          status: 422,
          code: 'PERIOD_LOCK_NOT_FORWARD',
          message: 'The date must be later than the current lock.',
          details: [
            {
              field: 'locked_through',
              code: 'PERIOD_LOCK_NOT_FORWARD',
              message: 'The date must be later than the current lock (28/02/2026).',
            },
          ],
        },
      },
    });
    const dialog = await openLockDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Lock period' }));

    expect(
      await within(dialog).findByText('The date must be later than the current lock (28/02/2026).'),
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

describe('reopening a period', () => {
  it('moves the lock back to an earlier day, with a reason', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openReopenDialog(user);

    const day = within(dialog).getByLabelText('New last locked day');
    expect(day).toHaveAttribute('max', '2026-02-27');
    fireEvent.change(day, { target: { value: '2026-01-31' } });
    await user.type(within(dialog).getByLabelText('Reason'), 'Supplier invoice');
    await user.click(within(dialog).getByRole('button', { name: 'Reopen period' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks/reopen')).toHaveLength(1));
    expect(callsOf(backend, 'POST', '/period-locks/reopen')[0]?.body).toEqual({
      reopen_to: '2026-01-31',
      reason: 'Supplier invoice',
    });
    expect(await screen.findByText('Period reopened to 31/01/2026')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Locked through 31/01/2026' }),
    ).toBeInTheDocument();
    await closed('Reopen a period');
  });

  it('removes the lock altogether, with a reason', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openReopenDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Remove the lock' }));
    expect(within(dialog).queryByLabelText('New last locked day')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Reason'), 'Starting again');
    await user.click(within(dialog).getByRole('button', { name: 'Reopen period' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/period-locks/reopen')).toHaveLength(1));
    expect(callsOf(backend, 'POST', '/period-locks/reopen')[0]?.body).toEqual({
      reopen_to: null,
      reason: 'Starting again',
    });
    // The toast and the new row of the history both say it.
    await waitFor(() => expect(screen.getAllByText('Lock removed')).toHaveLength(2));
    expect(await screen.findByRole('heading', { name: 'Nothing is locked' })).toBeInTheDocument();
  });

  it('needs a reason, and a day before the lock, without asking the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openReopenDialog(user);
    const submit = within(dialog).getByRole('button', { name: 'Reopen period' });

    await user.click(submit);
    expect(await within(dialog).findByText('Choose the new last locked day')).toBeInTheDocument();
    expect(within(dialog).getByText('Say why the period is reopened')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('New last locked day'), {
      target: { value: '2026-03-15' },
    });
    await user.click(submit);
    expect(
      await within(dialog).findByText('Choose a day before 28/02/2026, the day locked through now'),
    ).toBeInTheDocument();
    expect(callsOf(backend, 'POST', '/period-locks/reopen')).toHaveLength(0);
  });
});

describe('the permissions', () => {
  it('lets someone who may only read see the lock but not change it', async () => {
    setup({}, READ);

    expect(
      await screen.findByRole('heading', { name: 'Locked through 28/02/2026' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lock a period' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reopen a period' })).toBeDisabled();
    expect(
      screen.getByText('Locking and reopening periods need their own permissions.'),
    ).toBeInTheDocument();
  });

  it('lets a partner lock but not reopen', async () => {
    setup({}, PARTNER);

    expect(await screen.findByRole('button', { name: 'Lock a period' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reopen a period' })).toBeDisabled();
    expect(screen.getByText('Reopening a period needs its own permission.')).toBeInTheDocument();
  });

  it('needs permission to read the lock, and asks the API for nothing without it', async () => {
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
    expect(
      await screen.findByRole('heading', { name: 'Locked through 28/02/2026' }),
    ).toBeInTheDocument();
  });
});
