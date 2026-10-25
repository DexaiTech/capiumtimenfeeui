import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { server } from '@/test/server';

import AgedDebtorsReportPage from '../pages/AgedDebtorsReportPage';
import BillingReportPage from '../pages/BillingReportPage';
import MissingTimesheetsReportPage from '../pages/MissingTimesheetsReportPage';
import PaymentsReportPage from '../pages/PaymentsReportPage';
import RecoveryReportPage from '../pages/RecoveryReportPage';
import UtilisationReportPage from '../pages/UtilisationReportPage';
import {
  agedRows,
  agedTotals,
  billingByMonth,
  billingByPartner,
  billingTotals,
  emptyPaymentTotals,
  IDS,
  missingRows,
  missingTotals,
  paymentsByMonth,
  paymentTotals,
  recoveryRows,
  recoveryTotals,
  utilisationRows,
  utilisationTotals,
} from '../test/fixtures';
import {
  createBackend,
  downloadsOf,
  reportsHandlers,
  runsOf,
  type Answer,
  type ReportsBackend,
} from '../test/handlers';
import { REPORTS, renderReportPage } from '../test/render';

const READER = [
  'organization.read',
  'member.read',
  'client.read',
  'job.read',
  'rate.read',
  'report.read',
  'report.financial',
];

const utilisation = (): Record<string, Answer> => ({
  utilisation: { rows: utilisationRows(), totals: utilisationTotals() },
});
const billing = (): Record<string, Answer> => ({
  'billing-summary': { rows: billingByMonth(), totals: billingTotals() },
});
const payments = (): Record<string, Answer> => ({
  payments: { rows: paymentsByMonth(), totals: paymentTotals() },
});

