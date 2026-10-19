import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { fail, ok, server } from '@/test/server';

import { ada, claim as makeClaim, line as makeLine, ben } from '../test/fixtures';
import { createBackend, expenseHandlers, orgApiPath, type ExpenseBackend } from '../test/handlers';
import { EXPENSES, renderExpensePage } from '../test/render';
import MyExpensesPage from './MyExpensesPage';

const MINE = `${EXPENSES}/mine`;

function claims() {
  return [
    makeClaim({
      id: 'c-draft',
      title: 'Client visit, Leeds',
      status: 'draft',
      created_at: '2026-10-03T09:00:00Z',
      lines: [makeLine({ gross: 4300, net: 4300, recharge_amount: 4730 })],
    }),
    makeClaim({
      id: 'c-submitted',
      title: 'Conference',
      status: 'submitted',
      submitted_at: '2026-10-05T09:00:00Z',
      created_at: '2026-10-04T09:00:00Z',
      lines: [
        makeLine({ incurred_on: '2026-09-20', net: 12000, gross: 12000, recharge_amount: 0, is_billable: false }),
        makeLine({ incurred_on: '2026-09-22', net: 3000, gross: 3000, recharge_amount: 0, is_billable: false }),
      ],
    }),
    makeClaim({
      id: 'c-approved',
      title: null,
      status: 'approved',
      created_at: '2026-10-02T09:00:00Z',
      lines: [makeLine({ incurred_on: '2026-08-14', net: 800, gross: 800, recharge_amount: 0, is_billable: false })],
    }),
    makeClaim({
      id: 'c-ben',
      user_id: ben.id,
      user_name: ben.name,
      title: 'Ben, not mine',
      status: 'draft',
      lines: [makeLine({ net: 100, gross: 100 })],
    }),
  ];
}

function setup(init: Partial<ExpenseBackend> = {}, options: { route?: string; permissions?: string[] } = {}) {
  const backend = createBackend({ claims: claims(), ...init });
  server.use(...expenseHandlers(backend));
  renderExpensePage(<MyExpensesPage />, {
    permissions: options.permissions ?? STAFF_PERMISSIONS,
    route: options.route ?? MINE,
    path: MINE,
  });
  return backend;
}

