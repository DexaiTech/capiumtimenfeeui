import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { entry as timeEntry } from '@/features/time/test/fixtures';
import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { findRowAction } from '@/test/rowActions';
import { server } from '@/test/server';

import { ada, assignee, ben, IDS, job as makeJob, task as makeTask } from '../test/fixtures';
import { callsOf, createBackend, jobHandlers, type JobsBackend } from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import JobDetailPage from './JobDetailPage';

const READ_ONLY = ['organization.read', 'member.read', 'client.read', 'job.read'];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

const tasks = () => [
  makeTask({
    id: 't-1',
    title: 'Prepare the trial balance',
    status: 'in_progress',
    due_date: '2026-10-12',
    is_overdue: true,
    budget_minutes: 480,
    logged_minutes: 120,
    assignees: [assignee(ben)],
  }),
  makeTask({ id: 't-2', title: 'File the accounts', status: 'completed', due_date: '2026-10-28' }),
];

function setup(
  init: Partial<JobsBackend> = {},
  options: { permissions?: string[]; jobId?: string } = {},
) {
  const backend = createBackend({
    jobs: [makeJob({ task_counts: { total: 2, completed: 1 } })],
    tasks: tasks(),
    ...init,
  });
  server.use(...jobHandlers(backend));
  renderJobPage(<JobDetailPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: `${JOBS}/${options.jobId ?? 'j-1'}`,
    path: `${JOBS}/:jobId`,
  });
  return backend;
}

const tasksTable = () => screen.findByRole('table', { name: 'Tasks of J00001' });
const dialog = (name: string) => screen.findByRole('dialog', { name });
const panel = (name: string) => screen.findByRole('region', { name });

describe('a job on its page', () => {
  it('shows the job with its figures, details and budget', async () => {
    setup();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'J00001 Year-end accounts' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Job List' })).toHaveAttribute(
      'href',
      '/acme/jobs',
    );
    const figures = screen.getByLabelText('Figures of the job');
    expect(figures).toHaveTextContent('Time logged10:00of 40:00 budgeted');
    expect(figures).toHaveTextContent('Time value£950.00');
    expect(figures).toHaveTextContent('Work in progress£950.00');
    expect(figures).toHaveTextContent('Billed£0.00');
    expect(
      within(figures).getByRole('progressbar', { name: 'Hours budget of J00001' }),
    ).toHaveAttribute('aria-valuetext', '25%');

    expect(screen.getByRole('link', { name: 'Acme Ltd' })).toHaveAttribute(
      'href',
      `/acme/clients/${IDS.acme}`,
    );
    expect(screen.getByText('30/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Due in 12 days')).toBeInTheDocument();
    const manager = screen.getByText('Manager').closest('div') as HTMLElement;
    expect(await within(manager).findByText('Ben Carter')).toBeInTheDocument();

    expect(await screen.findByText('30:00 left')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Change the status of J00001 Year-end accounts' }),
    ).toHaveTextContent('In progress');
  });

  it('says so when the job does not exist', async () => {
    setup({}, { jobId: 'nope' });
    expect(await screen.findByText('This job does not exist')).toBeInTheDocument();
  });

  it('offers a reader nothing to change', async () => {
    setup({}, { permissions: READ_ONLY });

    await screen.findByRole('heading', { level: 1, name: 'J00001 Year-end accounts' });
    for (const name of ['Edit', 'Copy', 'Delete', 'Add task', 'Re-evaluate alerts']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(
      screen.queryByRole('button', { name: 'Change the status of J00001 Year-end accounts' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Figures of the job')).toBeInTheDocument();
  });

  it('lets a reader change the status of their own tasks only', async () => {
    setup(
      {
        tasks: [
          makeTask({
            id: 't-1',
            title: 'Prepare the trial balance',
            status: 'in_progress',
            assignees: [assignee(ben)],
          }),
          makeTask({ id: 't-2', title: 'File the accounts', assignees: [assignee(ada)] }),
        ],
      },
      { permissions: READ_ONLY },
    );

    await tasksTable();
    expect(
      await screen.findByRole('button', { name: 'Change the status of File the accounts' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Change the status of Prepare the trial balance' }),
    ).not.toBeInTheDocument();
  });
});

describe('the status of a job', () => {
  const picker = () =>
    screen.findByRole('button', { name: 'Change the status of J00001 Year-end accounts' });

  it('lists what the status may move to and moves it', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await picker());

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Mark completedBecomes Completed',
      'Put on holdBecomes On hold',
      'CloseBecomes Closed',
      'CancelBecomes Cancelled',
    ]);
    await user.click(screen.getByRole('option', { name: /Mark completed/ }));

    expect(await screen.findByText('Status changed')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]).toMatchObject({
      path: '/jobs/j-1/status',
      body: { status: 'completed' },
    });
    expect(
      await screen.findByRole('button', { name: 'Change the status of J00001 Year-end accounts' }),
    ).toHaveTextContent('Completed');
  });

  it('asks before closing, and says what it means', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await picker());
    await user.click(screen.getByRole('option', { name: /^Close/ }));

    const confirm = await dialog('Close this job?');
    expect(confirm).toHaveTextContent('takes no new time and its tasks cannot be changed');
    expect(callsOf(backend, 'POST')).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Close job' }));

    expect(await screen.findByText('Status changed')).toBeInTheDocument();
    expect(backend.jobs[0]?.status).toBe('closed');
  });

  it('locks the tasks of a closed job', async () => {
    setup({ jobs: [makeJob({ status: 'closed', task_counts: { total: 2, completed: 1 } })] });

    await tasksTable();
    expect(
      screen.getByText(/Tasks cannot be changed while the job is closed or cancelled/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add task' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Actions for File the accounts' }),
    ).not.toBeInTheDocument();
  });
});

