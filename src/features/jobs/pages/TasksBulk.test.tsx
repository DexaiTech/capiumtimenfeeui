import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { expectRequiredFields } from '@/test/requiredFields';
import { server } from '@/test/server';

import { assignee, ada, ben, IDS, job as makeJob, task as makeTask } from '../test/fixtures';
import { callsOf, createBackend, jobHandlers, type JobsBackend } from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import JobDetailPage from './JobDetailPage';
import TasksPage from './TasksPage';

const READ_ONLY = ['organization.read', 'member.read', 'client.read', 'job.read'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

const tasks = () => [
  makeTask({ id: 't-1', job_id: 'j-1', title: 'Prepare', assignees: [assignee(ben)] }),
  makeTask({ id: 't-2', job_id: 'j-1', title: 'Review' }),
  makeTask({ id: 't-3', job_id: 'j-1', title: 'File', logged_minutes: 90 }),
];

function setupDetail(permissions: string[] = OWNER_PERMISSIONS, init: Partial<JobsBackend> = {}) {
  const backend = createBackend({
    jobs: [makeJob({ task_counts: { total: 3, completed: 0 } })],
    tasks: tasks(),
    ...init,
  });
  server.use(...jobHandlers(backend));
  renderJobPage(<JobDetailPage />, {
    permissions,
    route: `${JOBS}/j-1`,
    path: `${JOBS}/:jobId`,
  });
  return backend;
}

const tasksTable = () => screen.findByRole('table', { name: 'Tasks of J00001' });
const bulkCalls = (backend: JobsBackend, path: string) =>
  callsOf(backend, 'POST').filter((call) => call.path === path);

async function tick(user: ReturnType<typeof userEvent.setup>, ...titles: string[]) {
  const table = await tasksTable();
  await waitFor(() => expect(within(table).getAllByRole('row').length).toBeGreaterThan(1));
  for (const title of titles) {
    await user.click(within(table).getByRole('checkbox', { name: `Select ${title}` }));
  }
  return screen.findByRole('region', { name: 'Bulk actions for tasks' });
}

describe('adding several tasks to a job', () => {
  async function openSeveral(user: ReturnType<typeof userEvent.setup>) {
    await tasksTable();
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    const dialog = await screen.findByRole('region', { name: 'Add task' });
    await user.click(within(dialog).getByRole('button', { name: 'Several tasks' }));
    return screen.findByRole('region', { name: 'Add several tasks' });
  }

  it('adds one task per line, with a pasted list marker removed, in one request', async () => {
    const user = userEvent.setup();
    const backend = setupDetail();
    const form = await openSeveral(user);
    expectRequiredFields(form, { required: ['Tasks'], optional: ['Due date'] });

    fireEvent.change(within(form).getByLabelText('Tasks'), {
      target: {
        value: '- Prepare accounts\n\n2. Review with partner\n   File at Companies House  \n',
      },
    });
    expect(within(form).getByText('3 tasks to add.')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Due date'), { target: { value: '2026-10-20' } });
    await user.selectOptions(within(form).getByLabelText('Starts as'), 'in_progress');
    await user.click(within(form).getByRole('button', { name: 'Add 3 tasks' }));

    expect(await screen.findByText('3 tasks added')).toBeInTheDocument();
    const [call] = bulkCalls(backend, '/jobs/j-1/tasks/bulk');
    expect(call?.body).toEqual({
      tasks: [
        { title: 'Prepare accounts', status: 'in_progress', due_date: '2026-10-20' },
        { title: 'Review with partner', status: 'in_progress', due_date: '2026-10-20' },
        { title: 'File at Companies House', status: 'in_progress', due_date: '2026-10-20' },
      ],
    });
    expect(await screen.findByRole('row', { name: /File at Companies House/ })).toBeInTheDocument();
  });

  it('asks for at least one task and refuses a title that is too long', async () => {
    const user = userEvent.setup();
    const backend = setupDetail();
    const form = await openSeveral(user);

    await user.click(within(form).getByRole('button', { name: 'Add task' }));
    expect(
      await within(form).findByText('Write at least one task, one per line.'),
    ).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Tasks'), {
      target: { value: `Fine\n${'x'.repeat(201)}` },
    });
    await user.click(within(form).getByRole('button', { name: 'Add 2 tasks' }));
    expect(
      await within(form).findByText(/Task 2 is longer than 200 characters/),
    ).toBeInTheDocument();
    expect(bulkCalls(backend, '/jobs/j-1/tasks/bulk')).toHaveLength(0);
  });

  it('names every task the API refuses and keeps the text', async () => {
    const user = userEvent.setup();
    setupDetail();
    const form = await openSeveral(user);

    fireEvent.change(within(form).getByLabelText('Tasks'), {
      target: { value: 'Fine\n!Broken\nAlso fine' },
    });
    await user.click(within(form).getByRole('button', { name: 'Add 3 tasks' }));

    expect(await within(form).findByText(/nothing was added/)).toBeInTheDocument();
    const refused = within(form).getByRole('list', { name: 'Tasks refused' });
    expect(refused).toHaveTextContent('Task 2: !Broken');
    expect(refused).toHaveTextContent('This task cannot be added.');
    expect(within(form).getByLabelText('Tasks')).toHaveValue('Fine\n!Broken\nAlso fine');
  });
});