const lists = (backend: ExpenseBackend) => backend.calls.filter((call) => call.path === '/expense-claims' && call.method === 'GET');
/** The table once the claims have loaded: while they load it is a skeleton marked `aria-busy`. */
const table = async () => {
  const element = await screen.findByRole('table', { name: 'My expense claims' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

describe('My Expenses', () => {
  it('lists the caller’s own claims with their status, period, count and total', async () => {
    const backend = setup();

    const rows = within(await table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    // Newest first, and never someone else's.
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Conference',
      'Client visit, Leeds',
      'Ada Lovelace, 14/08/2026',
    ]);
    const conference = rows[0];
    expect(conference).toHaveTextContent('20/09/2026 – 22/09/2026');
    expect(conference).toHaveTextContent('Submitted');
    expect(conference).toHaveTextContent('£150.00');
    expect(within(rows[1] as HTMLElement).getByRole('link', { name: 'Client visit, Leeds' })).toHaveAttribute(
      'href',
      '/acme/expenses/mine/c-draft',
    );
    expect(rows[2]).toHaveTextContent('Approved');
    expect(lists(backend)[0]?.params?.get('mine')).toBe('true');
    expect(screen.queryByText('Ben, not mine')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 3 claims · End of the list')).toBeInTheDocument();
  });

  it('shows a skeleton while the claims load', async () => {
    server.use(
      http.get(orgApiPath('/expense-claims'), async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return ok([], { meta: { next_cursor: null, has_more: false } });
      }),
    );
    renderExpensePage(<MyExpensesPage />, { permissions: STAFF_PERMISSIONS, route: MINE, path: MINE });

    expect(await screen.findByRole('table', { name: 'My expense claims' })).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('No expense claims yet')).toBeInTheDocument();
  });

  it('invites the first claim when there are none', async () => {
    const user = userEvent.setup();
    const backend = setup({ claims: [] });

    expect(await screen.findByText('No expense claims yet')).toBeInTheDocument();
    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'New claim' }));
    expect(await screen.findByRole('dialog', { name: 'New expense claim' })).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('shows the error with a retry', async () => {
    let attempts = 0;
    server.use(
      http.get(orgApiPath('/expense-claims'), () => {
        attempts += 1;
        return attempts === 1
          ? fail(500, 'SERVER_ERROR', 'Something went wrong.')
          : ok([], { meta: { next_cursor: null, has_more: false } });
      }),
    );
    const user = userEvent.setup();
    renderExpensePage(<MyExpensesPage />, { permissions: STAFF_PERMISSIONS, route: MINE, path: MINE });

    expect(await screen.findByText('Could not load your claims')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No expense claims yet')).toBeInTheDocument();
  });

  it('filters by status, by search and by dates, and says when nothing matches', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('tab', { name: 'Submitted' }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.getAll('status')).toEqual(['submitted']));
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2));
    expect(screen.getByRole('table')).toHaveTextContent('Conference');

    await user.click(screen.getByRole('tab', { name: 'All claims' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search my claims' }), 'leeds');
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('q')).toBe('leeds'));
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2));

    await user.clear(screen.getByRole('searchbox', { name: 'Search my claims' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search my claims' }), 'nothing like it');
    expect(await screen.findByText('No claims match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4));
  });

  it('asks the API for the dates picked in the filter', async () => {
    const user = userEvent.setup();
    const backend = setup(
      {},
      { route: `${MINE}?date_from=2026-09-01&date_to=2026-09-30` },
    );
    await table();

    expect(lists(backend)[0]?.params?.get('date_from')).toBe('2026-09-01');
    expect(lists(backend)[0]?.params?.get('date_to')).toBe('2026-09-30');
    await user.click(screen.getByRole('button', { name: /Filter/ }));
    expect(screen.getByRole('dialog', { name: 'Filter my claims' })).toBeInTheDocument();
    expect(screen.getByText(', 2 filters applied')).toBeInTheDocument();
  });

  it('sorts by the header the person clicks, through the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /^Total/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('sort')).toBe('total'));
    expect(lists(backend).at(-1)?.params?.get('order')).toBe('asc');
    await waitFor(() =>
      expect(
        within(screen.getByRole('table'))
          .getAllByRole('row')
          .slice(1)
          .map((row) => within(row).getAllByRole('cell')[0]?.textContent),
      ).toEqual(['Ada Lovelace, 14/08/2026', 'Client visit, Leeds', 'Conference']),
    );
  });

  it('starts a claim from a title and opens it', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'New claim' }));
    const form = await screen.findByRole('dialog', { name: 'New expense claim' });
    expect(within(form).queryByText('Claim for')).not.toBeInTheDocument();
    await user.type(within(form).getByLabelText('Title (optional)'), 'Audit trip');
    await user.click(within(form).getByRole('button', { name: 'Start claim' }));

    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toMatch(/^\/acme\/expenses\/mine\/.+/),
    );
    expect(backend.calls.find((call) => call.method === 'POST')?.body).toEqual({ title: 'Audit trip' });
    expect(backend.claims.at(-1)?.user_id).toBe(ada.id);
  });

  it('lets a manager start a claim for a member of staff', async () => {
    const user = userEvent.setup();
    const backend = setup({}, { permissions: OWNER_PERMISSIONS });
    await table();

    await user.click(screen.getByRole('button', { name: 'New claim' }));
    const form = await screen.findByRole('dialog', { name: 'New expense claim' });
    await user.click(within(form).getByRole('combobox', { name: 'Claim for' }));
    await user.click(await screen.findByRole('option', { name: /Ben Carter/ }));
    await user.click(within(form).getByRole('button', { name: 'Start claim' }));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/\/mine\//));
    expect(backend.calls.find((call) => call.method === 'POST')?.body).toEqual({ user_id: ben.id });
  });

  it('opens the new claim dialog from the quick-create link (?new=1) and drops the parameter on close', async () => {
    const user = userEvent.setup();
    setup({}, { route: `${MINE}?new=1` });

    const form = await screen.findByRole('dialog', { name: 'New expense claim' });
    await user.click(within(form).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(MINE));
    expect(screen.getByTestId('location').textContent).not.toContain('new=1');
  });

  it('deletes a draft after a confirmation, and recalls a submitted claim', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'Actions for Client visit, Leeds' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open', 'Delete']);
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this claim?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete claim' }));
    expect(await screen.findByText('Claim deleted')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).queryByRole('link', { name: 'Client visit, Leeds' }),
      ).not.toBeInTheDocument(),
    );
    expect(backend.claims.map((entry) => entry.id)).not.toContain('c-draft');

    await user.click(screen.getByRole('button', { name: 'Actions for Conference' }));
    await user.click(screen.getByRole('menuitem', { name: 'Recall' }));
    expect(await screen.findByText('Claim recalled')).toBeInTheDocument();
    expect(backend.claims.find((entry) => entry.id === 'c-submitted')?.status).toBe('draft');
  });

  it('keeps the confirmation open with the reason when the API refuses the delete', async () => {
    const user = userEvent.setup();
    setup();
    server.use(
      http.delete(orgApiPath('/expense-claims/:claimId'), () =>
        fail(409, 'EXPENSE_CLAIM_LOCKED', 'The claim is submitted and cannot be changed.'),
      ),
    );
    await table();
    await user.click(screen.getByRole('button', { name: 'Actions for Client visit, Leeds' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this claim?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete claim' }));

    expect(await within(confirm).findByRole('alert')).toHaveTextContent('The claim is submitted and cannot be changed.');
  });

  it('loads further claims with the cursor', async () => {
    const user = userEvent.setup();
    const backend = setup({ pageSize: 2 });
    await table();

    expect(await screen.findByText('Showing 2 claims')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Showing 3 claims · End of the list')).toBeInTheDocument();
    expect(lists(backend).at(-1)?.params?.get('cursor')).toBe('2');
  });

  it('tells a role that cannot record expenses, without asking the API', async () => {
    const backend = setup({}, { permissions: ['expense.read_all'] });

    expect(await screen.findByText('You cannot record expenses')).toBeInTheDocument();
    expect(backend.calls).toHaveLength(0);
  });
});
