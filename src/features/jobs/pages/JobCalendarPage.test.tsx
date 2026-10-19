import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { assignee, ben, job as makeJob, task as makeTask } from '../test/fixtures';
import { callsOf, createBackend, jobHandlers, type JobsBackend } from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import JobCalendarPage from './JobCalendarPage';

const CALENDAR = `${JOBS}/calendar`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(init: Partial<JobsBackend> = {}, options: { route?: string } = {}) {
  const backend = createBackend({
    jobs: [
      makeJob({
        id: 'j-1',
        number: 'J00001',
        name: 'Year-end accounts',
        start_date: '2026-10-01',
        due_date: '2026-10-30',
      }),
      makeJob({
        id: 'j-2',
        number: 'J00002',
        name: 'Payroll set-up',
        start_date: '2026-11-09',
        due_date: '2026-11-20',
        assignee_user_ids: [],
      }),
      makeJob({
        id: 'j-3',
        number: 'J00003',
        name: 'Undated job',
        start_date: null,
        due_date: null,
      }),
    ],
    tasks: [
      makeTask({
        id: 't-1',
        job_id: 'j-1',
        title: 'Prepare the trial balance',
        due_date: '2026-10-12',
        assignees: [assignee(ben)],
      }),
    ],
    ...init,
  });
  server.use(...jobHandlers(backend));
  renderJobPage(<JobCalendarPage />, {
    permissions: OWNER_PERMISSIONS,
    route: options.route ?? CALENDAR,
    path: CALENDAR,
  });
  return backend;
}

const requests = (backend: JobsBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/jobs/calendar');

describe('the job calendar', () => {
  it('shows the jobs of the month and draws them and their tasks on their days', async () => {
    const backend = setup();

    expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(requests(backend)[0]?.params?.get('from')).toBe('2026-10-01');
    expect(requests(backend)[0]?.params?.get('to')).toBe('2026-10-31');

    const running = await screen.findByRole('list', { name: 'Jobs in this month' });
    expect(within(running).getAllByRole('listitem')).toHaveLength(1);
    expect(running).toHaveTextContent('J00001 Year-end accounts');
    expect(running).toHaveTextContent('01/10/2026 - 30/10/2026');
    expect(running).toHaveTextContent('In progress');

    const grid = screen.getByRole('list', { name: 'Calendar of October 2026' });
    const twelfth = within(grid).getByLabelText('12/10/2026');
    expect(
      within(twelfth).getByRole('link', { name: /Task: Prepare the trial balance/ }),
    ).toHaveAttribute('href', '/acme/jobs/j-1');
    // The job is marked on the day it starts and on the day it falls due.
    expect(within(within(grid).getByLabelText('01/10/2026')).getByRole('link')).toHaveTextContent(
      'Job: Year-end accounts',
    );
    expect(within(within(grid).getByLabelText('30/10/2026')).getByRole('link')).toHaveTextContent(
      'Job: Year-end accounts',
    );
    expect(screen.queryByText('Undated job')).not.toBeInTheDocument();
  });

  it('moves to the next and the previous month and back to this one', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await screen.findByRole('heading', { name: 'October 2026' });

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    expect(requests(backend).at(-1)?.params?.get('from')).toBe('2026-11-01');
    expect(requests(backend).at(-1)?.params?.get('to')).toBe('2026-11-30');
    expect(await screen.findByText(/J00002 Payroll set-up/)).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toContain('month=2026-11');

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
    expect(await screen.findByText('Nothing is planned for September 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'This month' }));
    expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).not.toContain('month=');
  });

  it('shows only the work of the caller when asked', async () => {
    const user = userEvent.setup();
    const backend = setup({}, { route: `${CALENDAR}?month=2026-11` });
    await screen.findByRole('heading', { name: 'November 2026' });
    expect(await screen.findByText(/J00002 Payroll set-up/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Show'), 'My work');
    await waitFor(() =>
      expect(requests(backend).at(-1)?.params?.get('assignee_user_id')).toBe('me'),
    );
    expect(await screen.findByText('Nothing is planned for November 2026')).toBeInTheDocument();
  });

  it('opens the month of the address and ignores one it cannot read', async () => {
    const backend = setup({}, { route: `${CALENDAR}?month=2026-13` });
    expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(requests(backend)[0]?.params?.get('from')).toBe('2026-10-01');
  });
});
