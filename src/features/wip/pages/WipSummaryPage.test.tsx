import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/server';

import { IDS, ages, groupRow } from '../test/fixtures';
import { callsOf, createBackend, wipHandlers, type WipBackend } from '../test/handlers';
import { WIP, renderWipPage } from '../test/render';
import WipSummaryPage from './WipSummaryPage';

const globexRow = () =>
  groupRow({
    key: IDS.globex,
    name: 'Globex plc',
    code: 'GLOB',
    minutes: 300,
    hours: '5.00',
    time: 50000,
    fixed_fee: 0,
    expense: 0,
    total: 50000,
    ages: ages({ days_0_30: 50000 }),
    oldest_date: '2026-09-20',
    item_count: 2,
    over_90_bp: 0,
  });

function setup(init: Partial<WipBackend> = {}, options: { route?: string } = {}) {
  const backend = createBackend({
    summary: {
      client: [groupRow(), globexRow()],
      job: [
        groupRow({
          group_by: 'job',
          key: 'j-1',
          name: 'J00001 Year-end accounts',
          code: 'J00001',
          client: { id: IDS.acme, code: 'ACME', name: 'Acme Ltd' },
        }),
      ],
    },
    ...init,
  });
  server.use(...wipHandlers(backend));
  renderWipPage(<WipSummaryPage />, { route: options.route ?? WIP });
  return backend;
}

const lists = (backend: WipBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/wip/summary');

/** The table once the rows have loaded: while they load it is a skeleton marked `aria-busy`. */
const table = async () => {
  const element = await screen.findByRole('table', { name: 'WIP summary' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

describe('WIP summary', () => {
  it('lists the clients with the most WIP first, with their figures and the totals', async () => {
    const backend = setup();
    const rows = rowsOf(await table());

    expect(lists(backend)[0]?.params?.get('group_by')).toBe('client');
    expect(lists(backend)[0]?.params?.get('sort')).toBe('total');
    expect(lists(backend)[0]?.params?.get('order')).toBe('desc');
    expect(rows).toHaveLength(2);
    const [acme, globex] = rows as [HTMLElement, HTMLElement];
    expect(acme).toHaveTextContent('Acme Ltd');
    expect(acme).toHaveTextContent('£900.00');
    expect(acme).toHaveTextContent('£200.00');
    expect(acme).toHaveTextContent('£50.00');
    expect(acme).toHaveTextContent('£1,150.00');
    expect(acme).toHaveTextContent('02/06/2026');
    expect(acme).toHaveTextContent('£150.00 (13.04%)');
    expect(globex).toHaveTextContent('£500.00');

    const figures = screen.getByLabelText('Figures of the WIP');
    expect(figures).toHaveTextContent('Time WIP£1,400.00');
    expect(figures).toHaveTextContent('Fixed fee WIP£200.00');
    expect(figures).toHaveTextContent('Expense WIP£50.00');
    expect(figures).toHaveTextContent('Total WIP£1,650.00');
  });

  it('links each row to the items behind it', async () => {
    setup();
    const rows = rowsOf(await table());
    const row = within(rows[0] as HTMLElement);
    expect(row.getByRole('link', { name: /see the WIP items/ })).toHaveAttribute(
      'href',
      `/acme/wip/details?client_id=${IDS.acme}`,
    );
    // One click from the WIP of a client to its invoice, with the client chosen.
    expect(row.getByRole('link', { name: /^Bill / })).toHaveAttribute(
      'href',
      `/acme/billing/prepare?client=${IDS.acme}`,
    );
  });

  it('groups by job, partner, manager or service from the tabs', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('tab', { name: 'Job' }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('group_by')).toBe('job'));
    const rows = await waitFor(() => {
      const found = rowsOf(screen.getByRole('table', { name: 'WIP summary' }));
      expect(found).toHaveLength(1);
      return found;
    });
    expect(rows[0]).toHaveTextContent('J00001 Year-end accounts');
    expect(rows[0]).toHaveTextContent('Acme Ltd');
    expect(within(rows[0] as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/acme/wip/details?job_id=j-1',
    );
    expect(screen.getByRole('columnheader', { name: 'Job' })).toBeInTheDocument();
  });

  it('sorts by the header the person clicks, through the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /^Time WIP/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('sort')).toBe('time'));
    expect(lists(backend).at(-1)?.params?.get('order')).toBe('asc');
    await user.click(screen.getByRole('button', { name: /^Time WIP/ }));
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('order')).toBe('desc'));
  });

  it('searches by name and filters by manager, and says how many filters apply', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.type(screen.getByRole('searchbox', { name: 'Search WIP' }), 'glob');
    await waitFor(() => expect(lists(backend).at(-1)?.params?.get('q')).toBe('glob'));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).toHaveTextContent('Globex plc');

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter WIP' });
    await user.selectOptions(within(panel).getByLabelText('Manager'), 'Ben Carter');
    await waitFor(() =>
      expect(lists(backend).at(-1)?.params?.get('manager_user_id')).toBe(IDS.ben),
    );
    expect(screen.getByText(', 1 filters applied')).toBeInTheDocument();
  });

  it('opens with the group, sort and filters of the address', async () => {
    const backend = setup(
      {},
      { route: `${WIP}?group=job&sort=name&order=asc&client_id=${IDS.acme}` },
    );
    await table();
    const first = lists(backend)[0]?.params;
    expect(first?.get('group_by')).toBe('job');
    expect(first?.get('sort')).toBe('name');
    expect(first?.get('order')).toBe('asc');
    expect(first?.get('client_id')).toBe(IDS.acme);
  });

  it('loads further rows with the cursor', async () => {
    const user = userEvent.setup();
    const backend = setup({ pageSize: 1 });
    await table();

    expect(await screen.findByText('Showing 1 client')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Showing 2 clients · End of the list')).toBeInTheDocument();
    expect(lists(backend).at(-1)?.params?.get('cursor')).toBe('1');
  });

  it('says so when there is no WIP, and when nothing matches', async () => {
    const user = userEvent.setup();
    setup({ summary: { client: [] } });
    expect(await screen.findByText('No work in progress')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search WIP' }), 'zzz');
    expect(await screen.findByText('No WIP matches')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('No work in progress')).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /wip/summary': { status: 500, code: 'SERVER_ERROR', message: 'Down.' } },
    });
    expect(await screen.findByText('Could not load the work in progress')).toBeInTheDocument();

    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Acme Ltd')).toBeInTheDocument();
  });
});

describe('the permissions', () => {
  it('needs only wip.read', async () => {
    const backend = createBackend({ summary: { client: [groupRow()] } });
    server.use(...wipHandlers(backend));
    renderWipPage(<WipSummaryPage />, { permissions: ['organization.read', 'wip.read'] });
    expect(await screen.findByText('Acme Ltd')).toBeInTheDocument();
  });
});
