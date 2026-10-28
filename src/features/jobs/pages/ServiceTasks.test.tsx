import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { fail, server } from '@/test/server';

import { IDS, job as makeJob, task as makeTask } from '../test/fixtures';
import {
  callsOf,
  createBackend,
  jobHandlers,
  orgApiPath,
  type JobsBackend,
} from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import JobDetailPage from './JobDetailPage';
import JobsPage from './JobsPage';

type User = ReturnType<typeof userEvent.setup>;

const READ_ONLY = ['organization.read', 'member.read', 'client.read', 'job.read'];
const DEFAULTS = "Add the service's default tasks";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

function setupList(init: Partial<JobsBackend> = {}) {
  const backend = createBackend({ jobs: [makeJob({})], ...init });
  server.use(...jobHandlers(backend));
  renderJobPage(<JobsPage />, { permissions: OWNER_PERMISSIONS, route: JOBS });
  return backend;
}

async function openNewJob(user: User, name = 'Monthly payroll') {
  await user.click(await screen.findByRole('button', { name: 'New job' }));
  const form = await screen.findByRole('region', { name: 'New job' });
  await user.click(within(form).getByRole('combobox', { name: 'Client' }));
  await user.click(await screen.findByRole('option', { name: /Acme Ltd/ }));
  await user.type(within(form).getByLabelText('Job name'), name);
  return form;
}

const defaultTasksSwitch = (form: HTMLElement) =>
  within(form).queryByRole('switch', { name: /default tasks?$/ });

