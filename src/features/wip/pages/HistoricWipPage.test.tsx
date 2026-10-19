import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import { IDS, historicItem, historicRow } from '../test/fixtures';
import { callsOf, createBackend, wipHandlers, type WipBackend } from '../test/handlers';
import { WIP, renderWipPage } from '../test/render';
import HistoricWipPage from './HistoricWipPage';

const HISTORIC = `${WIP}/historic`;
const WITH_REPORTS = [
  'organization.read',
  'member.read',
  'client.read',
  'job.read',
  'wip.read',
  'report.financial',
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T09:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const rows = () => [
  historicRow(),
  historicRow({
    key: IDS.globex,
    name: 'Globex plc',
    code: 'GLOB',
    time_wip: 40000,
    fixed_fee_wip: 0,
    expense_wip: 0,
    write_ons: 0,
    write_offs: 0,
    total: 40000,
    item_count: 2,
    oldest_date: '2026-09-02',
  }),
];

function setup(
  init: Partial<WipBackend> = {},
  options: { permissions?: string[]; route?: string } = {},
) {
  const backend = createBackend({
    historic: {
      client: rows(),
      job: [
        historicRow({
          group_by: 'job',
          key: 'j-1',
          name: 'J00001 Year-end accounts',
          client: { id: IDS.acme, code: 'ACME', name: 'Acme Ltd' },
        }),
      ],
      billing_type: [
        historicRow({ group_by: 'billing_type', key: 'hourly', name: 'Hourly', code: null }),
      ],
    },
    historicItems: [
      historicItem(),
      historicItem({ id: 'h-2', description: 'Bookkeeping', value: 5000 }),
    ],
    ...init,
  });
  server.use(...wipHandlers(backend));
  renderWipPage(<HistoricWipPage />, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? HISTORIC,
    path: HISTORIC,
  });
  return backend;
}

const reports = (backend: WipBackend) =>
  callsOf(backend, 'GET').filter((call) => call.path === '/reports/wip');

