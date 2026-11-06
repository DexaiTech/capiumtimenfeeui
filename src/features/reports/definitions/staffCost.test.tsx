import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { findRowAction } from '@/test/rowActions';
import { server } from '@/test/server';

import StaffCostReportPage from '../pages/StaffCostReportPage';
import { IDS, staffCostJobRows, staffCostRows, staffCostTotals } from '../test/fixtures';
import {
  createBackend,
  downloadsOf,
  reportsHandlers,
  runsOf,
  type ReportsBackend,
} from '../test/handlers';
import { renderReportPage } from '../test/render';

const PAGE = '/acme/reports/staff-cost';
const STAFF_COST = [...OWNER_PERMISSIONS, 'report.staff_cost'];

function setup(
  options: { permissions?: string[]; route?: string; init?: Partial<ReportsBackend> } = {},
) {
  const backend = createBackend({
    reports: {
      'staff-cost': { rows: staffCostRows(), totals: staffCostTotals() },
      'staff-cost/jobs': { rows: staffCostJobRows(), totals: {} },
    },
    ...options.init,
  });
  server.use(...reportsHandlers(backend));
  renderReportPage(<StaffCostReportPage />, {
    permissions: options.permissions ?? STAFF_COST,
    route: options.route ?? PAGE,
    path: PAGE,
  });
  return backend;
}

const table = async (name: string) => {
  const element = await screen.findByRole('table', { name });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);
