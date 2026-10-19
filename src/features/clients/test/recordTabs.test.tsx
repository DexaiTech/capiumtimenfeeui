import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type HttpHandler } from 'msw';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenStore } from '@/services/api';
import { contextWith, OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { techwave } from './fixtures';
import {
  disbursements,
  invoices,
  jobs,
  payments,
  staffOverview,
  techwaveOverview,
  techwaveWip,
  timeEntries,
  WIP_TODAY,
} from './workspaceFixtures';
import { workspaceHandlers, type WorkspaceData } from './workspaceHandlers';
import { ExpensesTab } from '../workspace/tabs/ExpensesTab';
import { InvoicesTab } from '../workspace/tabs/InvoicesTab';
import { JobsTab } from '../workspace/tabs/JobsTab';
import { PaymentsTab } from '../workspace/tabs/PaymentsTab';
import { TimeTab } from '../workspace/tabs/TimeTab';
import { WipTab } from '../workspace/tabs/WipTab';
import type { ClientOverview } from '../workspace/types';

const END = { next_cursor: null, has_more: false };
/** What the API client says for any 5xx, whatever the server wrote. */
const SERVER_PROBLEM = 'Something went wrong on our side. Please try again.';
const NAME = 'Techwave Innovations Ltd';

interface Call {
  endpoint: string;
  params: URLSearchParams;
}

function renderTab(
  tab: ReactElement,
  {
    tabId,
    permissions = OWNER_PERMISSIONS,
    query = '',
    handlers = [],
    ...data
  }: WorkspaceData & {
    tabId: string;
    permissions?: string[];
    query?: string;
    /** Handlers that win over the workspace ones, for one test's scenario. */
    handlers?: HttpHandler[];
  },
) {
  server.use(...handlers, ...workspaceHandlers(data));
  return renderInOrg(tab, {
    route: `/acme/clients/${techwave.id}/${tabId}${query}`,
    context: contextWith(permissions),
  });
}

/** Records the query of every record list the tab asks for. */
function recorder() {
  const calls: Call[] = [];
  return {
    calls,
    onList: (endpoint: string, params: URLSearchParams) => calls.push({ endpoint, params }),
  };
}

const last = (calls: Call[]) => calls[calls.length - 1]?.params;
const table = (name: string) => screen.getByRole('table', { name });
const rowOf = (name: string, row: RegExp | string) =>
  within(table(name)).getByRole('row', { name: row });
const strip = (label: string) => screen.getByLabelText(label);

/** The rows of a table after its header row. */
const bodyRows = (name: string) => within(table(name)).getAllByRole('row').slice(1);

describe('JobsTab', () => {
  const caption = `Jobs of ${NAME}`;
  const tab = (overview: ClientOverview | undefined = techwaveOverview) => (
    <JobsTab clientId={techwave.id} clientName={NAME} overview={overview} />
  );

  it('lists the jobs with their status, due date, hours and money', async () => {
    renderTab(tab(), { tabId: 'jobs' });
    // Loading: the table is busy until the rows arrive.
    expect(table(caption)).toHaveAttribute('aria-busy', 'true');

    const first = await screen.findByRole('row', { name: /J-0001/ });
    expect(table(caption)).not.toHaveAttribute('aria-busy');
    expect(within(first).getByRole('link', { name: 'J-0001' })).toHaveAttribute(
      'href',
      `/acme/jobs/${jobs[0]?.id}`,
    );
    expect(first).toHaveTextContent('Year-end accounts 2026');
    expect(first).toHaveTextContent('Accounts');
    expect(first).toHaveTextContent('In progress');
    expect(first).toHaveTextContent('30/09/2026');
    // Logged 10:00 of a 40:00 budget; WIP and billed as money.
    expect(first).toHaveTextContent('10:00 of 40:00');
    expect(first).toHaveTextContent('£600.00');
    expect(first).toHaveTextContent('£0.00');

    expect(rowOf(caption, /J-0002/)).toHaveTextContent('Not started');
    const third = rowOf(caption, /J-0003/);
    expect(third).toHaveTextContent('Completed');
    expect(third).toHaveTextContent('£50.00');
    expect(screen.getByText('Showing 3 jobs · End of the list')).toBeInTheDocument();
  });

  it('shows the totals from the overview', async () => {
    renderTab(tab(), { tabId: 'jobs' });
    await screen.findByRole('row', { name: /J-0001/ });
    const totals = within(strip('Job totals'));
    expect(totals.getByText('Jobs').nextSibling).toHaveTextContent('3');
    expect(totals.getByText('In progress').nextSibling).toHaveTextContent('1');
    expect(totals.getByText('Completed').nextSibling).toHaveTextContent('1');
  });

  it('asks for the newest jobs first and sorts on the server when a header is chosen', async () => {
    const { calls, onList } = recorder();
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'jobs', onList });
    await screen.findByRole('row', { name: /J-0001/ });
    expect(last(calls)?.get('client_id')).toBe(techwave.id);
    expect(last(calls)?.get('sort')).toBe('-created_at');
    expect(last(calls)?.get('limit')).toBe('25');

    const due = screen.getByRole('columnheader', { name: 'Due' });
    await user.click(within(due).getByRole('button', { name: 'Due' }));
    await waitFor(() => expect(last(calls)?.get('sort')).toBe('due_date'));
    expect(due).toHaveAttribute('aria-sort', 'ascending');
    await user.click(within(due).getByRole('button', { name: 'Due' }));
    await waitFor(() => expect(last(calls)?.get('sort')).toBe('-due_date'));
    expect(due).toHaveAttribute('aria-sort', 'descending');
  });

  it('filters by status', async () => {
    const { calls, onList } = recorder();
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'jobs', onList });
    await screen.findByRole('row', { name: /J-0001/ });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'In progress');
    await waitFor(() => expect(last(calls)?.get('status')).toBe('in_progress'));
  });

  it('searches once typing stops', async () => {
    const { calls, onList } = recorder();
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'jobs', onList });
    await screen.findByRole('row', { name: /J-0001/ });

    await user.type(screen.getByRole('searchbox', { name: 'Search jobs' }), 'vat');
    await waitFor(() => expect(last(calls)?.get('q')).toBe('vat'));
    expect(calls.filter((call) => call.params.get('q') === 'va')).toHaveLength(0);
  });

  it('reads its filters from the URL', async () => {
    const { calls, onList } = recorder();
    renderTab(tab(), { tabId: 'jobs', onList, query: '?status=on_hold&sort=number&order=desc' });
    await screen.findByRole('row', { name: /J-0001/ });
    expect(last(calls)?.get('status')).toBe('on_hold');
    expect(last(calls)?.get('sort')).toBe('-number');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('on_hold');
  });

  it('says there are no jobs yet, and that nothing matches when a filter is set', async () => {
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'jobs', jobs: [] });
    expect(await screen.findByText('No jobs yet')).toBeInTheDocument();
    expect(screen.getByText('Jobs for this client will be listed here.')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'On hold');
    expect(await screen.findByText('Nothing matches')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('No jobs yet')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('');
  });

  it('explains a failed load and retries', async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderTab(tab(), {
      tabId: 'jobs',
      handlers: [
        http.get(orgApiPath('/jobs'), () => {
          calls += 1;
          return calls === 1 ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok(jobs, { meta: END });
        }),
      ],
    });

    expect(await screen.findByText('Could not load the jobs')).toBeInTheDocument();
    expect(screen.getByText(SERVER_PROBLEM)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('row', { name: /J-0001/ })).toBeInTheDocument();
  });

  it('loads the next page with the cursor', async () => {
    const cursors: Array<string | null> = [];
    const user = userEvent.setup();
    renderTab(tab(), {
      tabId: 'jobs',
      handlers: [
        http.get(orgApiPath('/jobs'), ({ request }) => {
          const cursor = new URL(request.url).searchParams.get('cursor');
          cursors.push(cursor);
          return cursor
            ? ok([jobs[2]], { meta: END })
            : ok([jobs[0], jobs[1]], { meta: { next_cursor: 'page-2', has_more: true } });
        }),
      ],
    });
    await screen.findByRole('row', { name: /J-0001/ });
    expect(screen.getByText('Showing 2 jobs')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('row', { name: /J-0003/ })).toBeInTheDocument();
    expect(cursors).toEqual([null, 'page-2']);
    expect(screen.getByText('Showing 3 jobs · End of the list')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('leaves the totals out when the overview has not loaded', async () => {
    // An explicit undefined: the `tab()` helper would fill in the default overview.
    renderTab(<JobsTab clientId={techwave.id} clientName={NAME} overview={undefined} />, {
      tabId: 'jobs',
    });
    await screen.findByRole('row', { name: /J-0001/ });
    expect(screen.queryByLabelText('Job totals')).toBeNull();
  });
});

describe('TimeTab', () => {
  const caption = `Time recorded for ${NAME}`;
  const tab = (overview: ClientOverview | undefined = techwaveOverview) => (
    <TimeTab clientId={techwave.id} clientName={NAME} overview={overview} />
  );

  it("lists everyone's time with hours as h:mm and money", async () => {
    const { calls, onList } = recorder();
    renderTab(tab(), { tabId: 'time', onList });
    expect(table(caption)).toHaveAttribute('aria-busy', 'true');

    const first = await screen.findByRole('row', { name: /Prepared the trial balance/ });
    expect(last(calls)?.get('user_id')).toBe('all');
    expect(first).toHaveTextContent('12/06/2026');
    expect(await within(first).findByText('Grace Hopper')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: /J-0001/ })).toHaveAttribute(
      'href',
      `/acme/jobs/${jobs[0]?.id}`,
    );
    expect(first).toHaveTextContent('Accounts preparation');
    expect(first).toHaveTextContent('1:30');
    expect(first).toHaveTextContent('£95.00 / h');
    expect(first).toHaveTextContent('£142.50');
    expect(first).toHaveTextContent('Unbilled');

    const second = rowOf(caption, /Internal review/);
    expect(second).toHaveTextContent('0:45');
    expect(second).toHaveTextContent('Non-billable');
    expect(second).toHaveTextContent('Written off');
    expect(rowOf(caption, /Audit fieldwork/)).toHaveTextContent('7:30');
    expect(
      await within(rowOf(caption, /Audit fieldwork/)).findByText('Ada Lovelace'),
    ).toBeInTheDocument();
  });

  it('shows the totals from the overview', async () => {
    renderTab(tab(), { tabId: 'time' });
    await screen.findByRole('row', { name: /Prepared the trial balance/ });
    const totals = strip('Time totals');
    expect(totals).toHaveTextContent('Last 30 days');
    expect(totals).toHaveTextContent('16:00');
    expect(totals).toHaveTextContent('12:30 billable');
    expect(totals).toHaveTextContent('This year');
    expect(totals).toHaveTextContent('60:00');
    expect(totals).toHaveTextContent('12/06/2026');
  });

  it('asks only for the caller’s own time without time.read_all', async () => {
    const { calls, onList } = recorder();
    renderTab(tab(staffOverview), { tabId: 'time', onList, permissions: STAFF_PERMISSIONS });
    await screen.findByRole('row', { name: /Prepared the trial balance/ });

    expect(last(calls)?.get('user_id')).toBe('me');
    expect(screen.getByRole('heading', { name: 'Your time' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Staff' })).toBeNull();
    expect(strip('Time totals')).toHaveTextContent('Your time, last 30 days');
  });

  it('sorts the loaded rows by time', async () => {
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'time' });
    await screen.findByRole('row', { name: /Prepared the trial balance/ });

    const header = screen.getByRole('columnheader', { name: 'Time' });
    await user.click(within(header).getByRole('button', { name: 'Time' }));
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(bodyRows(caption).map((row) => row.textContent)).toEqual([
      expect.stringContaining('Internal review'),
      expect.stringContaining('Prepared the trial balance'),
      expect.stringContaining('Audit fieldwork'),
    ]);
  });

  it('sends the filters to the API', async () => {
    const { calls, onList } = recorder();
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'time', onList });
    await screen.findByRole('row', { name: /Prepared the trial balance/ });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Billable' }), 'Non-billable');
    await waitFor(() => expect(last(calls)?.get('billable')).toBe('false'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Written off');
    await waitFor(() => expect(last(calls)?.get('billing_status')).toBe('written_off'));
    fireEvent.change(screen.getByLabelText('Date from'), { target: { value: '2026-06-01' } });
    await waitFor(() => expect(last(calls)?.get('date_from')).toBe('2026-06-01'));
    fireEvent.change(screen.getByLabelText('Date to'), { target: { value: '2026-06-30' } });
    await waitFor(() => expect(last(calls)?.get('date_to')).toBe('2026-06-30'));
  });

  it('says there is no time yet', async () => {
    renderTab(tab(), { tabId: 'time', time: [] });
    expect(await screen.findByText('No time recorded yet')).toBeInTheDocument();
  });

  it('says there is no time of your own yet', async () => {
    renderTab(tab(staffOverview), { tabId: 'time', time: [], permissions: STAFF_PERMISSIONS });
    expect(
      await screen.findByText('Time you record for this client will be listed here.'),
    ).toBeInTheDocument();
  });

  it('explains a failed load and retries', async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderTab(tab(), {
      tabId: 'time',
      handlers: [
        http.get(orgApiPath('/time-entries'), () => {
          calls += 1;
          return calls === 1
            ? fail(500, 'INTERNAL_ERROR', 'Boom.')
            : ok(timeEntries, { meta: END });
        }),
      ],
    });

    expect(await screen.findByText('Could not load the time')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('row', { name: /Prepared the trial balance/ }),
    ).toBeInTheDocument();
  });
});