const table = async () => {
  const element = await screen.findByRole('table', { name: 'Historic WIP' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

describe('the historic WIP', () => {
  it('opens on today, live, grouped by client, with the totals and the rows', async () => {
    const backend = setup();
    const body = rowsOf(await table());

    const first = reports(backend)[0]?.params;
    expect(first?.get('as_at')).toBe('2026-10-18');
    expect(first?.get('group_by')).toBe('client');
    expect(first?.get('format')).toBe('json');
    expect(screen.getByLabelText('As at date')).toHaveValue('2026-10-18');

    const figures = screen.getByLabelText('WIP as at 18/10/2026');
    expect(figures).toHaveTextContent('Time WIP£1,300.00');
    expect(figures).toHaveTextContent('Write-ons£100.00');
    expect(figures).toHaveTextContent('Write-offs-£150.00');
    expect(figures).toHaveTextContent('Total WIP£1,500.00');
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveTextContent('Acme Ltd');
    expect(body[0]).toHaveTextContent('£900.00');
    expect(body[0]).toHaveTextContent('£200.00');
    expect(body[0]).toHaveTextContent('-£150.00');
    expect(body[0]).toHaveTextContent('£1,100.00');
    expect(body[0]).toHaveTextContent('20/05/2026');
  });

  it('says that a past day is frozen', async () => {
    setup({}, { route: `${HISTORIC}?as_at=2026-09-30` });
    await table();
    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent('Frozen');
    expect(note).toHaveTextContent(
      'Figures as at 30 September 2026 are frozen and will not change.',
    );
    expect(note).toHaveTextContent('Taken on');
  });

  it('says that today is live', async () => {
    setup({ snapshot: { frozen: false, taken_at: null, source: null } });
    await table();
    expect(await screen.findByRole('note')).toHaveTextContent('Live');
  });

  it('reads the end of last month from the shortcut', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'Last month end' }));
    await waitFor(() => expect(reports(backend).at(-1)?.params?.get('as_at')).toBe('2026-09-30'));
    expect(screen.getByLabelText('As at date')).toHaveValue('2026-09-30');
  });

  it('reads another day, and does not allow a day to come', async () => {
    const backend = setup();
    await table();

    const date = screen.getByLabelText('As at date');
    expect(date).toHaveAttribute('max', '2026-10-18');
    fireEvent.change(date, { target: { value: '2026-08-31' } });
    await waitFor(() => expect(reports(backend).at(-1)?.params?.get('as_at')).toBe('2026-08-31'));
  });

  it('groups by job or by billing type from the tabs', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('tab', { name: 'Job' }));
    await waitFor(() => expect(reports(backend).at(-1)?.params?.get('group_by')).toBe('job'));
    await waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(1));
    expect(screen.getByRole('table')).toHaveTextContent('J00001 Year-end accounts');

    await user.click(screen.getByRole('tab', { name: 'Billing type' }));
    await waitFor(() =>
      expect(reports(backend).at(-1)?.params?.get('group_by')).toBe('billing_type'),
    );
    await waitFor(() => expect(screen.getByRole('table')).toHaveTextContent('Hourly'));
  });

  it('filters by manager, and says how many filters apply', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter historic WIP' });
    await user.selectOptions(within(panel).getByLabelText('Manager'), 'Ben Carter');
    await waitFor(() =>
      expect(reports(backend).at(-1)?.params?.get('manager_user_id')).toBe(IDS.ben),
    );
    expect(screen.getByText(', 1 filters applied')).toBeInTheDocument();
  });

  it('shows the items behind a row as they stood at the day', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const body = rowsOf(await table());

    await user.click(
      within(body[0] as HTMLElement).getByRole('button', { name: 'Actions for Acme Ltd' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'See the items' }));

    const dialog = await screen.findByRole('dialog', { name: 'Items behind the figures' });
    expect(dialog).toHaveTextContent('Acme Ltd, as at 18/10/2026');
    expect(await within(dialog).findByText('Preparing the accounts')).toBeInTheDocument();
    expect(within(dialog).getByText('Bookkeeping')).toBeInTheDocument();
    expect(
      within(dialog).getAllByRole('link', { name: 'J00001 Year-end accounts' })[0],
    ).toHaveAttribute('href', '/acme/jobs/j-1');
    const items = callsOf(backend, 'GET').filter((call) => call.path === '/reports/wip/items');
    expect(items[0]?.params?.get('as_at')).toBe('2026-10-18');
    expect(items[0]?.params?.get('client_id')).toBe(IDS.acme);
  });

  it('says so when there was no WIP at the day', async () => {
    setup({ historic: { client: [] } });
    expect(await screen.findByText('No WIP at that date')).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /reports/wip': { status: 500, code: 'SERVER_ERROR', message: 'Down.' } },
    });
    expect(await screen.findByText('Could not load the historic WIP')).toBeInTheDocument();
    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Acme Ltd')).toBeInTheDocument();
  });
});

describe('exporting', () => {
  function stubDownloads() {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:wip');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    return { createObjectURL, names };
  }

  it('downloads the report as a CSV or an Excel file for the day and grouping on screen', async () => {
    const user = userEvent.setup();
    const { createObjectURL, names } = stubDownloads();
    const backend = setup();
    await table();

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('button', { name: 'CSV (.csv)' }));
    await waitFor(() => expect(reports(backend).at(-1)?.params?.get('format')).toBe('csv'));
    await waitFor(() => expect(names).toEqual(['wip-2026-10-18-client.csv']));
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('button', { name: 'Excel (.xlsx)' }));
    await waitFor(() =>
      expect(names).toEqual(['wip-2026-10-18-client.csv', 'wip-2026-10-18-client.xlsx']),
    );
    expect(reports(backend).at(-1)?.params?.get('format')).toBe('xlsx');
  });

  it('shows why a person without the export permission cannot export', async () => {
    setup({}, { permissions: WITH_REPORTS });
    await table();
    const button = screen.getByRole('button', { name: 'Export' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Exporting reports needs the export permission');
  });
});

describe('the permissions', () => {
  it('needs the financial reports, and asks the API for nothing without them', async () => {
    const backend = setup({}, { permissions: ['organization.read', 'wip.read'] });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(reports(backend)).toHaveLength(0);
  });
});
