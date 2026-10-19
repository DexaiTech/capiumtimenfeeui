import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { IDS, job as makeJob } from '../test/fixtures';
import { callsOf, createBackend, jobHandlers, type JobsBackend } from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import BudgetTrackingPage from './BudgetTrackingPage';

const BUDGETS = `${JOBS}/budgets`;

function jobs() {
  return [
    makeJob({
      id: 'j-1',
      number: 'J00001',
      name: 'Year-end accounts',
      budget_minutes_used_bp: 2500,
    }),
    makeJob({
      id: 'j-2',
      number: 'J00002',
      name: 'Payroll set-up',
      client_id: IDS.globex,
      client_name: 'Globex plc',
      budget_minutes_used_bp: 9500,
      logged_minutes: 2280,
    }),
    makeJob({
      id: 'j-3',
      number: 'J00003',
      name: 'Tax review',
      budget_minutes_used_bp: 12000,
      logged_minutes: 2880,
      manager_user_id: null,
    }),
    makeJob({
      id: 'j-4',
      number: 'J00004',
      name: 'No budget job',
      budget_minutes: null,
      budget_minutes_used_bp: null,
    }),
    makeJob({
      id: 'j-5',
      number: 'J00005',
      name: 'Old closed job',
      status: 'closed',
      budget_minutes_used_bp: 5000,
    }),
  ];
}

function setup(init: Partial<JobsBackend> = {}, options: { route?: string } = {}) {
  const backend = createBackend({ jobs: jobs(), ...init });
  server.use(...jobHandlers(backend));
  renderJobPage(<BudgetTrackingPage />, {
    permissions: OWNER_PERMISSIONS,
    route: options.route ?? BUDGETS,
    path: BUDGETS,
  });
  return backend;
}

const lists = (backend: JobsBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/jobs/budgets');

const table = async () => {
  const element = await screen.findByRole('table', { name: 'Job budgets' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

describe('budget tracking', () => {
  it('lists the open jobs that have a budget, the most used first, with the totals', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.getAll('status')).toEqual([
      'planned',
      'in_progress',
      'on_hold',
    ]);
    expect(lists(backend)[0]?.params?.get('sort')).toBe('used');
    expect(lists(backend)[0]?.params?.get('order')).toBe('desc');
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => within(row).getByRole('link').getAttribute('href'))).toEqual([
      '/acme/jobs/j-3',
      '/acme/jobs/j-2',
      '/acme/jobs/j-1',
    ]);
    expect(rows[0]).toHaveTextContent('120%');
    expect(rows[0]).toHaveTextContent('Over budget');
    expect(rows[1]).toHaveTextContent('95%');
    expect(rows[1]).toHaveTextContent('Nearing budget');
    expect(rows[1]).toHaveTextContent('38:00 of 40:00');
    expect(rows[2]).toHaveTextContent('On budget');
    expect(rows[2]).toHaveTextContent('Ben Carter');

    const totals = screen.getByLabelText('Totals of the budgets');
    expect(totals).toHaveTextContent('Jobs with a budget3');
    expect(totals).toHaveTextContent('1 over, 1 nearing, 1 on budget');
  });

  it('narrows to a traffic light and to a status', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('tab', { name: 'Over budget' }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('used_from_bp')).toBe('10000'));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).toHaveTextContent('Tax review');

    await user.click(screen.getByRole('tab', { name: 'Nearing budget' }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('used_to_bp')).toBe('9999'));
    expect(lists(backend).at(-1)?.params?.get('used_from_bp')).toBe('8000');

    await user.click(screen.getByRole('tab', { name: 'All budgets' }));
    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter budgets' });
    await user.selectOptions(within(panel).getByLabelText('Jobs'), 'Every status');
    await waitFor(() => expect(lists(backend).at(-1)?.params?.getAll('status')).toEqual([]));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(4));
    expect(screen.getByRole('table')).toHaveTextContent('Old closed job');
  });

  it('sorts by the header the person clicks, through the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /^Due/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('sort')).toBe('due_date'));
    expect(lists(backend).at(-1)?.params?.get('order')).toBe('asc');
  });

  it('says when no job has a budget', async () => {
    setup({ jobs: [jobs()[3] as ReturnType<typeof makeJob>] });
    expect(await screen.findByText('No jobs with a budget')).toBeInTheDocument();
  });

  it('says when nothing matches the filters, and clears them', async () => {
    const user = userEvent.setup();
    setup();
    await table();
    await user.type(screen.getByRole('searchbox', { name: 'Search budgets' }), 'zzz');
    expect(await screen.findByText('No budgets match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(3));
  });
});