describe('the tasks of a job', () => {
  it('lists them with their status, assignees, due date and hours', async () => {
    setup();
    const table = await tasksTable();
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(3));

    const [first, second] = within(table).getAllByRole('row').slice(1) as [
      HTMLElement,
      HTMLElement,
    ];
    expect(first).toHaveTextContent('Prepare the trial balance');
    expect(first).toHaveTextContent('In progress');
    expect(first).toHaveTextContent('Ben Carter');
    expect(first).toHaveTextContent('12/10/2026');
    expect(within(first).getByText('Overdue')).toBeInTheDocument();
    expect(first).toHaveTextContent('2:00 of 8:00');
    expect(second).toHaveTextContent('Completed');
    expect(screen.getByText('1 of 2 completed')).toBeInTheDocument();
  });

  it('adds a task with a due date inside the job, assigned to somebody', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await tasksTable();
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    const form = await panel('Add task');

    await user.type(within(form).getByLabelText('Title'), 'Review the draft');
    fireEvent.change(within(form).getByLabelText('Due date'), { target: { value: '2026-11-15' } });
    await user.click(within(form).getByRole('button', { name: 'Add task' }));
    expect(
      await within(form).findByText(
        'The due date must be within the dates of the job (01/10/2026 - 30/10/2026)',
      ),
    ).toBeInTheDocument();
    expect(callsOf(backend, 'POST')).toHaveLength(0);

    fireEvent.change(within(form).getByLabelText('Due date'), { target: { value: '2026-10-20' } });
    await user.click(within(form).getByRole('button', { name: 'Assignees of the new task' }));
    await user.click(await screen.findByRole('option', { name: /Cara Diaz/ }));
    await user.keyboard('{Escape}');
    await user.click(within(form).getByRole('button', { name: 'Add task' }));

    expect(await screen.findByText('Task added')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')[0]?.body).toEqual({
      title: 'Review the draft',
      status: 'not_started',
      due_date: '2026-10-20',
      assignee_user_ids: [IDS.cara],
    });
    expect(await screen.findByRole('row', { name: /Review the draft/ })).toHaveTextContent(
      'Cara Diaz',
    );
  });

  it('keeps the form open for the next task with "Save and add another"', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await tasksTable();
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    const form = await panel('Add task');

    await user.type(within(form).getByLabelText('Title'), 'First task');
    await user.click(within(form).getByRole('button', { name: 'Save and add another' }));
    await waitFor(() => expect(callsOf(backend, 'POST')).toHaveLength(1));
    // Still open, emptied and ready for the next title.
    await waitFor(() => expect(within(form).getByLabelText('Title')).toHaveValue(''));
    await waitFor(() => expect(within(form).getByLabelText('Title')).toHaveFocus());

    await user.type(within(form).getByLabelText('Title'), 'Second task');
    await user.click(within(form).getByRole('button', { name: 'Add task' }));
    await waitFor(() => expect(callsOf(backend, 'POST')).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Add task' })).not.toBeInTheDocument(),
    );
    expect(callsOf(backend, 'POST').map((call) => (call.body as { title: string }).title)).toEqual([
      'First task',
      'Second task',
    ]);
  });

  it('changes the status of a task from its row', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await tasksTable();
    await user.click(
      await screen.findByRole('button', { name: 'Change the status of Prepare the trial balance' }),
    );
    await user.click(screen.getByRole('option', { name: 'Completed' }));

    await waitFor(() =>
      expect(callsOf(backend, 'POST').find((call) => call.path.endsWith('/status'))?.body).toEqual({
        status: 'completed',
      }),
    );
    expect(await screen.findByText('2 of 2 completed')).toBeInTheDocument();
  });

  it('sets who a task is assigned to when the list closes', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await tasksTable();
    await user.click(await screen.findByRole('button', { name: 'Assignees of File the accounts' }));
    await user.click(await screen.findByRole('option', { name: /Ben Carter/ }));
    expect(callsOf(backend, 'PUT')).toHaveLength(0);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(callsOf(backend, 'PUT')).toHaveLength(1));
    expect(callsOf(backend, 'PUT')[0]).toMatchObject({
      path: '/jobs/j-1/tasks/t-2/assignees',
      body: { user_ids: [IDS.ben] },
    });
  });

  it('edits a task and sends only what changed', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await tasksTable();
    await user.click(await findRowAction('Actions for File the accounts', 'Edit'));
    const form = await panel('Edit task');

    expect(within(form).getByRole('button', { name: 'Save task' })).toBeDisabled();
    await user.clear(within(form).getByLabelText('Title'));
    await user.type(within(form).getByLabelText('Title'), 'File the annual accounts');
    await user.click(within(form).getByRole('button', { name: 'Save task' }));

    expect(await screen.findByText('Task saved')).toBeInTheDocument();
    expect(callsOf(backend, 'PATCH')[0]).toMatchObject({
      path: '/jobs/j-1/tasks/t-2',
      body: { title: 'File the annual accounts' },
    });
  });

  it('deletes a task after a confirmation, and says why one with time cannot be deleted', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await tasksTable();
    await user.click(await findRowAction('Actions for Prepare the trial balance', 'Delete'));
    let confirm = await dialog('Delete this task?');
    await user.click(within(confirm).getByRole('button', { name: 'Delete task' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'Time is recorded against this task.',
    );
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));

    await user.click(await findRowAction('Actions for File the accounts', 'Delete'));
    confirm = await dialog('Delete this task?');
    await user.click(within(confirm).getByRole('button', { name: 'Delete task' }));

    expect(await screen.findByText('Task deleted')).toBeInTheDocument();
    expect(backend.tasks.map((entry) => entry.id)).toEqual(['t-1']);
  });
});

