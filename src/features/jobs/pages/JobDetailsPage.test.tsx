import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { job as makeJob, task as makeTask } from '../test/fixtures';
import { createBackend, jobHandlers, type JobsBackend } from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import JobDetailsPage from './JobDetailsPage';

const DETAILS = `${JOBS}/details`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(options: { route?: string; init?: Partial<JobsBackend> } = {}) {
  const backend = createBackend({
    jobs: [
      makeJob({
        id: 'j-1',
        number: 'J00001',
        name: 'Year-end accounts',
        task_counts: { total: 1, completed: 0 },
      }),
      makeJob({ id: 'j-2', number: 'J00002', name: 'Payroll set-up' }),
    ],
    tasks: [makeTask({ id: 't-1', job_id: 'j-1', title: 'Prepare the trial balance' })],
    ...options.init,
  });
  server.use(...jobHandlers(backend));
  renderJobPage(<JobDetailsPage />, {
    permissions: OWNER_PERMISSIONS,
    route: options.route ?? DETAILS,
    path: DETAILS,
  });
  return backend;
}

describe('job details', () => {
  it('asks for a job to be picked, and shows it once it is', async () => {
    const user = userEvent.setup();
    setup();

    expect(await screen.findByText('Pick a job')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Job' }));
    await user.click(await screen.findByRole('option', { name: /Year-end accounts/ }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'J00001 Year-end accounts' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/acme/jobs/details?job=j-1');
    expect(screen.getByLabelText('Figures of the job')).toHaveTextContent('Time logged10:00');
    expect(screen.getByRole('link', { name: /Open the job page/ })).toHaveAttribute(
      'href',
      '/acme/jobs/j-1',
    );
    const tasks = await screen.findByRole('table', { name: 'Tasks of J00001' });
    await waitFor(() => expect(tasks).toHaveTextContent('Prepare the trial balance'));
  });

  it('opens the job of the address', async () => {
    setup({ route: `${DETAILS}?job=j-2` });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'J00002 Payroll set-up' }),
    ).toBeInTheDocument();
    expect(
      within(await screen.findByRole('table', { name: 'Tasks of J00002' })).getAllByRole('row'),
    ).toBeTruthy();
  });

  it('says so when the job does not exist', async () => {
    setup({ route: `${DETAILS}?job=nope` });
    expect(await screen.findByText('This job does not exist')).toBeInTheDocument();
  });
});