describe('ExpensesTab', () => {
  const caption = `Expenses of ${NAME}`;
  const tab = (overview: ClientOverview | undefined = techwaveOverview) => (
    <ExpensesTab clientId={techwave.id} clientName={NAME} overview={overview} />
  );

  it('shows the disbursements as expenses', async () => {
    const { calls, onList } = recorder();
    renderTab(tab(), { tabId: 'expenses', onList });
    expect(table(caption)).toHaveAttribute('aria-busy', 'true');

    const first = await screen.findByRole('row', { name: /Companies House filing fee/ });
    expect(last(calls)?.get('client_id')).toBe(techwave.id);
    expect(first).toHaveTextContent('05/06/2026');
    expect(first).toHaveTextContent('Companies House');
    expect(first).toHaveTextContent('£13.00');
    expect(first).toHaveTextContent('Billable');
    expect(first).toHaveTextContent('Unbilled');

    const second = rowOf(caption, /Courier to the client/);
    expect(second).toHaveTextContent('£32.00');
    expect(second).toHaveTextContent('Non-billable');
    expect(second).toHaveTextContent('Written off');
    expect(second).toHaveTextContent('—');
  });

  it('shows the totals from the overview', async () => {
    renderTab(tab(), { tabId: 'expenses' });
    await screen.findByRole('row', { name: /Companies House filing fee/ });
    const totals = strip('Expense totals');
    expect(totals).toHaveTextContent('Expenses');
    expect(totals).toHaveTextContent('£45.00');
    expect(totals).toHaveTextContent('Before VAT');
    expect(totals).toHaveTextContent('£54.00');
  });

  it('sends the filters to the API', async () => {
    const { calls, onList } = recorder();
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'expenses', onList });
    await screen.findByRole('row', { name: /Companies House filing fee/ });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Billable' }), 'Billable');
    await waitFor(() => expect(last(calls)?.get('is_billable')).toBe('true'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Billed');
    await waitFor(() => expect(last(calls)?.get('billing_status')).toBe('billed'));
    fireEvent.change(screen.getByLabelText('Date from'), { target: { value: '2026-05-01' } });
    await waitFor(() => expect(last(calls)?.get('date_from')).toBe('2026-05-01'));
  });

  it('sorts the loaded rows by amount', async () => {
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'expenses' });
    await screen.findByRole('row', { name: /Companies House filing fee/ });

    const header = screen.getByRole('columnheader', { name: 'Amount' });
    await user.click(within(header).getByRole('button', { name: 'Amount' }));
    await user.click(within(header).getByRole('button', { name: 'Amount' }));
    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(bodyRows(caption)[0]).toHaveTextContent('Courier to the client');
  });

  it('says there are no expenses yet', async () => {
    renderTab(tab(), { tabId: 'expenses', disbursements: [] });
    expect(await screen.findByText('No expenses yet')).toBeInTheDocument();
  });

  it('explains a failed load and retries', async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderTab(tab(), {
      tabId: 'expenses',
      handlers: [
        http.get(orgApiPath('/disbursements'), () => {
          calls += 1;
          return calls === 1
            ? fail(500, 'INTERNAL_ERROR', 'Boom.')
            : ok(disbursements, { meta: END });
        }),
      ],
    });

    expect(await screen.findByText('Could not load the expenses')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('row', { name: /Companies House filing fee/ }),
    ).toBeInTheDocument();
  });

  it('labels the totals as the caller’s own without wip.read', async () => {
    renderTab(tab(staffOverview), { tabId: 'expenses', permissions: STAFF_PERMISSIONS });
    await screen.findByRole('row', { name: /Companies House filing fee/ });
    expect(strip('Expense totals')).toHaveTextContent('Your expenses');
  });
});