describe('starting a job with the default tasks of its service', () => {
  it('offers the switch, on, with the titles, only for a service that has default tasks', async () => {
    const user = userEvent.setup();
    setupList();
    const form = await openNewJob(user);
    expect(defaultTasksSwitch(form)).not.toBeInTheDocument();

    await user.selectOptions(await within(form).findByLabelText('Service'), 'Audit');
    expect(defaultTasksSwitch(form)).not.toBeInTheDocument();

    await user.selectOptions(within(form).getByLabelText('Service'), 'Payroll');
    const toggle = await within(form).findByRole('switch', {
      name: "Add this service's 2 default tasks",
    });
    expect(toggle).toBeChecked();
    expect(await within(form).findByText('Collect payroll inputs')).toBeInTheDocument();
    expect(within(form).getByText('Run the payroll')).toBeInTheDocument();

    // Back to a service without any: the switch goes away.
    await user.selectOptions(within(form).getByLabelText('Service'), 'No service');
    expect(defaultTasksSwitch(form)).not.toBeInTheDocument();
  });

  it('says that due dates count from the start date, or that there are none without one', async () => {
    const user = userEvent.setup();
    setupList();
    const form = await openNewJob(user);
    await user.selectOptions(await within(form).findByLabelText('Service'), 'Payroll');
    // The start date opens on today: empty it to see the hint for a job without one.
    fireEvent.change(within(form).getByLabelText('Start date'), { target: { value: '' } });
    expect(
      await within(form).findByText(/Set a start date to give these tasks due dates/),
    ).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText('Start date'), {
      target: { value: '2026-10-20' },
    });
    expect(
      await within(form).findByText(/fall that many days after the start date/),
    ).toBeInTheDocument();
  });

  it('sends add_default_tasks: true when the switch is on, and the job gets its tasks', async () => {
    const user = userEvent.setup();
    const backend = setupList();
    const form = await openNewJob(user);
    await user.selectOptions(await within(form).findByLabelText('Service'), 'Payroll');
    await within(form).findByText('Run the payroll');
    await user.click(within(form).getByRole('button', { name: 'Create job' }));

    await waitFor(() => expect(callsOf(backend, 'POST')).toHaveLength(1));
    expect(callsOf(backend, 'POST')[0]?.body).toMatchObject({
      service_id: IDS.payroll,
      add_default_tasks: true,
    });
    expect(backend.jobs.at(-1)?.task_counts.total).toBe(2);
  });

  it('leaves add_default_tasks out when the switch is turned off', async () => {
    const user = userEvent.setup();
    const backend = setupList();
    const form = await openNewJob(user);
    await user.selectOptions(await within(form).findByLabelText('Service'), 'Payroll');
    await user.click(await within(form).findByRole('switch', { name: /default tasks$/ }));
    expect(within(form).queryByText('Run the payroll')).not.toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Create job' }));

    await waitFor(() => expect(callsOf(backend, 'POST')).toHaveLength(1));
    expect(callsOf(backend, 'POST')[0]?.body).not.toHaveProperty('add_default_tasks');
    expect(backend.jobs.at(-1)?.task_counts.total).toBe(0);
  });

  it('does not send it for a service without default tasks', async () => {
    const user = userEvent.setup();
    const backend = setupList();
    const form = await openNewJob(user);
    await user.selectOptions(await within(form).findByLabelText('Service'), 'Audit');
    await user.click(within(form).getByRole('button', { name: 'Create job' }));

    await waitFor(() => expect(callsOf(backend, 'POST')).toHaveLength(1));
    expect(callsOf(backend, 'POST')[0]?.body).not.toHaveProperty('add_default_tasks');
  });

  it('shows nothing when editing a job, even one of a service with default tasks', async () => {
    const user = userEvent.setup();
    setupList({ jobs: [makeJob({ service_id: IDS.payroll, service_name: 'Payroll' })] });
    await user.click(
      await screen.findByRole('button', { name: 'Actions for J00001 Year-end accounts' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('region', { name: 'Edit job' });
    expect(within(form).getByLabelText('Service')).toHaveValue(IDS.payroll);
    expect(defaultTasksSwitch(form)).not.toBeInTheDocument();
    expect(within(form).queryByText('Run the payroll')).not.toBeInTheDocument();
  });
});

describe('adding the default tasks of the service to an existing job', () => {
  function setupDetail(
    init: Partial<JobsBackend> = {},
    permissions: string[] = OWNER_PERMISSIONS,
    job = makeJob({ service_id: IDS.payroll, service_name: 'Payroll' }),
  ) {
    const backend = createBackend({ jobs: [job], ...init });
    server.use(...jobHandlers(backend));
    renderJobPage(<JobDetailPage />, {
      permissions,
      route: `${JOBS}/j-1`,
      path: `${JOBS}/:jobId`,
    });
    return backend;
  }

  it('offers the button in the empty state and the toolbar, and adds the tasks', async () => {
    const user = userEvent.setup();
    const backend = setupDetail();
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
    const buttons = await screen.findAllByRole('button', { name: DEFAULTS });
    expect(buttons).toHaveLength(2);

    await user.click(buttons[0] as HTMLElement);
    expect(await screen.findByText('2 tasks added')).toBeInTheDocument();
    expect(callsOf(backend, 'POST').map((call) => call.path)).toEqual([
      '/jobs/j-1/tasks/from-service',
    ]);
    // The list is refreshed.
    const table = await screen.findByRole('table', { name: 'Tasks of J00001' });
    expect(await within(table).findByText('Collect payroll inputs')).toBeInTheDocument();
    expect(within(table).getByText('Run the payroll')).toBeInTheDocument();
  });

  it('keeps it in the toolbar when there are tasks, and says how many were already there', async () => {
    const user = userEvent.setup();
    setupDetail({
      tasks: [makeTask({ id: 't-1', job_id: 'j-1', title: 'Run the payroll' })],
    });
    const button = await screen.findByRole('button', { name: DEFAULTS });
    await user.click(button);
    expect(await screen.findByText('1 task added')).toBeInTheDocument();
    expect(screen.getByText('1 already there')).toBeInTheDocument();
  });

  it('is hidden when the service has no default tasks, or the job has no service', async () => {
    setupDetail({}, OWNER_PERMISSIONS, makeJob({ service_id: IDS.audit, service_name: 'Audit' }));
    await screen.findByText('No tasks yet');
    expect(screen.getAllByRole('button', { name: 'Add task' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: DEFAULTS })).not.toBeInTheDocument();
  });

  it('is hidden for a job without a service', async () => {
    setupDetail({}, OWNER_PERMISSIONS, makeJob({}));
    await screen.findByText('No tasks yet');
    expect(screen.queryByRole('button', { name: DEFAULTS })).not.toBeInTheDocument();
  });

  it('is hidden without job.update and on a closed job', async () => {
    const first = setupDetail({}, READ_ONLY);
    await screen.findByText('No tasks yet');
    expect(screen.queryByRole('button', { name: DEFAULTS })).not.toBeInTheDocument();
    expect(callsOf(first, 'POST')).toHaveLength(0);
  });

  it('is hidden on a closed job', async () => {
    setupDetail(
      {},
      OWNER_PERMISSIONS,
      makeJob({ service_id: IDS.payroll, service_name: 'Payroll', status: 'closed' }),
    );
    await screen.findByText('No tasks yet');
    expect(screen.queryByRole('button', { name: DEFAULTS })).not.toBeInTheDocument();
  });

  it("shows the API's refusal as a toast", async () => {
    const user = userEvent.setup();
    setupDetail();
    server.use(
      http.post(orgApiPath('/jobs/j-1/tasks/from-service'), () =>
        fail(409, 'SERVICE_HAS_NO_TASKS', "This job's service has no default tasks."),
      ),
    );
    await user.click((await screen.findAllByRole('button', { name: DEFAULTS }))[0] as HTMLElement);
    expect(await screen.findByText("This job's service has no default tasks.")).toBeInTheDocument();
    expect(screen.getByText("Could not add the service's default tasks")).toBeInTheDocument();
  });
});
