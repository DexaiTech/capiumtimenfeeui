import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { assignee, ada, ben, IDS, job as makeJob, task as makeTask } from '../test/fixtures';
import { callsOf, createBackend, jobHandlers, type JobsBackend } from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import TasksPage from './TasksPage';

const READ_ONLY = ['organization.read', 'member.read', 'client.read', 'job.read'];
const TASKS = `${JOBS}/tasks`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(
  init: Partial<JobsBackend> = {},
  options: { permissions?: string[]; route?: string } = {},
) {
  const backend = createBackend({
    jobs: [
      makeJob({ id: 'j-1', number: 'J00001', name: 'Year-end accounts' }),
      makeJob({
        id: 'j-2',
        number: 'J00002',
        name: 'Bookkeeping Q3',
        client_id: IDS.globex,
        client_name: 'Globex plc',
        status: 'closed',
      }),
    ],
    tasks: [
      makeTask({
        id: 't-1',
        job_id: 'j-1',
        title: 'Prepare the trial balance',
        status: 'in_progress',
        due_date: '2026-10-12',
        is_overdue: true,
        budget_minutes: 480,
        logged_minutes: 120,
        assignees: [assignee(ben)],
      }),
      makeTask({
        id: 't-2',
        job_id: 'j-1',
        title: 'File the accounts',
        status: 'completed',
        due_date: '2026-10-28',
      }),
      makeTask({
        id: 't-3',
        job_id: 'j-2',
        title: 'Reconcile the bank',
        due_date: null,
        assignees: [assignee(ada)],
      }),
    ],
    ...init,
  });
  server.use(...jobHandlers(backend));
  renderJobPage(<TasksPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? TASKS,
    path: TASKS,
  });
  return backend;
}

const lists = (backend: JobsBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/tasks');

const table = async () => {
  const element = await screen.findByRole('table', { name: 'Tasks' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

describe('the tasks of every job', () => {
  it('lists them by due date with their job, client, status, assignees and hours', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.get('sort')).toBe('due_date');
    expect(rows).toHaveLength(3);
    const trial = rows.find((row) =>
      row.textContent?.includes('Prepare the trial balance'),
    ) as HTMLElement;
    expect(trial).toHaveTextContent('J00001 Year-end accounts');
    expect(trial).toHaveTextContent('Acme Ltd');
    expect(trial).toHaveTextContent('In progress');
    expect(trial).toHaveTextContent('Ben Carter');
    expect(trial).toHaveTextContent('12/10/2026');
    expect(within(trial).getByText('Overdue')).toBeInTheDocument();
    expect(trial).toHaveTextContent('2:00 of 8:00');
    expect(within(trial).getByRole('link', { name: /J00001 Year-end accounts/ })).toHaveAttribute(
      'href',
      '/acme/jobs/j-1',
    );
    expect(screen.getByText('Showing 3 tasks · End of the list')).toBeInTheDocument();
  });

  it('filters by status, by search and by who the task is assigned to', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('tab', { name: 'Completed' }));
    await waitFor(() =>
      expect(lists(backend).at(-1)?.params?.getAll('status')).toEqual(['completed']),
    );
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));

    await user.click(screen.getByRole('tab', { name: 'All tasks' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'bank');
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('q')).toBe('bank'));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    await user.clear(screen.getByRole('searchbox', { name: 'Search tasks' }));
    // The cleared search reaches the URL after the 300 ms debounce; filter once it has.
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('q')).toBeNull());
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter tasks' });
    await user.selectOptions(within(panel).getByLabelText('Assigned to'), 'Me');
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('assignee_user_id')).toBe('me'));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).toHaveTextContent('Reconcile the bank');
  });

  it('sorts by the header the person clicks, through the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /^Task/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('sort')).toBe('title'));
    await user.click(screen.getByRole('button', { name: /^Task/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('sort')).toBe('-title'));
  });

  it('changes the status of a task of an open job from its row', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();
    await user.click(
      await screen.findByRole('button', { name: 'Change the status of Prepare the trial balance' }),
    );
    await user.click(screen.getByRole('option', { name: 'Completed' }));

    expect(await screen.findByText('Status changed')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/jobs/j-1/tasks/t-1/status',
      body: { status: 'completed' },
    });
  });

  it('shows the status only for a task of a closed job, and for a reader', async () => {
    setup();
    await table();
    // t-3 belongs to the closed job J00002.
    expect(
      screen.queryByRole('button', { name: 'Change the status of Reconcile the bank' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change the status of File the accounts' }),
    ).toBeInTheDocument();
  });

  it('lets a reader change the status of the tasks assigned to them, and of no other', async () => {
    const user = userEvent.setup();
    const backend = setup(
      {
        tasks: [
          makeTask({
            id: 't-1',
            job_id: 'j-1',
            title: 'Prepare the trial balance',
            assignees: [assignee(ben)],
          }),
          makeTask({
            id: 't-2',
            job_id: 'j-1',
            title: 'File the accounts',
            status: 'completed',
            assignees: [assignee(ben), assignee(ada)],
          }),
          makeTask({
            id: 't-3',
            job_id: 'j-2',
            title: 'Reconcile the bank',
            assignees: [assignee(ada)],
          }),
        ],
      },
      { permissions: READ_ONLY },
    );
    await table();
    // t-1 is Ben's; t-2 is also Ada's, the signed-in person; t-3 is Ada's but in a closed job.
    expect(
      screen.queryByRole('button', { name: 'Change the status of Prepare the trial balance' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Change the status of Reconcile the bank' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Change the status of File the accounts' }),
    );
    await user.click(screen.getByRole('option', { name: 'In progress' }));
    expect(await screen.findByText('Status changed')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/jobs/j-1/tasks/t-2/status',
      body: { status: 'in_progress' },
    });
  });

  it('says when nothing matches and when there are no tasks at all', async () => {
    const user = userEvent.setup();
    setup({ tasks: [] });
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'On hold' }));
    expect(await screen.findByText('No tasks match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
  });

  it('opens with the status of the address', async () => {
    const backend = setup({}, { route: `${TASKS}?status=in_progress&assignee=me` });
    await table();
    expect(lists(backend)[0]?.params?.getAll('status')).toEqual(['in_progress']);
    expect(lists(backend)[0]?.params?.get('assignee_user_id')).toBe('me');
  });
});