describe('WipTab', () => {
  const caption = `WIP items of ${NAME}`;
  const tab = <WipTab clientId={techwave.id} clientName={NAME} />;

  // Ages are counted from a fixed day; only the clock is faked, so requests still complete.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${WIP_TODAY}T12:00:00Z`));
  });
  afterEach(() => vi.useRealTimers());

  it('shows a loading state, then the totals', async () => {
    renderTab(tab, { tabId: 'wip' });
    expect(screen.getByRole('status', { name: 'Loading work in progress' })).toBeInTheDocument();

    const totals = await screen.findByLabelText('WIP totals');
    expect(totals).toHaveTextContent('Total WIP');
    expect(totals).toHaveTextContent('£488.00');
    expect(totals).toHaveTextContent('5 items');
    expect(totals).toHaveTextContent('£475.00');
    expect(totals).toHaveTextContent('5:00 logged');
    expect(totals).toHaveTextContent('£13.00');
  });

  it('groups the work by job, the biggest first', async () => {
    renderTab(tab, { tabId: 'wip' });
    await screen.findByLabelText('WIP totals');

    const byJob = `WIP by job for ${NAME}`;
    const rows = bodyRows(byJob);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('J-0001');
    expect(rows[0]).toHaveTextContent('£332.50');
    expect(rows[0]).toHaveTextContent('68%');
    expect(rows[1]).toHaveTextContent('J-0003');
    expect(rows[1]).toHaveTextContent('£142.50');
    // Expenses recorded against the client alone come last.
    expect(rows[2]).toHaveTextContent('No job');
    expect(rows[2]).toHaveTextContent('£13.00');
  });

  it('ages the items from the day it is', async () => {
    renderTab(tab, { tabId: 'wip' });
    await screen.findByLabelText('WIP totals');

    const ageing = within(screen.getByRole('list', { name: 'WIP ageing' })).getAllByRole(
      'listitem',
    );
    expect(ageing.map((item) => item.textContent)).toEqual([
      '0–30 days£155.50',
      '31–60 days£190.00',
      '61–90 days£95.00',
      'Over 90 days£47.50',
    ]);
  });

  it('lists every item and filters them by job', async () => {
    const user = userEvent.setup();
    renderTab(tab, { tabId: 'wip' });
    await screen.findByLabelText('WIP totals');

    expect(bodyRows(caption)).toHaveLength(5);
    const first = rowOf(caption, /Prepared the trial balance/);
    expect(first).toHaveTextContent('10/06/2026');
    expect(first).toHaveTextContent('Time');
    expect(first).toHaveTextContent('Grace Hopper');
    expect(first).toHaveTextContent('1:30');
    expect(first).toHaveTextContent('£95.00 / h');
    expect(first).toHaveTextContent('£142.50');
    const expense = rowOf(caption, /Companies House filing fee/);
    expect(expense).toHaveTextContent('Expense');
    expect(expense).toHaveTextContent('No job');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Job' }), 'J-0003 Payroll April');
    expect(bodyRows(caption)).toHaveLength(2);
    expect(screen.getByText('Showing 2 items · End of the list')).toBeInTheDocument();
  });

  it('sorts the items by value', async () => {
    const user = userEvent.setup();
    renderTab(tab, { tabId: 'wip' });
    await screen.findByLabelText('WIP totals');

    const header = screen.getByRole('columnheader', { name: 'Value' });
    await user.click(within(header).getByRole('button', { name: 'Value' }));
    expect(bodyRows(caption)[0]).toHaveTextContent('£13.00');
  });

  it('shows 50 items and "Show more" for the rest', async () => {
    const template = techwaveWip.items[0];
    if (!template) throw new Error('The WIP fixture has no items');
    const many = Array.from({ length: 60 }, (_, index) => ({
      ...template,
      id: `0198c1f2-0000-7000-8000-${String(index).padStart(12, '0')}`,
      description: `Entry ${index}`,
    }));
    const user = userEvent.setup();
    renderTab(tab, { tabId: 'wip', wip: { ...techwaveWip, items: many } });
    await screen.findByLabelText('WIP totals');

    expect(bodyRows(caption)).toHaveLength(50);
    expect(screen.getByText('Showing 50 items')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(bodyRows(caption)).toHaveLength(60);
    expect(screen.getByText('Showing 60 items · End of the list')).toBeInTheDocument();
  });

  it('says there is no work in progress', async () => {
    renderTab(tab, {
      tabId: 'wip',
      wip: {
        ...techwaveWip,
        items: [],
        totals: { minutes: 0, hours: '0.00', time_value: 0, disbursement_value: 0, total: 0 },
      },
    });
    expect(await screen.findByText('No work in progress')).toBeInTheDocument();
  });

  it('explains a failed load and retries', async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderTab(tab, {
      tabId: 'wip',
      handlers: [
        http.get(orgApiPath('/clients/:clientId/wip'), () => {
          calls += 1;
          return calls === 1 ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok(techwaveWip);
        }),
      ],
    });

    expect(await screen.findByText('Could not load the work in progress')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('WIP totals')).toBeInTheDocument();
  });
});