describe('bulk actions on the tasks of a job', () => {
  it('sets the status of the ticked tasks in one call and clears the selection', async () => {
    const user = userEvent.setup();
    const backend = setupDetail();
    const bar = await tick(user, 'Prepare', 'Review');
    expect(within(bar).getByText('2 selected')).toBeInTheDocument();
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set status' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set the status of 2 tasks' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'New status' }),
      'completed',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Update 2 tasks' }));

    expect(await screen.findByText('2 tasks updated')).toBeInTheDocument();
    expect(bulkCalls(backend, '/tasks/bulk').map((call) => call.body)).toEqual([
      { task_ids: ['t-1', 't-2'], action: 'set_status', value: 'completed' },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Bulk actions for tasks' })).toBeNull(),
    );
  });

  it('sets or clears the due date, and adds or removes an assignee', async () => {
    const user = userEvent.setup();
    const backend = setupDetail();

    let bar = await tick(user, 'Prepare');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set due date' }));
    let dialog = await screen.findByRole('dialog', { name: 'Set the due date of 1 task' });
    expect(within(dialog).getByRole('button', { name: 'Update 1 task' })).toBeDisabled();
    expectRequiredFields(dialog, { required: ['New due date'] });
    fireEvent.change(within(dialog).getByLabelText('New due date'), {
      target: { value: '2026-10-25' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Update 1 task' }));
    await waitFor(() => expect(bulkCalls(backend, '/tasks/bulk')).toHaveLength(1));

    bar = await tick(user, 'Prepare');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set due date' }));
    dialog = await screen.findByRole('dialog', { name: 'Set the due date of 1 task' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Clear the due date instead' }));
    await user.click(within(dialog).getByRole('button', { name: 'Update 1 task' }));
    await waitFor(() => expect(bulkCalls(backend, '/tasks/bulk')).toHaveLength(2));

    bar = await tick(user, 'Review');
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Add assignee' }));
    dialog = await screen.findByRole('dialog', { name: 'Assign 1 task to a person' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Person to add' }),
      IDS.cara,
    );
    await user.click(within(dialog).getByRole('button', { name: 'Update 1 task' }));
    await waitFor(() => expect(bulkCalls(backend, '/tasks/bulk')).toHaveLength(3));

    expect(bulkCalls(backend, '/tasks/bulk').map((call) => call.body)).toEqual([
      { task_ids: ['t-1'], action: 'set_due_date', value: '2026-10-25' },
      { task_ids: ['t-1'], action: 'set_due_date', value: null },
      { task_ids: ['t-2'], action: 'add_assignee', value: IDS.cara },
    ]);
  });

  it('deletes the ticked tasks after a confirmation', async () => {
    const user = userEvent.setup();
    const backend = setupDetail();
    const bar = await tick(user, 'Prepare', 'Review');
    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 tasks?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete 2 tasks' }));

    expect(await screen.findByText('2 tasks deleted')).toBeInTheDocument();
    expect(bulkCalls(backend, '/tasks/bulk')[0]?.body).toEqual({
      task_ids: ['t-1', 't-2'],
      action: 'delete',
    });
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Prepare/ })).not.toBeInTheDocument(),
    );
  });

  it('names the task with time against it and keeps the selection', async () => {
    const user = userEvent.setup();
    setupDetail();
    const bar = await tick(user, 'Prepare', 'File');
    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 tasks?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete 2 tasks' }));

    expect(await within(dialog).findByText(/nothing was changed/)).toBeInTheDocument();
    expect(within(dialog).getByText('File')).toBeInTheDocument();
    expect(within(dialog).getByText(/Time is recorded against this task/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Bulk actions for tasks' })).toBeInTheDocument();
  });

  it('offers no selection to a role that cannot edit jobs', async () => {
    setupDetail(READ_ONLY);
    const table = await tasksTable();
    await waitFor(() => expect(within(table).getAllByRole('row').length).toBeGreaterThan(1));
    expect(within(table).queryByRole('checkbox', { name: /^Select / })).toBeNull();
  });
});

describe('bulk actions on the tasks of every job', () => {
  it('acts on tasks of different jobs at once', async () => {
    const user = userEvent.setup();
    const backend = createBackend({
      jobs: [
        makeJob({ id: 'j-1', number: 'J00001', name: 'Year-end accounts' }),
        makeJob({ id: 'j-2', number: 'J00002', name: 'Bookkeeping Q3' }),
      ],
      tasks: [
        makeTask({ id: 't-1', job_id: 'j-1', title: 'Prepare', assignees: [assignee(ada)] }),
        makeTask({ id: 't-2', job_id: 'j-2', title: 'Reconcile' }),
      ],
    });
    server.use(...jobHandlers(backend));
    renderJobPage(<TasksPage />, { route: `${JOBS}/tasks`, path: `${JOBS}/tasks` });

    const table = await screen.findByRole('table', { name: 'Tasks' });
    await user.click(await within(table).findByRole('checkbox', { name: 'Select Prepare' }));
    await user.click(within(table).getByRole('checkbox', { name: 'Select Reconcile' }));
    const bar = await screen.findByRole('region', { name: 'Bulk actions for tasks' });
    await user.click(within(bar).getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('option', { name: 'Set status' }));
    const dialog = await screen.findByRole('dialog', { name: 'Set the status of 2 tasks' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'New status' }),
      'on_hold',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Update 2 tasks' }));

    expect(await screen.findByText('2 tasks updated')).toBeInTheDocument();
    const body = bulkCalls(backend, '/tasks/bulk')[0]?.body as { task_ids: string[] } | undefined;
    expect([...(body?.task_ids ?? [])].sort()).toEqual(['t-1', 't-2']);
    expect(bulkCalls(backend, '/tasks/bulk')[0]?.body).toMatchObject({
      action: 'set_status',
      value: 'on_hold',
    });
  });
});
