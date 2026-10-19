import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { assignee, ben, IDS, job as makeJob, task as makeTask } from '../test/fixtures';
import { callsOf, createBackend, jobHandlers, type JobsBackend } from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import AssignmentsPage from './AssignmentsPage';

const ASSIGNMENTS = `${JOBS}/assignments`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(init: Partial<JobsBackend> = {}) {
  const backend = createBackend({
    jobs: [
      makeJob({
        id: 'j-1',
        number: 'J00001',
        name: 'Year-end accounts',
        assignee_user_ids: [IDS.ada],
      }),
      makeJob({
        id: 'j-2',
        number: 'J00002',
        name: 'Payroll set-up',
        assignee_user_ids: [IDS.ben],
        status: 'planned',
      }),
      makeJob({
        id: 'j-3',
        number: 'J00003',
        name: 'Finished work',
        assignee_user_ids: [IDS.ada],
        status: 'completed',
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
        assignees: [assignee(ben), { user_id: IDS.ada, full_name: 'Ada Lovelace' }],
      }),
      makeTask({
        id: 't-2',
        job_id: 'j-1',
        title: 'Send the questionnaire',
        due_date: '2026-10-22',
        assignees: [{ user_id: IDS.ada, full_name: 'Ada Lovelace' }],
      }),
      makeTask({
        id: 't-3',
        job_id: 'j-2',
        title: 'Collect the payroll data',
        due_date: '2026-12-01',
        assignees: [assignee(ben)],
      }),
      makeTask({
        id: 't-4',
        job_id: 'j-1',
        title: 'Already done',
        status: 'completed',
        assignees: [{ user_id: IDS.ada, full_name: 'Ada Lovelace' }],
      }),
    ],
    ...init,
  });
  server.use(...jobHandlers(backend));
  renderJobPage(<AssignmentsPage />, {
    permissions: OWNER_PERMISSIONS,
    route: ASSIGNMENTS,
    path: ASSIGNMENTS,
  });
  return backend;
}

const loaded = async (name: string) => {
  const element = await screen.findByRole('table', { name });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

describe('assignments', () => {
  it("shows the caller's open jobs and tasks and the workload they make", async () => {
    const backend = setup();
    const jobs = await loaded('Assigned jobs');
    const tasks = await loaded('Assigned tasks');

    const jobRequest = callsOf(backend, 'GET').find((call) => call.path === '/jobs');
    expect(jobRequest?.params?.get('assignee')).toBe('me');
    expect(jobRequest?.params?.getAll('status')).toEqual(['planned', 'in_progress', 'on_hold']);
    const taskRequest = callsOf(backend, 'GET').find((call) => call.path === '/tasks');
    expect(taskRequest?.params?.get('assignee_user_id')).toBe('me');
    expect(taskRequest?.params?.getAll('status')).toEqual([
      'not_started',
      'in_progress',
      'on_hold',
    ]);

    // Only open work of the caller: not Ben's job, not the completed job or task.
    expect(within(jobs).getAllByRole('row').slice(1)).toHaveLength(1);
    expect(jobs).toHaveTextContent('Year-end accounts');
    expect(within(tasks).getAllByRole('row').slice(1)).toHaveLength(2);

    const workload = screen.getByLabelText('Workload');
    expect(workload).toHaveTextContent('Open jobs1');
    expect(workload).toHaveTextContent('Open tasks2');
    expect(workload).toHaveTextContent('Overdue tasks1');
    expect(workload).toHaveTextContent('Due in the next 7 days1');
  });

  it('switches to another person', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await loaded('Assigned jobs');

    await user.selectOptions(screen.getByLabelText('Person'), 'Ben Carter');
    await waitFor(() =>
      expect(
        callsOf(backend, 'GET')
          .filter((call) => call.path === '/jobs')
          .at(-1)
          ?.params?.get('assignee'),
      ).toBe(IDS.ben),
    );
    await waitFor(() =>
      expect(screen.getByRole('table', { name: 'Assigned jobs' })).toHaveTextContent(
        'Payroll set-up',
      ),
    );
    expect(screen.getByRole('table', { name: 'Assigned tasks' })).toHaveTextContent(
      'Collect the payroll data',
    );
    expect(screen.getByLabelText('Workload')).toHaveTextContent('Open jobs1');
  });

  it('says when nothing open is assigned', async () => {
    setup({ jobs: [], tasks: [] });
    expect(await screen.findByText('No open jobs')).toBeInTheDocument();
    expect(await screen.findByText('No open tasks')).toBeInTheDocument();
    expect(screen.getByLabelText('Workload')).toHaveTextContent('Open jobs0');
  });

  it('marks a count that is read from the first rows only', async () => {
    setup({ pageSize: 1 });
    await loaded('Assigned tasks');
    await waitFor(() =>
      expect(screen.getByLabelText('Workload')).toHaveTextContent('Open tasks1+'),
    );
    expect(
      screen.getByText(/A figure with a \+ is counted from the first rows only/),
    ).toBeInTheDocument();
  });
});