describe('InvoicesTab', () => {
  const invoiceCaption = `Invoices of ${NAME}`;
  const noteCaption = `Credit notes of ${NAME}`;
  const tab = (overview: ClientOverview | undefined = techwaveOverview) => (
    <InvoicesTab clientId={techwave.id} clientCode="APX006" clientName={NAME} overview={overview} />
  );

  it('lists the invoices with status, dates and balances', async () => {
    const { calls, onList } = recorder();
    renderTab(tab(), { tabId: 'invoices', onList });
    expect(table(invoiceCaption)).toHaveAttribute('aria-busy', 'true');

    const overdue = await screen.findByRole('row', { name: /INV-0004/ });
    expect(last(calls)?.get('client_id')).toBe(techwave.id);
    expect(within(overdue).getByRole('link', { name: 'INV-0004' })).toHaveAttribute(
      'href',
      `/acme/billing/invoices/${invoices[0]?.id}`,
    );
    expect(overdue).toHaveTextContent('30/04/2026');
    expect(overdue).toHaveTextContent('30/05/2026');
    expect(overdue).toHaveTextContent('Overdue');
    expect(overdue).toHaveTextContent('PO-77');
    expect(overdue).toHaveTextContent('£300.00');

    const part = rowOf(invoiceCaption, /INV-0003/);
    expect(part).toHaveTextContent('Part paid');
    expect(part).toHaveTextContent('£1,200.00');
    expect(part).toHaveTextContent('£300.00');
    expect(part).toHaveTextContent('£900.00');
    expect(rowOf(invoiceCaption, /INV-0002/)).toHaveTextContent('Paid');
    // A draft has no number and no dates yet.
    expect(rowOf(invoiceCaption, /Draft/)).toHaveTextContent('£180.00');
  });

  it('shows the totals from the overview', async () => {
    renderTab(tab(), { tabId: 'invoices' });
    await screen.findByRole('row', { name: /INV-0004/ });
    const totals = strip('Invoice totals');
    expect(totals).toHaveTextContent('Outstanding');
    expect(totals).toHaveTextContent('£1,200.00');
    expect(totals).toHaveTextContent('Overdue');
    expect(totals).toHaveTextContent('£300.00');
    expect(totals).toHaveTextContent('Billed this year');
    expect(totals).toHaveTextContent('£8,000.00');
    expect(totals).toHaveTextContent('Net, since 01/01/2026');
  });

  it('sends the filters to the API', async () => {
    const { calls, onList } = recorder();
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'invoices', onList });
    await screen.findByRole('row', { name: /INV-0004/ });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Overdue');
    await waitFor(() => expect(last(calls)?.get('status')).toBe('overdue'));
    await user.type(screen.getByRole('searchbox', { name: 'Search invoices' }), 'INV-0004');
    await waitFor(() => expect(last(calls)?.get('q')).toBe('INV-0004'));
    fireEvent.change(screen.getByLabelText('Issue date from'), { target: { value: '2026-04-01' } });
    await waitFor(() => expect(last(calls)?.get('date_from')).toBe('2026-04-01'));
  });

  it('switches to the credit notes', async () => {
    const { calls, onList } = recorder();
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'invoices', onList });
    await screen.findByRole('row', { name: /INV-0004/ });

    expect(screen.getByRole('button', { name: 'Invoices' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Credit notes' }));
    const note = await screen.findByRole('row', { name: /CN-0001/ });
    expect(screen.getByRole('button', { name: 'Credit notes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(note).toHaveTextContent('02/05/2026');
    expect(note).toHaveTextContent('Duplicate charge');
    expect(note).toHaveTextContent('£50.00');
    expect(note).toHaveTextContent('£10.00');
    expect(note).toHaveTextContent('£60.00');
    expect(within(note).getByRole('link', { name: 'INV-0002' })).toBeInTheDocument();
    expect(calls.map((call) => call.endpoint)).toContain('credit-notes');
    expect(table(noteCaption)).toBeInTheDocument();
  });

  it('says there are no invoices or credit notes yet', async () => {
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'invoices', invoices: [], creditNotes: [] });
    expect(await screen.findByText('No invoices yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Credit notes' }));
    expect(await screen.findByText('No credit notes yet')).toBeInTheDocument();
  });

  it('explains a failed load and retries', async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderTab(tab(), {
      tabId: 'invoices',
      handlers: [
        http.get(orgApiPath('/invoices'), () => {
          calls += 1;
          return calls === 1 ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok(invoices, { meta: END });
        }),
      ],
    });

    expect(await screen.findByText('Could not load the invoices')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('row', { name: /INV-0004/ })).toBeInTheDocument();
  });

  it('explains a failed credit notes load', async () => {
    const user = userEvent.setup();
    renderTab(tab(), {
      tabId: 'invoices',
      handlers: [http.get(orgApiPath('/credit-notes'), () => fail(500, 'INTERNAL_ERROR', 'Boom.'))],
    });
    await screen.findByRole('row', { name: /INV-0004/ });

    await user.click(screen.getByRole('button', { name: 'Credit notes' }));
    expect(await screen.findByText('Could not load the credit notes')).toBeInTheDocument();
  });

  it('downloads the statement for the dates picked, with payment.read', async () => {
    tokenStore.set('token-statement');
    let auth: string | null = null;
    let query: URLSearchParams | undefined;
    server.use(
      http.get(orgApiPath('/clients/:clientId/statement/pdf'), ({ request }) => {
        auth = request.headers.get('Authorization');
        query = new URL(request.url).searchParams;
        return new HttpResponse('%PDF-1.4 statement', {
          headers: { 'Content-Type': 'application/pdf' },
        });
      }),
    );
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:statement');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this);
    });
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'invoices', query: '?from=2026-01-01&to=2026-06-30' });
    await screen.findByRole('row', { name: /INV-0004/ });

    await user.click(screen.getByRole('button', { name: 'Statement (PDF)' }));
    await waitFor(() => expect(clicks).toHaveLength(1));
    expect(auth).toBe('Bearer token-statement');
    expect(query?.get('date_from')).toBe('2026-01-01');
    expect(query?.get('date_to')).toBe('2026-06-30');
    expect(clicks[0]?.download).toBe('statement-APX006.pdf');
    expect(await createObjectURL.mock.calls[0]?.[0].text()).toContain('%PDF');
  });

  it('reports a statement that cannot be downloaded', async () => {
    server.use(
      http.get(orgApiPath('/clients/:clientId/statement/pdf'), () =>
        fail(500, 'INTERNAL_ERROR', 'Boom.'),
      ),
    );
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'invoices' });
    await screen.findByRole('row', { name: /INV-0004/ });

    await user.click(screen.getByRole('button', { name: 'Statement (PDF)' }));
    expect(await screen.findByText('Could not download the statement')).toBeInTheDocument();
  });

  it('offers no statement without payment.read', async () => {
    renderTab(tab(), {
      tabId: 'invoices',
      permissions: OWNER_PERMISSIONS.filter((permission) => permission !== 'payment.read'),
    });
    await screen.findByRole('row', { name: /INV-0004/ });
    expect(screen.queryByRole('button', { name: 'Statement (PDF)' })).toBeNull();
  });
});

