import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { fail, ok, server } from '@/test/server';

import { IDS, job as makeJob } from '../test/fixtures';
import {
  callsOf,
  createBackend,
  jobHandlers,
  orgApiPath,
  type JobsBackend,
} from '../test/handlers';
import { JOBS, renderJobPage } from '../test/render';
import JobsPage from './JobsPage';

const READ_ONLY = ['organization.read', 'member.read', 'client.read', 'job.read'];

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
      created_at: '2026-10-02T09:00:00Z',
    }),
    makeJob({
      id: 'j-2',
      number: 'J00002',
      name: 'Bookkeeping Q3',
      client_id: IDS.globex,
      client_name: 'Globex plc',
      client_code: 'GLOB',
      status: 'planned',
      due_date: '2026-10-10',
      manager_user_id: null,
      budget_minutes: null,
      budget_minutes_used_bp: null,
      created_at: '2026-10-03T09:00:00Z',
    }),
    makeJob({
      id: 'j-3',
      number: 'J00003',
      name: 'VAT returns',
      status: 'completed',
      due_date: null,
      created_at: '2026-10-01T09:00:00Z',
    }),
  ];
}

function setup(
  init: Partial<JobsBackend> = {},
  options: { permissions?: string[]; route?: string } = {},
) {
  const backend = createBackend({ jobs: jobs(), ...init });
  server.use(...jobHandlers(backend));
  renderJobPage(<JobsPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? JOBS,
  });
  return backend;
}

const lists = (backend: JobsBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/jobs');

/** The table once the jobs have loaded: while they load it is a skeleton marked `aria-busy`. */
const table = async () => {
  const element = await screen.findByRole('table', { name: 'Jobs' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

describe('the job list', () => {
  it('lists the jobs newest first with their status, client, manager, due date and budget', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.get('sort')).toBe('-created_at');
    expect(rows).toHaveLength(3);
    // Newest first: J00002, J00001, J00003.
    expect(rows.map((row) => within(row).getByRole('link').getAttribute('href'))).toEqual([
      '/acme/jobs/j-2',
      '/acme/jobs/j-1',
      '/acme/jobs/j-3',
    ]);
    const [bookkeeping, yearEnd] = rows as [HTMLElement, HTMLElement];
    expect(bookkeeping).toHaveTextContent('Bookkeeping Q3');
    expect(bookkeeping).toHaveTextContent('Globex plc');
    expect(bookkeeping).toHaveTextContent('Not started');
    expect(bookkeeping).toHaveTextContent('10/10/2026');
    expect(within(bookkeeping).getByText('Overdue')).toBeInTheDocument();
    expect(within(bookkeeping).getByText('No budget')).toBeInTheDocument();

    expect(yearEnd).toHaveTextContent('In progress');
    expect(yearEnd).toHaveTextContent('30/10/2026');
    expect(within(yearEnd).queryByText('Overdue')).not.toBeInTheDocument();
    expect(await within(yearEnd).findByText('Ben Carter')).toBeInTheDocument();
    expect(
      within(yearEnd).getByRole('progressbar', { name: 'Budget used on J00001' }),
    ).toHaveAttribute('aria-valuetext', '25%');
    expect(yearEnd).toHaveTextContent('£950.00');
    expect(screen.getByText('Showing 3 jobs · End of the list')).toBeInTheDocument();
  });

  it('shows only the jobs of the caller with one click on "My jobs"', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();
    const button = screen.getByRole('button', { name: 'My jobs' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('manager_user_id')).toBe('me'));
    expect(screen.getByRole('button', { name: 'My jobs' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'My jobs' }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('manager_user_id')).toBeNull());
  });

  it('opens a job from any plain part of its row', async () => {
    const user = userEvent.setup();
    setup();
    const rows = rowsOf(await table());
    // The client's name is plain text in the row: no need to aim at the job's link.
    await user.click(within(rows[0] as HTMLElement).getByText('Globex plc'));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/acme/jobs/j-2'));
  });

  it('filters by status, by search and by the filters of the popover, and says when nothing matches', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('tab', { name: 'Completed' }));
    await waitFor(() =>
      expect(lists(backend).at(-1)?.params?.getAll('status')).toEqual(['completed']),
    );
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).toHaveTextContent('VAT returns');

    await user.click(screen.getByRole('tab', { name: 'All jobs' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search jobs' }), 'globex');
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('q')).toBe('globex'));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));

    await user.clear(screen.getByRole('searchbox', { name: 'Search jobs' }));
    // The cleared search reaches the URL after the 300 ms debounce; filter once it has.
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('q')).toBeNull());
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter jobs' });
    await user.selectOptions(within(panel).getByLabelText('Manager'), 'Me');
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('manager_user_id')).toBe('me'));
    expect(await screen.findByText('No jobs match')).toBeInTheDocument();
    expect(screen.getByText(', 1 filters applied')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(3));
  });

  it('sorts by the header the person clicks, through the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /^Due/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('sort')).toBe('due_date'));
    await user.click(screen.getByRole('button', { name: /^Due/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('sort')).toBe('-due_date'));
  });

  it('loads further jobs with the cursor', async () => {
    const user = userEvent.setup();
    const backend = setup({ pageSize: 2 });
    await table();

    expect(await screen.findByText('Showing 2 jobs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Showing 3 jobs · End of the list')).toBeInTheDocument();
    expect(lists(backend).at(-1)?.params?.get('cursor')).toBe('2');
  });

  it('invites the first job when there are none, and shows the error with a retry', async () => {
    const user = userEvent.setup();
    setup({ jobs: [] });
    expect(await screen.findByText('No jobs yet')).toBeInTheDocument();
    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'New job' }));
    expect(await screen.findByRole('region', { name: 'New job' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    let attempts = 0;
    server.use(
      http.get(orgApiPath('/jobs'), () => {
        attempts += 1;
        return attempts === 1
          ? fail(500, 'SERVER_ERROR', 'Something went wrong.')
          : ok([], { meta: { next_cursor: null, has_more: false } });
      }),
      http.get(orgApiPath('/members'), () =>
        ok([], { meta: { next_cursor: null, has_more: false } }),
      ),
    );
    const user = userEvent.setup();
    renderJobPage(<JobsPage />);

    expect(await screen.findByText('Could not load the jobs')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No jobs yet')).toBeInTheDocument();
  });
});

