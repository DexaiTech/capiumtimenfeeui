import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { IDS, job as makeJob } from '../test/fixtures';
import { callsOf, createBackend, jobHandlers, type JobsBackend } from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import JobsPage from './JobsPage';

const READ_ONLY = ['organization.read', 'member.read', 'client.read', 'job.read'];
const EDIT_ONLY = [...READ_ONLY, 'job.update'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

function jobs() {
  return [
    makeJob({
      id: 'j-1',
      number: 'J00001',
      name: 'Year-end accounts',
      created_at: '2026-10-03T09:00:00Z',
    }),
    makeJob({
      id: 'j-2',
      number: 'J00002',
      name: 'Bookkeeping Q3',
      status: 'planned',
      due_date: '2026-10-10',
      manager_user_id: null,
      created_at: '2026-10-02T09:00:00Z',
    }),
    makeJob({
      id: 'j-3',
      number: 'J00003',
      name: 'VAT returns',
      status: 'cancelled',
      created_at: '2026-10-01T09:00:00Z',
    }),
  ];
}

function setup(init: Partial<JobsBackend> = {}, permissions: string[] = OWNER_PERMISSIONS) {
  const backend = createBackend({ jobs: jobs(), ...init });
  server.use(...jobHandlers(backend));
  renderJobPage(<JobsPage />, { permissions, route: JOBS });
  return backend;
}

const bulkCalls = (backend: JobsBackend) =>
  callsOf(backend, 'POST').filter((call) => call.path === '/jobs/bulk');

async function tick(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  const table = await screen.findByRole('table', { name: 'Jobs' });
  await waitFor(() => expect(table).not.toHaveAttribute('aria-busy', 'true'));
  for (const name of names) {
    await user.click(within(table).getByRole('checkbox', { name: `Select ${name}` }));
  }
  return screen.findByRole('region', { name: 'Bulk actions for jobs' });
}

describe('bulk actions on the job list', () => {
  it('shows the bar with the count once rows are ticked, and Clear unticks them', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('table', { name: 'Jobs' });
    expect(screen.queryByRole('region', { name: 'Bulk actions for jobs' })).not.toBeInTheDocument();

    const bar = await tick(user, 'J00001 Year-end accounts', 'J00002 Bookkeeping Q3');
    expect(within(bar).getByText('2 selected')).toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('region', { name: 'Bulk actions for jobs' })).not.toBeInTheDocument();
  });

  it('selects every listed job with the header checkbox', async () => {
    const user = userEvent.setup();
    setup();
    const table = await screen.findByRole('table', { name: 'Jobs' });
    await waitFor(() => expect(table).not.toHaveAttribute('aria-busy', 'true'));
    await user.click(within(table).getByRole('checkbox', { name: 'Select all rows' }));
    expect(await screen.findByText('3 selected')).toBeInTheDocument();
  });

  it('sets the status of the selected jobs in one call, then clears the selection', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const bar = await tick(user, 'J00001 Year-end accounts', 'J00002 Bookkeeping Q3');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set status' }));

    const dialog = await screen.findByRole('dialog', { name: 'Set the status of 2 jobs' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'New status' }),
      'on_hold',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Update 2 jobs' }));

    await waitFor(() => expect(bulkCalls(backend)).toHaveLength(1));
    expect(bulkCalls(backend)[0]?.body).toEqual({
      job_ids: ['j-1', 'j-2'],
      action: 'set_status',
      value: 'on_hold',
    });
    expect(await screen.findByText('2 jobs updated')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Bulk actions for jobs' }),
      ).not.toBeInTheDocument(),
    );
    expect(backend.jobs.map((entry) => entry.status)).toEqual(['on_hold', 'on_hold', 'cancelled']);
  });

  it('sets and clears the manager and the due date', async () => {
    const user = userEvent.setup();
    const backend = setup();
    let bar = await tick(user, 'J00002 Bookkeeping Q3');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set manager' }));
    let dialog = await screen.findByRole('dialog', { name: 'Set the manager of 1 job' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'New manager' }),
      IDS.ben,
    );
    await user.click(within(dialog).getByRole('button', { name: 'Update 1 job' }));
    await waitFor(() => expect(bulkCalls(backend)).toHaveLength(1));
    expect(bulkCalls(backend)[0]?.body).toMatchObject({ action: 'set_manager', value: IDS.ben });

    bar = await tick(user, 'J00002 Bookkeeping Q3');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set due date' }));
    dialog = await screen.findByRole('dialog', { name: 'Set the due date of 1 job' });
    expect(within(dialog).getByRole('button', { name: 'Update 1 job' })).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Clear the due date instead' }));
    await user.click(within(dialog).getByRole('button', { name: 'Update 1 job' }));
    await waitFor(() => expect(bulkCalls(backend)).toHaveLength(2));
    expect(bulkCalls(backend)[1]?.body).toMatchObject({ action: 'set_due_date', value: null });
    expect(backend.jobs.find((entry) => entry.id === 'j-2')?.due_date).toBeNull();
  });

  it('shows the jobs the API refuses a status for, and changes nothing', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const bar = await tick(user, 'J00001 Year-end accounts', 'J00003 VAT returns');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set status' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set the status of 2 jobs' });
    await user.click(within(dialog).getByRole('button', { name: 'Update 2 jobs' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('cannot be moved to in_progress');
    expect(alert).toHaveTextContent('J00003');
    expect(alert).not.toHaveTextContent('J00001');
    expect(backend.jobs.map((entry) => entry.status)).toEqual([
      'in_progress',
      'planned',
      'cancelled',
    ]);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('deletes the selected jobs after a confirmation that says what will happen', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const bar = await tick(user, 'J00001 Year-end accounts', 'J00003 VAT returns');
    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 jobs?' });
    expect(dialog).toHaveTextContent('cannot be deleted');
    await user.click(within(dialog).getByRole('button', { name: 'Delete 2 jobs' }));

    expect(await screen.findByText('2 jobs deleted')).toBeInTheDocument();
    expect(bulkCalls(backend)[0]?.body).toEqual({ job_ids: ['j-1', 'j-3'], action: 'delete' });
    expect(backend.jobs.map((entry) => entry.id)).toEqual(['j-2']);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the delete dialog open and lists the jobs that are in use', async () => {
    const user = userEvent.setup();
    const backend = setup({ inUse: new Set(['j-1']) });
    const bar = await tick(user, 'J00001 Year-end accounts', 'J00002 Bookkeeping Q3');
    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 jobs?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete 2 jobs' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Nothing was deleted');
    expect(within(alert).getByText('J00001')).toBeInTheDocument();
    expect(backend.jobs).toHaveLength(3);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('announces the result to screen readers', async () => {
    const user = userEvent.setup();
    setup();
    const bar = await tick(user, 'J00002 Bookkeeping Q3');
    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 1 job?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete 1 job' }));
    await waitFor(() =>
      expect(screen.getAllByRole('status').some((el) => el.textContent === '1 job deleted')).toBe(
        true,
      ),
    );
  });

  it('offers only Edit to a role that may update but not delete', async () => {
    const user = userEvent.setup();
    setup({}, EDIT_ONLY);
    const bar = await tick(user, 'J00001 Year-end accounts');
    expect(within(bar).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('offers a reader no checkboxes and no bulk bar', async () => {
    setup({}, READ_ONLY);
    const table = await screen.findByRole('table', { name: 'Jobs' });
    await waitFor(() => expect(table).not.toHaveAttribute('aria-busy', 'true'));
    expect(within(table).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bulk actions for jobs' })).not.toBeInTheDocument();
  });
});
