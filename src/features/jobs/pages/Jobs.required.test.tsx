import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { expectRequiredFields, isMarkedRequired } from '@/test/requiredFields';
import { findRowAction } from '@/test/rowActions';
import { server } from '@/test/server';

import { job as makeJob } from '../test/fixtures';
import { createBackend, jobHandlers } from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import JobDetailPage from './JobDetailPage';
import JobsPage from './JobsPage';

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

function setupList() {
  server.use(...jobHandlers(createBackend({ jobs: [makeJob({})] })));
  renderJobPage(<JobsPage />, { permissions: OWNER_PERMISSIONS, route: JOBS });
}

async function openRowAction(user: User, action: string) {
  await user.click(await findRowAction('Actions for J00001 Year-end accounts', action));
}

describe('mandatory fields of the job dialogs', () => {
  it('marks the client and the name of a new job, nothing else', async () => {
    const user = userEvent.setup();
    setupList();
    await user.click(await screen.findByRole('button', { name: 'New job' }));
    const form = await screen.findByRole('region', { name: 'New job' });
    await within(form).findByRole('combobox', { name: 'Client' });
    expectRequiredFields(form, {
      required: ['Job name'],
      optional: [
        'Description',
        'Service',
        'Billing',
        'Hours budget',
        'Fee budget (£)',
        'Start date',
        'Due date',
      ],
    });
    expect(isMarkedRequired(within(form).getByRole('combobox', { name: 'Client' }))).toBe(true);
  });

  it('marks the name of the edited job but not the client, which is fixed', async () => {
    const user = userEvent.setup();
    setupList();
    await openRowAction(user, 'Edit');
    const form = await screen.findByRole('region', { name: 'Edit job' });
    expectRequiredFields(form, { required: ['Job name'], optional: ['Description', 'Manager'] });
  });

  it('marks the name and the client of a copy', async () => {
    const user = userEvent.setup();
    setupList();
    await openRowAction(user, 'Copy');
    const form = await screen.findByRole('dialog', { name: 'Copy job' });
    expectRequiredFields(form, {
      required: ['Name of the new job'],
      optional: ['Start date', 'Due date'],
    });
  });

  it('marks the title of a task', async () => {
    const user = userEvent.setup();
    server.use(...jobHandlers(createBackend({ jobs: [makeJob({})] })));
    renderJobPage(<JobDetailPage />, {
      permissions: OWNER_PERMISSIONS,
      route: `${JOBS}/j-1`,
      path: `${JOBS}/:jobId`,
    });
    await user.click(await screen.findByRole('button', { name: 'Add task' }));
    const form = await screen.findByRole('region', { name: 'Add task' });
    expectRequiredFields(form, {
      required: ['Title'],
      optional: ['Description', 'Due date', 'Hours budget', 'Starts as'],
    });
  });
});