describe('starting a job', () => {
  async function fillClientAndName(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(await screen.findByRole('button', { name: 'New job' }));
    const form = await screen.findByRole('region', { name: 'New job' });
    await user.click(within(form).getByRole('combobox', { name: 'Client' }));
    await user.click(await screen.findByRole('option', { name: /Acme Ltd/ }));
    await user.type(within(form).getByLabelText('Job name'), name);
    return form;
  }

  it('creates the job with what was filled in and opens it', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const form = await fillClientAndName(user, 'Audit 2026');

    await user.type(within(form).getByLabelText('Fee budget (£)'), '2,000');
    await user.click(within(form).getByRole('button', { name: 'Create job' }));

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/acme/jobs/j-new-1'),
    );
    expect(callsOf(backend, 'POST')[0]?.body).toEqual({
      client_id: IDS.acme,
      name: 'Audit 2026',
      billing_basis: 'hourly',
      budget_fee: 200000,
      // A new job and its period start today (the clock of this file is 2026-10-18).
      start_date: '2026-10-18',
      period_start: '2026-10-18',
      status: 'planned',
    });
    expect(backend.jobs.at(-1)?.number).toBe('J00101');
  });

  it('takes the billing and the fixed fee of the service chosen', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const form = await fillClientAndName(user, 'Monthly books');

    await user.selectOptions(await within(form).findByLabelText('Service'), 'Bookkeeping');
    expect(within(form).getByLabelText('Billing')).toHaveValue('fixed');
    expect(within(form).getByLabelText('Fixed fee (£)')).toHaveValue('1200.00');
    await user.click(within(form).getByRole('button', { name: 'Create job' }));

    await waitFor(() => expect(callsOf(backend, 'POST')).toHaveLength(1));
    expect(callsOf(backend, 'POST')[0]?.body).toMatchObject({
      billing_basis: 'fixed',
      service_id: IDS.bookkeeping,
      fixed_fee: 120000,
    });
  });

  it('asks for what is missing before sending anything', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await screen.findByRole('button', { name: 'New job' }));
    const form = await screen.findByRole('region', { name: 'New job' });
    await user.click(within(form).getByRole('button', { name: 'Create job' }));

    expect(await within(form).findByText('Choose the client')).toBeInTheDocument();
    expect(within(form).getByText('Enter the name of the job')).toBeInTheDocument();
    expect(callsOf(backend, 'POST')).toHaveLength(0);
  });

  it('puts the refusal of the API on the field it is about', async () => {
    const user = userEvent.setup();
    setup();
    const form = await fillClientAndName(user, 'Fixed job');
    await user.selectOptions(within(form).getByLabelText('Billing'), 'Fixed fee');
    await user.click(within(form).getByRole('button', { name: 'Create job' }));

    expect(await within(form).findByText('A fixed-fee job needs a fee.')).toBeInTheDocument();
  });

  it('opens the dialog from the link of the quick-create menu (?new=1) and drops the parameter on close', async () => {
    const user = userEvent.setup();
    setup({}, { route: `${JOBS}?new=1` });

    const form = await screen.findByRole('region', { name: 'New job' });
    await user.click(within(form).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('new=1'));
  });
});