describe('the people on a job', () => {
  it('sets the assignees when the list closes', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await screen.findByRole('button', { name: 'Assignees of J00001' }));
    await user.click(await screen.findByRole('option', { name: /Cara Diaz/ }));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(callsOf(backend, 'PUT')).toHaveLength(1));
    expect(callsOf(backend, 'PUT')[0]).toMatchObject({
      path: '/jobs/j-1/assignees',
      body: { user_ids: [IDS.ada, IDS.cara] },
    });
  });
});

describe('editing, copying and deleting the job', () => {
  it('edits it and sends only what changed', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const form = await panel('Edit job');

    await user.type(within(form).getByLabelText('Description'), 'Statutory accounts');
    await user.click(within(form).getByRole('button', { name: 'Save job' }));

    expect(await screen.findByText('Job saved')).toBeInTheDocument();
    expect(callsOf(backend, 'PATCH')[0]?.body).toEqual({ description: 'Statutory accounts' });
  });

  it('shows what the linked job owns and locks those fields', async () => {
    const user = userEvent.setup();
    setup({
      jobs: [makeJob({ pm_job_id: 'pm-9', pm_linked_at: '2026-10-05T09:00:00Z' })],
    });
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const form = await panel('Edit job');

    expect(within(form).getByText(/linked to an external job/)).toBeInTheDocument();
    expect(within(form).getByLabelText('Job name')).toBeDisabled();
    expect(within(form).getByLabelText('Due date')).toBeDisabled();
    expect(within(form).getByLabelText('Description')).toBeEnabled();
  });

  it('copies it with its tasks and opens the copy', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await screen.findByRole('button', { name: 'Copy' }));
    const form = await dialog('Copy job');
    await user.click(within(form).getByRole('switch', { name: 'Copy the tasks' }));
    await user.click(within(form).getByRole('button', { name: 'Copy job' }));

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toMatch(/^\/acme\/jobs\/j-copy-/),
    );
    expect(callsOf(backend, 'POST')[0]?.body).toMatchObject({
      copy_tasks: false,
      copy_assignees: true,
    });
  });

  it('deletes it after a confirmation and goes back to the list', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const confirm = await dialog('Delete this job?');
    await user.click(within(confirm).getByRole('button', { name: 'Delete job' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/acme/jobs'));
    expect(backend.jobs).toHaveLength(0);
  });

  it('keeps the confirmation open with the reason when the API refuses the delete', async () => {
    const user = userEvent.setup();
    setup({ inUse: new Set(['j-1']) });
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const confirm = await dialog('Delete this job?');
    await user.click(within(confirm).getByRole('button', { name: 'Delete job' }));

    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'Time is recorded against this job',
    );
  });
});