const location = () => screen.getByTestId('location');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Staff Cost', () => {
  it('shows standard and overtime cost per person and period, with pending overtime unapproved', async () => {
    setup();
    const rows = rowsOf(await table('Staff Cost'));

    expect(
      screen.getByText(
        'Overtime cost is shown only here: it never changes WIP, invoices or job profitability.',
        { exact: false },
      ),
    ).toBeInTheDocument();

    const figures = screen.getByLabelText('Staff Cost figures');
    expect(figures).toHaveTextContent('Total cost£1,560.00');
    expect(figures).toHaveTextContent('79:30 of time');
    expect(figures).toHaveTextContent('Standard£1,425.00');
    expect(figures).toHaveTextContent('75:00 at the cost rate');
    expect(figures).toHaveTextContent('Overtime£135.00');
    expect(figures).toHaveTextContent('£90.00 allocated · £45.00 unallocated');
    expect(figures).toHaveTextContent('Unapproved overtime£135.00');

    expect(rows).toHaveLength(2);
    for (const text of [
      'Ada Lovelace',
      'Senior',
      '05/10/2026 – 11/10/2026',
      '£750.00',
      '37:30',
      '£90.00',
      '3:00',
      '£45.00',
      '1:30',
      '£885.00',
      '£135.00 unapproved',
    ]) {
      expect(rows[0]).toHaveTextContent(text);
    }
    expect(rows[1]).toHaveTextContent('Ben Carter');
    expect(rows[1]).toHaveTextContent('£675.00');
    expect(rows[1]).not.toHaveTextContent('unapproved');
  });

  it('sends the filters of the address, and the ones chosen, as the report’s parameters', async () => {
    const user = userEvent.setup();
    const backend = setup({
      route: `${PAGE}?from=2026-10-01&to=2026-10-31&user=${IDS.ada}&grade=g-1&job=j-1&client=${IDS.acme}`,
    });
    await table('Staff Cost');

    const first = runsOf(backend, 'staff-cost').at(-1)?.params;
    expect(first?.get('date_from')).toBe('2026-10-01');
    expect(first?.get('date_to')).toBe('2026-10-31');
    expect(first?.get('user_id')).toBe(IDS.ada);
    expect(first?.get('grade_id')).toBe('g-1');
    expect(first?.get('job_id')).toBe('j-1');
    expect(first?.get('client_id')).toBe(IDS.acme);

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter the Staff Cost report' });
    await waitFor(() =>
      expect(within(panel).getByRole('option', { name: 'Manager' })).toBeInTheDocument(),
    );
    await user.selectOptions(within(panel).getByLabelText('Grade'), 'Manager');
    await user.selectOptions(within(panel).getByLabelText('Approval status'), 'Approved');
    await user.selectOptions(
      within(panel).getByLabelText('Overtime type'),
      'Unallocated (internal work)',
    );

    await waitFor(() =>
      expect(runsOf(backend, 'staff-cost').at(-1)?.params?.get('overtime_type')).toBe(
        'unallocated',
      ),
    );
    const last = runsOf(backend, 'staff-cost').at(-1)?.params;
    expect(last?.get('grade_id')).toBe('g-2');
    expect(last?.get('status')).toBe('approved');
    expect(location()).toHaveTextContent('approval=approved');
    expect(location()).toHaveTextContent('overtime=unallocated');
  });

  it('drills from a person’s row to the jobs they worked overtime on, and back', async () => {
    const user = userEvent.setup();
    const backend = setup({ route: `${PAGE}?from=2026-10-07&to=2026-10-31&approval=pending` });
    await table('Staff Cost');

    await user.click(await findRowAction(/Actions for Ada Lovelace/, 'See the overtime jobs'));
    // The row's period, within the dates on screen, and the filters on screen.
    expect(location()).toHaveTextContent(
      `${PAGE}?group=job&user=${IDS.ada}&from=2026-10-07&to=2026-10-11&approval=pending`,
    );

    const rows = rowsOf(await table('Staff Cost by job'));
    const run = runsOf(backend, 'staff-cost/jobs').at(-1)?.params;
    expect(run?.get('user_id')).toBe(IDS.ada);
    expect(run?.get('date_from')).toBe('2026-10-07');
    expect(run?.get('date_to')).toBe('2026-10-11');
    expect(run?.get('status')).toBe('pending');
    expect(run?.has('group_by')).toBe(false);

    expect(rows).toHaveLength(2);
    for (const text of [
      'J00001 Year-end accounts',
      'Acme Ltd',
      'Overtime',
      '3:00',
      '£30.00',
      '£90.00',
      'Unapproved',
    ]) {
      expect(rows[0]).toHaveTextContent(text);
    }
    expect(rows[1]).toHaveTextContent('Internal');
    expect(rows[1]).toHaveTextContent('Approved');
    expect(screen.queryByLabelText('Staff Cost by job figures')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'All staff' }));
    expect(location()).toHaveTextContent(`${PAGE}?from=2026-10-07&to=2026-10-11&approval=pending`);
    expect(await screen.findByRole('table', { name: 'Staff Cost' })).toBeInTheDocument();
  });

  it('offers no drill on a row without overtime', async () => {
    setup();
    const rows = rowsOf(await table('Staff Cost'));
    expect(
      within(rows[0] as HTMLElement).getByRole('group', { name: /Actions for Ada Lovelace/ }),
    ).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('downloads the report with the export permission only', async () => {
    const user = userEvent.setup();
    const names: string[] = [];
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:report'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    const backend = setup({ route: `${PAGE}?from=2026-10-01&to=2026-10-31&overtime=allocated` });
    await table('Staff Cost');

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('button', { name: 'Excel (.xlsx)' }));
    await waitFor(() => expect(names).toEqual(['staff-cost-2026-10-31.xlsx']));
    const file = downloadsOf(backend, 'staff-cost')[0]?.params;
    expect(file?.get('format')).toBe('xlsx');
    expect(file?.get('overtime_type')).toBe('allocated');
  });

  it('cannot be exported without the export permission', async () => {
    setup({ permissions: STAFF_COST.filter((code) => code !== 'report.export') });
    await table('Staff Cost');
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('is refused without report.staff_cost, even to the financial reports, and asks for nothing', async () => {
    const backend = setup({ permissions: OWNER_PERMISSIONS });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.path.startsWith('/reports/'))).toHaveLength(0);
  });

  it('refuses the jobs view without report.staff_cost too', async () => {
    const backend = setup({
      permissions: OWNER_PERMISSIONS,
      route: `${PAGE}?group=job&user=${IDS.ada}`,
    });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(backend.calls.filter((call) => call.path.startsWith('/reports/'))).toHaveLength(0);
  });
});