describe('the actions of a job', () => {
  const menu = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await table();
    await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  };

  it('offers open, edit, copy and delete to a role that may do all of them', async () => {
    const user = userEvent.setup();
    setup();
    await menu(user, 'J00001 Year-end accounts');

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Open',
      'Edit',
      'Copy',
      'Delete',
    ]);
  });

  it('copies a job and opens the copy', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await menu(user, 'J00001 Year-end accounts');
    await user.click(screen.getByRole('menuitem', { name: 'Copy' }));
    const form = await screen.findByRole('dialog', { name: 'Copy job' });

    expect(within(form).getByLabelText('Name of the new job')).toHaveValue(
      'Copy of Year-end accounts',
    );
    await user.click(within(form).getByRole('button', { name: 'Copy job' }));

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toMatch(/^\/acme\/jobs\/j-copy-/),
    );
    expect(callsOf(backend, 'POST')[0]?.body).toMatchObject({
      name: 'Copy of Year-end accounts',
      client_id: IDS.acme,
      copy_tasks: true,
      copy_assignees: true,
    });
  });

  it('edits a job and sends only what changed', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await menu(user, 'J00001 Year-end accounts');
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const form = await screen.findByRole('region', { name: 'Edit job' });

    expect(within(form).getByLabelText('Job name')).toHaveValue('Year-end accounts');
    expect(within(form).getByRole('button', { name: 'Save job' })).toBeDisabled();
    await user.clear(within(form).getByLabelText('Job name'));
    await user.type(within(form).getByLabelText('Job name'), 'Year-end accounts 2026');
    await user.click(within(form).getByRole('button', { name: 'Save job' }));

    expect(await screen.findByText('Job saved')).toBeInTheDocument();
    expect(callsOf(backend, 'PATCH')[0]).toMatchObject({
      path: '/jobs/j-1',
      body: { name: 'Year-end accounts 2026' },
    });
  });

  it('deletes a job after a confirmation, and keeps the confirmation open when the API refuses', async () => {
    const user = userEvent.setup();
    const backend = setup({ inUse: new Set(['j-1']) });
    await menu(user, 'J00001 Year-end accounts');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    let confirm = await screen.findByRole('dialog', { name: 'Delete this job?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete job' }));
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'Time is recorded against this job',
    );
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));

    await user.click(await screen.findByRole('button', { name: 'Actions for J00003 VAT returns' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    confirm = await screen.findByRole('dialog', { name: 'Delete this job?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete job' }));

    expect(await screen.findByText('Job deleted')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).queryByRole('link', { name: /VAT returns/ }),
      ).not.toBeInTheDocument(),
    );
    expect(backend.jobs.map((entry) => entry.id)).toEqual(['j-1', 'j-2']);
  });

  it('offers a reader only to open the job and nothing to create', async () => {
    const user = userEvent.setup();
    setup({}, { permissions: READ_ONLY });
    await menu(user, 'J00001 Year-end accounts');

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open']);
    expect(screen.queryByRole('button', { name: 'New job' })).not.toBeInTheDocument();
  });
});