function setup(
  page: ReactElement,
  answers: Record<string, Answer>,
  options: { permissions?: string[]; route?: string; init?: Partial<ReportsBackend> } = {},
) {
  const backend = createBackend({ reports: answers, ...options.init });
  server.use(...reportsHandlers(backend));
  renderReportPage(page, {
    permissions: options.permissions ?? OWNER_PERMISSIONS,
    route: options.route ?? REPORTS,
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

describe('the period', () => {
  it('sends no dates until the person chooses some, and shows the ones the report used', async () => {
    const backend = setup(<UtilisationReportPage />, utilisation());
    await table('Utilisation');

    const first = runsOf(backend, 'utilisation')[0]?.params;
    expect(first?.has('date_from')).toBe(false);
    expect(first?.has('date_to')).toBe(false);
    await waitFor(() => expect(screen.getByLabelText('Period')).toHaveValue('this-month'));
    expect(screen.getByLabelText('Dates from')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('Dates to')).toHaveValue('2026-10-18');
  });

  it('opens the reports of money on this year', async () => {
    const backend = setup(<BillingReportPage />, billing());
    await table('Billing');

    const first = runsOf(backend, 'billing-summary')[0]?.params;
    expect(first?.get('date_from')).toBe('2026-01-01');
    expect(first?.get('date_to')).toBe('2026-10-18');
    expect(screen.getByLabelText('Period')).toHaveValue('this-year');
    expect(screen.getByLabelText('Dates from')).toHaveValue('2026-01-01');
  });

  it('changes the period from the select and keeps it in the address', async () => {
    const user = userEvent.setup();
    const backend = setup(<UtilisationReportPage />, utilisation());
    await table('Utilisation');

    await user.selectOptions(screen.getByLabelText('Period'), 'Last month');
    await waitFor(() =>
      expect(runsOf(backend, 'utilisation').at(-1)?.params?.get('date_from')).toBe('2026-09-01'),
    );
    expect(runsOf(backend, 'utilisation').at(-1)?.params?.get('date_to')).toBe('2026-09-30');
    expect(location()).toHaveTextContent('from=2026-09-01&to=2026-09-30');
    await waitFor(() => expect(screen.getByLabelText('Period')).toHaveValue('last-month'));

    await user.selectOptions(screen.getByLabelText('Period'), 'Last 3 months');
    await waitFor(() =>
      expect(runsOf(backend, 'utilisation').at(-1)?.params?.get('date_from')).toBe('2026-08-01'),
    );
    expect(runsOf(backend, 'utilisation').at(-1)?.params?.get('date_to')).toBe('2026-10-18');
  });

  it('runs the report again for dates typed into the fields, and calls them custom', async () => {
    const backend = setup(<UtilisationReportPage />, utilisation());
    await table('Utilisation');

    fireEvent.change(screen.getByLabelText('Dates from'), { target: { value: '2026-10-05' } });
    await waitFor(() =>
      expect(runsOf(backend, 'utilisation').at(-1)?.params?.get('date_from')).toBe('2026-10-05'),
    );
    expect(runsOf(backend, 'utilisation').at(-1)?.params?.get('date_to')).toBe('2026-10-18');
    await waitFor(() => expect(screen.getByLabelText('Period')).toHaveValue('custom'));
  });

  it('reads the dates of the address, and ignores what is not a date', async () => {
    const backend = setup(<UtilisationReportPage />, utilisation(), {
      route: `${REPORTS}?from=yesterday&to=2026-08-31`,
    });
    await table('Utilisation');

    const first = runsOf(backend, 'utilisation')[0]?.params;
    expect(first?.has('date_from')).toBe(false);
    expect(first?.get('date_to')).toBe('2026-08-31');
  });
});

describe('the grouping', () => {
  it('offers the groupings of the report, the first of them by default', async () => {
    const backend = setup(<BillingReportPage />, billing(), {
      init: {
        grouped: {
          'billing-summary': { partner: { rows: billingByPartner(), totals: billingTotals() } },
        },
      },
    });
    const body = await table('Billing');

    const group = screen.getByLabelText('Group by');
    expect(group).toHaveValue('month');
    expect(
      within(group)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Month', 'Partner']);
    expect(runsOf(backend, 'billing-summary')[0]?.params?.get('group_by')).toBe('month');
    expect(within(body).getByRole('columnheader', { name: /Month/ })).toBeInTheDocument();
    expect(rowsOf(body)[0]).toHaveTextContent('Sep 2026');
  });

  it('groups by another column, from the select, and goes back to the default', async () => {
    const user = userEvent.setup();
    const backend = setup(<BillingReportPage />, billing(), {
      init: {
        grouped: {
          'billing-summary': { partner: { rows: billingByPartner(), totals: billingTotals() } },
        },
      },
    });
    await table('Billing');
    expect(
      await screen.findByRole('heading', { name: 'Billed and received by month' }),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Group by'), 'Partner');
    await waitFor(() =>
      expect(runsOf(backend, 'billing-summary').at(-1)?.params?.get('group_by')).toBe('partner'),
    );
    expect(location()).toHaveTextContent('group=partner');
    await waitFor(() =>
      expect(screen.getByRole('table', { name: 'Billing' })).toHaveTextContent('No partner'),
    );
    const body = screen.getByRole('table', { name: 'Billing' });
    expect(within(body).getByRole('columnheader', { name: /Partner/ })).toBeInTheDocument();
    expect(rowsOf(body)[0]).toHaveTextContent('Ada Lovelace');
    expect(
      screen.queryByRole('heading', { name: 'Billed and received by month' }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Group by'), 'Month');
    await waitFor(() => expect(location()).not.toHaveTextContent('group='));
    await waitFor(() =>
      expect(runsOf(backend, 'billing-summary').at(-1)?.params?.get('group_by')).toBe('month'),
    );
  });

  it('has no grouping to choose on a report that has none', async () => {
    setup(<UtilisationReportPage />, utilisation());
    await table('Utilisation');
    expect(screen.queryByLabelText('Group by')).not.toBeInTheDocument();
  });
});

describe('the filters', () => {
  it('sends the person chosen, says how many filters apply, and clears them', async () => {
    const user = userEvent.setup();
    const backend = setup(<UtilisationReportPage />, utilisation());
    await table('Utilisation');

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter the utilisation' });
    await user.click(within(panel).getByRole('combobox', { name: 'Person' }));
    await user.click(await within(panel).findByRole('option', { name: /Ben Carter/ }));
    await waitFor(() =>
      expect(runsOf(backend, 'utilisation').at(-1)?.params?.get('user_id')).toBe(IDS.ben),
    );
    expect(location()).toHaveTextContent(`user=${IDS.ben}`);
    expect(screen.getByText(', 1 filters applied')).toBeInTheDocument();

    await user.click(within(panel).getByRole('combobox', { name: 'Manager' }));
    await user.click(await within(panel).findByRole('option', { name: /Cara Diaz/ }));
    await waitFor(() =>
      expect(runsOf(backend, 'utilisation').at(-1)?.params?.get('manager_user_id')).toBe(IDS.cara),
    );
    expect(screen.getByText(', 2 filters applied')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect(runsOf(backend, 'utilisation').at(-1)?.params?.has('user_id')).toBe(false),
    );
    expect(runsOf(backend, 'utilisation').at(-1)?.params?.has('manager_user_id')).toBe(false);
    expect(screen.queryByText(/filters applied/)).not.toBeInTheDocument();
  });

  it('filters the payments by method', async () => {
    const user = userEvent.setup();
    const backend = setup(<PaymentsReportPage />, payments());
    await table('Payments');

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter the payments report' });
    await user.selectOptions(within(panel).getByLabelText('Method'), 'Bank transfer');
    await waitFor(() =>
      expect(runsOf(backend, 'payments').at(-1)?.params?.get('method')).toBe('bank_transfer'),
    );
  });

  it('does not offer the people to someone who may not list them', async () => {
    const user = userEvent.setup();
    setup(<UtilisationReportPage />, utilisation(), {
      permissions: ['organization.read', 'report.read'],
    });
    await table('Utilisation');

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter the utilisation' });
    expect(within(panel).queryByRole('combobox', { name: 'Person' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('combobox', { name: 'Manager' })).not.toBeInTheDocument();
  });

  it('says that nothing matches when the filters leave no rows, and offers to clear them', async () => {
    const user = userEvent.setup();
    const backend = setup(<PaymentsReportPage />, payments());
    await table('Payments');
    backend.reports.payments = { rows: [], totals: emptyPaymentTotals() };

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter the payments report' });
    await user.selectOptions(within(panel).getByLabelText('Method'), 'Cash');

    expect(await screen.findByText('Nothing matches')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Clear filters' });
    await user.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(location()).not.toHaveTextContent('method='));
  });
});

describe('the table', () => {
  it('sorts on the column heading, ascending then descending', async () => {
    const user = userEvent.setup();
    setup(<UtilisationReportPage />, utilisation());
    const body = await table('Utilisation');
    expect(rowsOf(body).map((row) => row.textContent)).toEqual([
      expect.stringContaining('Ada Lovelace'),
      expect.stringContaining('Ben Carter'),
      expect.stringContaining('Cara Diaz'),
    ]);

    await user.click(screen.getByRole('button', { name: /^Recorded/ }));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Utilisation' }))[0]).toHaveTextContent(
        'Cara Diaz',
      ),
    );
    await user.click(screen.getByRole('button', { name: /^Recorded/ }));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Utilisation' }))[0]).toHaveTextContent(
        'Ben Carter',
      ),
    );
  });

  it('opens the records behind a row for the dates on screen', async () => {
    const user = userEvent.setup();
    setup(<UtilisationReportPage />, utilisation());
    await table('Utilisation');
    await waitFor(() => expect(screen.getByLabelText('Dates to')).toHaveValue('2026-10-18'));

    await user.click(screen.getByRole('button', { name: 'Actions for Ada Lovelace' }));
    await user.click(await screen.findByRole('menuitem', { name: 'See the time entries' }));
    expect(location()).toHaveTextContent(
      `/acme/time/entries?person=${IDS.ada}&from=2026-10-01&to=2026-10-18`,
    );
  });

  it('opens the same records with one click on the row', async () => {
    const user = userEvent.setup();
    setup(<UtilisationReportPage />, utilisation());
    const body = await table('Utilisation');
    await waitFor(() => expect(screen.getByLabelText('Dates to')).toHaveValue('2026-10-18'));

    await user.click(within(rowsOf(body)[0] as HTMLElement).getByText('Ada Lovelace'));
    expect(location()).toHaveTextContent(
      `/acme/time/entries?person=${IDS.ada}&from=2026-10-01&to=2026-10-18`,
    );
  });

  it('offers no actions on a row that has nothing behind it', async () => {
    setup(<RecoveryReportPage />, {
      recoverability: { rows: recoveryRows(), totals: recoveryTotals() },
    });
    const body = await table('Recovery');

    const rows = rowsOf(body);
    expect(rows).toHaveLength(3);
    expect(
      within(rows[0] as HTMLElement).getByRole('button', { name: 'Actions for Acme Ltd' }),
    ).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('exporting', () => {
  function stubDownloads() {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:report');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    return { createObjectURL, names };
  }

  it('downloads the report as a CSV, Excel or PDF file for the filters on screen', async () => {
    const user = userEvent.setup();
    const { createObjectURL, names } = stubDownloads();
    const backend = setup(<BillingReportPage />, billing(), {
      route: `${REPORTS}?from=2026-09-01&to=2026-09-30&group=partner`,
      init: {
        grouped: {
          'billing-summary': { partner: { rows: billingByPartner(), totals: billingTotals() } },
        },
      },
    });
    await table('Billing');

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('button', { name: 'CSV (.csv)' }));
    await waitFor(() => expect(downloadsOf(backend, 'billing-summary')).toHaveLength(1));
    const csv = downloadsOf(backend, 'billing-summary')[0]?.params;
    expect(csv?.get('format')).toBe('csv');
    expect(csv?.get('date_from')).toBe('2026-09-01');
    expect(csv?.get('date_to')).toBe('2026-09-30');
    expect(csv?.get('group_by')).toBe('partner');
    await waitFor(() => expect(names).toEqual(['billing-2026-09-30.csv']));
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('button', { name: 'Excel (.xlsx)' }));
    await waitFor(() => expect(names).toHaveLength(2));
    expect(names[1]).toBe('billing-2026-09-30.xlsx');

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('button', { name: 'PDF (.pdf)' }));
    await waitFor(() => expect(names).toHaveLength(3));
    expect(names[2]).toBe('billing-2026-09-30.pdf');
    expect(
      downloadsOf(backend, 'billing-summary').map((call) => call.params?.get('format')),
    ).toEqual(['csv', 'xlsx', 'pdf']);
  });

  it('explains why someone without the export permission cannot export', async () => {
    setup(<UtilisationReportPage />, utilisation(), { permissions: READER });
    await table('Utilisation');
    const button = screen.getByRole('button', { name: 'Export' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Exporting reports needs the export permission');
  });

  it('has nothing to export when the report is empty', async () => {
    setup(<UtilisationReportPage />, {
      utilisation: { rows: [], totals: utilisationTotals() },
    });
    expect(await screen.findByText('No one to report on')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('tells the person when the file could not be made', async () => {
    const user = userEvent.setup();
    const { names } = stubDownloads();
    setup(<UtilisationReportPage />, utilisation(), {
      init: {
        refusals: {
          'GET /reports/utilisation (file)': {
            status: 400,
            code: 'BAD_REQUEST',
            message: 'The file failed.',
          },
        },
      },
    });
    await table('Utilisation');

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('button', { name: 'CSV (.csv)' }));
    expect(await screen.findByText('Could not download the report')).toBeInTheDocument();
    expect(screen.getByText('The file failed.')).toBeInTheDocument();
    expect(names).toEqual([]);
  });
});

describe('a report as at a day', () => {
  const answers = (): Record<string, Answer> => ({
    'aged-debtors': { rows: agedRows(), totals: agedTotals() },
  });

  it('reads today until another day is chosen, and does not allow a day to come', async () => {
    const backend = setup(<AgedDebtorsReportPage />, answers());
    await table('Aged Debtors');

    expect(runsOf(backend, 'aged-debtors')[0]?.params?.has('as_at')).toBe(false);
    const day = screen.getByLabelText('As at date');
    await waitFor(() => expect(day).toHaveValue('2026-10-18'));
    expect(day).toHaveAttribute('max', '2026-10-18');
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('reads another day, and goes back to today', async () => {
    const user = userEvent.setup();
    const backend = setup(<AgedDebtorsReportPage />, answers());
    await table('Aged Debtors');

    fireEvent.change(screen.getByLabelText('As at date'), { target: { value: '2026-09-30' } });
    await waitFor(() =>
      expect(runsOf(backend, 'aged-debtors').at(-1)?.params?.get('as_at')).toBe('2026-09-30'),
    );
    expect(location()).toHaveTextContent('as_at=2026-09-30');

    await user.click(await screen.findByRole('button', { name: 'Today' }));
    await waitFor(() =>
      expect(runsOf(backend, 'aged-debtors').at(-1)?.params?.has('as_at')).toBe(false),
    );
    expect(location()).not.toHaveTextContent('as_at');
  });

  it('names the file after the day', async () => {
    const user = userEvent.setup();
    const names: string[] = [];
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:aged'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    setup(<AgedDebtorsReportPage />, answers(), { route: `${REPORTS}?as_at=2026-09-30` });
    await table('Aged Debtors');

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('button', { name: 'CSV (.csv)' }));
    await waitFor(() => expect(names).toEqual(['aged-debtors-2026-09-30.csv']));
  });
});

describe('a report over weeks', () => {
  const answers = (): Record<string, Answer> => ({
    'missing-timesheets': { rows: missingRows(), totals: missingTotals() },
  });

  it('shows the weeks the report used, and runs it again for other weeks', async () => {
    const backend = setup(<MissingTimesheetsReportPage />, answers());
    await table('Missing Timesheets');

    const first = runsOf(backend, 'missing-timesheets')[0]?.params;
    expect(first?.has('week_from')).toBe(false);
    expect(first?.has('week_to')).toBe(false);
    await waitFor(() => expect(screen.getByLabelText('Weeks from')).toHaveValue('2026-09-21'));
    expect(screen.getByLabelText('Weeks to')).toHaveValue('2026-10-12');

    fireEvent.change(screen.getByLabelText('Weeks from'), { target: { value: '2026-09-28' } });
    await waitFor(() =>
      expect(runsOf(backend, 'missing-timesheets').at(-1)?.params?.get('week_from')).toBe(
        '2026-09-28',
      ),
    );
    expect(runsOf(backend, 'missing-timesheets').at(-1)?.params?.get('week_to')).toBe('2026-10-12');
  });

  it('filters by the state of the timesheet', async () => {
    const user = userEvent.setup();
    const backend = setup(<MissingTimesheetsReportPage />, answers());
    await table('Missing Timesheets');

    await user.click(screen.getByRole('button', { name: /Filter/ }));
    const panel = await screen.findByRole('dialog', {
      name: 'Filter the missing timesheets report',
    });
    await user.selectOptions(within(panel).getByLabelText('Timesheet state'), 'Returned');
    await waitFor(() =>
      expect(runsOf(backend, 'missing-timesheets').at(-1)?.params?.get('status')).toBe('rejected'),
    );
  });
});

describe('the states of a report', () => {
  it('needs permission to see the report, and asks the API for nothing without it', async () => {
    const backend = setup(<UtilisationReportPage />, utilisation(), {
      permissions: ['organization.read'],
    });
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.getByText(/does not include viewing utilisation/)).toBeInTheDocument();
    expect(runsOf(backend, 'utilisation')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup(<UtilisationReportPage />, utilisation(), {
      init: {
        refusals: {
          'GET /reports/utilisation': { status: 500, code: 'SERVER_ERROR', message: 'Down.' },
        },
      },
    });
    expect(await screen.findByText('Could not load the utilisation')).toBeInTheDocument();

    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(rowsOf(await table('Utilisation'))).toHaveLength(3);
    expect(screen.queryByText('Could not load the utilisation')).not.toBeInTheDocument();
  });

  it('says what the report lists when it is empty', async () => {
    setup(<UtilisationReportPage />, { utilisation: { rows: [], totals: utilisationTotals() } });
    expect(await screen.findByText('No one to report on')).toBeInTheDocument();
    expect(
      screen.getByText('Staff with a weekly capacity appear here for the dates chosen.'),
    ).toBeInTheDocument();
  });

  it('shows the title and what the report is for', async () => {
    setup(<UtilisationReportPage />, utilisation());
    expect(await screen.findByRole('heading', { name: 'Utilisation' })).toBeInTheDocument();
    expect(screen.getByText('Chargeable hours against capacity and target.')).toBeInTheDocument();
  });
});