describe('PaymentsTab', () => {
  const caption = `Payments of ${NAME}`;
  const tab = (overview: ClientOverview | undefined = techwaveOverview) => (
    <PaymentsTab clientId={techwave.id} clientName={NAME} overview={overview} />
  );

  it('lists the payments with method, allocation and status', async () => {
    const { calls, onList } = recorder();
    renderTab(tab(), { tabId: 'payments', onList });
    expect(table(caption)).toHaveAttribute('aria-busy', 'true');

    const first = await screen.findByRole('row', { name: /BACS 4471/ });
    expect(last(calls)?.get('client_id')).toBe(techwave.id);
    expect(first).toHaveTextContent('02/06/2026');
    expect(first).toHaveTextContent('£600.00');
    expect(first).toHaveTextContent('Bank transfer');
    expect(first).toHaveTextContent('Allocated');

    const card = rowOf(caption, /Card/);
    expect(card).toHaveTextContent('£200.00');
    expect(card).toHaveTextContent('Unallocated');
    expect(rowOf(caption, /Cheque 118/)).toHaveTextContent('Void');
  });

  it('shows the totals from the overview', async () => {
    renderTab(tab(), { tabId: 'payments' });
    await screen.findByRole('row', { name: /BACS 4471/ });
    const totals = strip('Payment totals');
    expect(totals).toHaveTextContent('Received this year');
    expect(totals).toHaveTextContent('£6,000.00');
    expect(totals).toHaveTextContent('Since 01/01/2026');
    expect(totals).toHaveTextContent('02/06/2026');
  });

  it('sends the filters to the API', async () => {
    const { calls, onList } = recorder();
    const user = userEvent.setup();
    renderTab(tab(), { tabId: 'payments', onList });
    await screen.findByRole('row', { name: /BACS 4471/ });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Unallocated');
    await waitFor(() => expect(last(calls)?.get('state')).toBe('unallocated'));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Method' }), 'Card');
    await waitFor(() => expect(last(calls)?.get('method')).toBe('card'));
    await user.type(screen.getByRole('searchbox', { name: 'Search payments' }), 'BACS');
    await waitFor(() => expect(last(calls)?.get('q')).toBe('BACS'));
    fireEvent.change(screen.getByLabelText('Date received from'), {
      target: { value: '2026-05-01' },
    });
    await waitFor(() => expect(last(calls)?.get('date_from')).toBe('2026-05-01'));
  });

  it('says there are no payments yet', async () => {
    renderTab(tab(), { tabId: 'payments', payments: [] });
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
  });

  it('explains a failed load and retries', async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderTab(tab(), {
      tabId: 'payments',
      handlers: [
        http.get(orgApiPath('/payments'), () => {
          calls += 1;
          return calls === 1 ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok(payments, { meta: END });
        }),
      ],
    });

    expect(await screen.findByText('Could not load the payments')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('row', { name: /BACS 4471/ })).toBeInTheDocument();
  });

  it('loads the next page with the cursor', async () => {
    const user = userEvent.setup();
    renderTab(tab(), {
      tabId: 'payments',
      handlers: [
        http.get(orgApiPath('/payments'), ({ request }) => {
          const cursor = new URL(request.url).searchParams.get('cursor');
          return cursor
            ? ok([payments[2]], { meta: END })
            : ok([payments[0], payments[1]], { meta: { next_cursor: 'p2', has_more: true } });
        }),
      ],
    });
    await screen.findByRole('row', { name: /BACS 4471/ });

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('row', { name: /Cheque 118/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 3 payments · End of the list')).toBeInTheDocument();
  });
});