describe('the time on a job', () => {
  it('lists the time recorded on the job, with delete for open time', async () => {
    const user = userEvent.setup();
    setup({ timeEntries: [timeEntry({ id: 'e-1', entry_date: '2026-10-12', minutes: 90 })] });

    const table = await screen.findByRole('table', { name: 'Time on J00001' });
    expect(await within(table).findByText('1:30')).toBeInTheDocument();
    await user.click(
      await findRowAction(/^Actions for the entry of 1:30 on 12\/10\/2026/, 'Delete entry'),
    );
    expect(await dialog('Delete this time entry?')).toBeInTheDocument();
  });

  it("lists one person's time from the budget, then everyone's again", async () => {
    const user = userEvent.setup();
    const backend = setup({
      timeEntries: [
        timeEntry({ id: 'e-ada', entry_date: '2026-10-12', minutes: 90 }),
        timeEntry({ id: 'e-ben', user_id: IDS.ben, entry_date: '2026-10-13', minutes: 30 }),
      ],
    });
    const timeTable = () => screen.getByRole('table', { name: 'Time on J00001' });
    const table = await screen.findByRole('table', { name: 'Time on J00001' });
    expect(await within(table).findByText('0:30')).toBeInTheDocument();

    // A person's hours in the budget open their entries, to edit or delete them.
    await user.click(await screen.findByRole('button', { name: /^Show the time of Ada Lovelace/ }));
    await waitFor(() => expect(timeTable()).not.toHaveTextContent('0:30'));
    expect(timeTable()).toHaveTextContent('1:30');
    const asked = callsOf(backend, 'GET').filter((call) => call.path === '/time-entries');
    expect(asked.at(-1)?.params?.get('user_id')).toBe(IDS.ada);
    expect(screen.getByText('The time you recorded on this job.')).toBeInTheDocument();
    expect(
      await findRowAction(/^Actions for the entry of 1:30 on 12\/10\/2026/, 'Edit entry'),
    ).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Show everyone' }));
    await waitFor(() => expect(timeTable()).toHaveTextContent('0:30'));
  });

  it('is left out for someone who may not see time', async () => {
    setup({}, { permissions: READ_ONLY });
    await screen.findByRole('heading', { level: 1, name: 'J00001 Year-end accounts' });
    expect(screen.queryByRole('table', { name: 'Time on J00001' })).not.toBeInTheDocument();
  });
});
