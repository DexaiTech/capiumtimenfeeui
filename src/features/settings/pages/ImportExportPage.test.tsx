import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import type { BulkImportResult, ImportResult, OpeningBalanceTimeImportResult } from '../adminTypes';
import { adminHandlers, callsOf, createBackend, type AdminBackend } from '../test/adminHandlers';
import ImportExportPage from './ImportExportPage';

const READER = ['organization.read', 'client.read'];
const CREATOR = ['organization.read', 'client.create'];
const IMPORTER = ['organization.read', 'opening_balance.import'];
const BULK = 'data.import_export';

async function openTab(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(await screen.findByRole('tab', { name: label }));
}

function setup(init: Partial<AdminBackend> = {}, permissions = OWNER_PERMISSIONS) {
  const backend = createBackend(init);
  server.use(...adminHandlers(backend));
  renderInOrg(<ImportExportPage />, { context: contextWith(permissions) });
  return backend;
}

function stubDownloads() {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:file');
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
  return { createObjectURL, names };
}

const csv = (name = 'clients.csv') => new File(['name\nAcme Ltd\n'], name, { type: 'text/csv' });

const result = (over: Partial<ImportResult> = {}): ImportResult => ({
  dry_run: true,
  total_rows: 3,
  valid_rows: 3,
  created: 0,
  columns: ['name', 'email'],
  ignored_columns: [],
  errors: [],
  clients: [],
  ...over,
});

async function openImport(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Import clients' }));
  return screen.findByRole('dialog', { name: 'Import clients' });
}

const openingBalanceCsv = (name = 'opening-balances.csv') =>
  new File(['client,staff,date,hours\nACME,jane@example.com,2024-01-15,3.5\n'], name, {
    type: 'text/csv',
  });

const openingBalanceResult = (
  over: Partial<OpeningBalanceTimeImportResult> = {},
): OpeningBalanceTimeImportResult => ({
  dry_run: true,
  total_rows: 2,
  valid_rows: 2,
  created: 0,
  columns: ['client', 'staff', 'date', 'hours'],
  ignored_columns: [],
  errors: [],
  entries: [],
  ...over,
});

async function openOpeningBalanceImport(user: ReturnType<typeof userEvent.setup>) {
  await openTab(user, 'Opening Balances');
  await user.click(await screen.findByRole('button', { name: 'Import historic time' }));
  return screen.findByRole('dialog', { name: 'Import historic time' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('what the page offers', () => {
  it('offers the clients on its own tab', async () => {
    setup();

    const clients = await screen.findByRole('region', { name: 'Clients' });
    expect(within(clients).getByRole('button', { name: 'Export clients' })).toBeEnabled();
    expect(within(clients).getByRole('button', { name: 'Import clients' })).toBeEnabled();
  });

  it('offers the reports and logs on their own tab', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('tab', { name: 'Reports & logs' }));

    const reports = screen.getByRole('region', { name: 'Reports and logs' });
    expect(within(reports).getByRole('link', { name: 'Go to the reports' })).toHaveAttribute(
      'href',
      '/acme/reports',
    );
    expect(within(reports).getByRole('link', { name: 'Go to the audit log' })).toHaveAttribute(
      'href',
      '/acme/settings/audit-logs',
    );
  });

  it('offers staff, rates and jobs on their own tab', async () => {
    const user = userEvent.setup();
    setup();
    await openTab(user, 'Staff, rates & jobs');

    const others = screen.getByRole('region', { name: 'Staff, rates and jobs' });
    expect(within(others).queryByText('Not available yet')).not.toBeInTheDocument();
    for (const name of ['Staff', 'Rates', 'Jobs']) {
      const section = within(others).getByRole('region', { name });
      const noun = name.toLowerCase();
      expect(within(section).getByRole('button', { name: `Export ${noun} (CSV)` })).toBeEnabled();
      expect(within(section).getByRole('button', { name: `Import ${noun}` })).toBeEnabled();
    }
  });
});

describe('exporting the clients', () => {
  it('downloads them as a CSV file', async () => {
    const user = userEvent.setup();
    const { createObjectURL, names } = stubDownloads();
    const backend = setup();

    await user.click(await screen.findByRole('button', { name: 'Export clients' }));

    await waitFor(() => expect(names).toEqual(['clients.csv']));
    expect(callsOf(backend, 'GET', '/clients/export')[0]?.params?.get('format')).toBe('csv');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('tells the person when the file could not be made', async () => {
    const user = userEvent.setup();
    const { names } = stubDownloads();
    setup({
      refusals: {
        'GET /clients/export': { status: 400, code: 'BAD_REQUEST', message: 'Too many clients.' },
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Export clients' }));

    expect(await screen.findByText('Could not export the clients')).toBeInTheDocument();
    expect(screen.getByText(/Too many clients\./)).toBeInTheDocument();
    expect(names).toEqual([]);
  });
});

describe('importing clients', () => {
  it('checks the file first, then imports the clients', async () => {
    const user = userEvent.setup();
    const backend = setup({ importResult: result() });
    const dialog = await openImport(user);

    expect(within(dialog).getByRole('button', { name: 'Check file' })).toBeDisabled();
    expect(within(dialog).getByText('No file chosen')).toBeInTheDocument();
    await user.upload(within(dialog).getByLabelText('CSV file'), csv());
    expect(within(dialog).getByText('clients.csv')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));

    expect(
      await within(dialog).findByText(/3 rows checked: 3 valid, 0 errors\./),
    ).toBeInTheDocument();
    expect(callsOf(backend, 'POST', '/imports/clients')[0]?.params?.get('dry_run')).toBe('true');

    await user.click(within(dialog).getByRole('button', { name: 'Import 3 clients' }));

    await waitFor(() => expect(callsOf(backend, 'POST', '/imports/clients')).toHaveLength(2));
    expect(callsOf(backend, 'POST', '/imports/clients')[1]?.params?.get('dry_run')).toBe('false');
    expect(await screen.findByText('3 clients imported')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Import clients' })).not.toBeInTheDocument(),
    );
  });

  it('lists the rows with errors and offers no import until the file is right', async () => {
    const user = userEvent.setup();
    setup({
      importResult: result({
        valid_rows: 1,
        errors: [
          { row: 2, field: 'email', code: 'invalid', message: 'Not an email address.' },
          { row: 3, field: 'name', code: 'required', message: 'A name is required.' },
        ],
        ignored_columns: ['favourite_colour'],
      }),
    });
    const dialog = await openImport(user);

    await user.upload(within(dialog).getByLabelText('CSV file'), csv());
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));

    expect(
      await within(dialog).findByText(/3 rows checked: 1 valid, 2 errors\./),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Ignored columns: favourite_colour')).toBeInTheDocument();
    const rows = within(within(dialog).getByRole('table', { name: 'Rows with errors' }))
      .getAllByRole('row')
      .slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('2');
    expect(rows[0]).toHaveTextContent('email');
    expect(rows[0]).toHaveTextContent('Not an email address.');
    expect(rows[1]).toHaveTextContent('A name is required.');
    expect(within(dialog).queryByRole('button', { name: /^Import \d/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Check file' })).toBeEnabled();
  });

  it('shows the rows of a file the API refused', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'POST /imports/clients': {
          status: 422,
          code: 'IMPORT_INVALID',
          message: 'The file has errors.',
          details: [{ row: 4, field: 'client_type', code: 'invalid', message: 'Unknown type.' }],
        },
      },
    });
    const dialog = await openImport(user);

    await user.upload(within(dialog).getByLabelText('CSV file'), csv());
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));

    expect(await within(dialog).findByText('The file has errors.')).toBeInTheDocument();
    expect(within(dialog).getByRole('table', { name: 'Rows with errors' })).toHaveTextContent(
      'Unknown type.',
    );
  });

  it('starts again when another file is chosen', async () => {
    const user = userEvent.setup();
    setup({ importResult: result() });
    const dialog = await openImport(user);

    await user.upload(within(dialog).getByLabelText('CSV file'), csv());
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));
    await within(dialog).findByText(/3 rows checked/);

    await user.upload(within(dialog).getByLabelText('CSV file'), csv('more.csv'));

    expect(within(dialog).queryByText(/rows checked/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Check file' })).toBeEnabled();
  });

  it('offers a template with the columns the import maps', async () => {
    const user = userEvent.setup();
    const { createObjectURL, names } = stubDownloads();
    setup();
    const dialog = await openImport(user);

    await user.click(within(dialog).getByRole('button', { name: 'Download template' }));

    expect(names).toEqual(['clients-import-template.csv']);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(await blob?.text()).toContain('code,name,client_type,status,email');
  });
});

describe('importing opening balances', () => {
  it('checks the file first, then imports the historic time', async () => {
    const user = userEvent.setup();
    const backend = setup({ openingBalanceResult: openingBalanceResult() }, IMPORTER);
    const dialog = await openOpeningBalanceImport(user);

    expect(within(dialog).getByRole('button', { name: 'Check file' })).toBeDisabled();
    await user.upload(within(dialog).getByLabelText('CSV file'), openingBalanceCsv());
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));

    expect(
      await within(dialog).findByText(/2 rows checked: 2 valid, 0 errors\./),
    ).toBeInTheDocument();
    expect(
      callsOf(backend, 'POST', '/imports/opening_balance_time')[0]?.params?.get('dry_run'),
    ).toBe('true');

    await user.click(within(dialog).getByRole('button', { name: 'Import 2 time entries' }));

    await waitFor(() =>
      expect(callsOf(backend, 'POST', '/imports/opening_balance_time')).toHaveLength(2),
    );
    expect(await screen.findByText('2 time entries imported')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Import historic time' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('lists the rows with errors and offers no import until the file is right', async () => {
    const user = userEvent.setup();
    setup(
      {
        openingBalanceResult: openingBalanceResult({
          valid_rows: 1,
          errors: [
            { row: 2, field: 'client', code: 'not_found', message: 'No client with that code.' },
          ],
        }),
      },
      IMPORTER,
    );
    const dialog = await openOpeningBalanceImport(user);

    await user.upload(within(dialog).getByLabelText('CSV file'), openingBalanceCsv());
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));

    expect(
      await within(dialog).findByText(/2 rows checked: 1 valid, 1 error\./),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('table', { name: 'Rows with errors' })).toHaveTextContent(
      'No client with that code.',
    );
    expect(within(dialog).queryByRole('button', { name: /^Import \d/ })).not.toBeInTheDocument();
  });

  it('offers a template with the columns the import maps', async () => {
    const user = userEvent.setup();
    const { createObjectURL, names } = stubDownloads();
    setup({}, IMPORTER);
    const dialog = await openOpeningBalanceImport(user);

    await user.click(within(dialog).getByRole('button', { name: 'Download template' }));

    expect(names).toEqual(['opening-balance-time-import-template.csv']);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(await blob?.text()).toContain('client,staff,date,hours,activity,job,billable');
  });
});

describe('the permissions', () => {
  it('lets someone who may view clients export them but not import', async () => {
    setup({}, READER);

    expect(await screen.findByRole('button', { name: 'Export clients' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Import clients' })).toBeDisabled();
    expect(
      screen.getByText('Importing clients needs permission to create them.'),
    ).toBeInTheDocument();
  });

  it('lets someone who may create clients import them but not export', async () => {
    setup({}, CREATOR);

    expect(await screen.findByRole('button', { name: 'Import clients' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Export clients' })).toBeDisabled();
    expect(
      screen.getByText('Exporting clients needs permission to view them.'),
    ).toBeInTheDocument();
  });

  it('needs some permission over the data to show the page', async () => {
    setup({}, ['organization.read']);

    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
  });

  it('disables the opening balance import without opening_balance.import', async () => {
    const user = userEvent.setup();
    setup({}, CREATOR);
    await openTab(user, 'Opening Balances');

    expect(screen.getByRole('button', { name: 'Import historic time' })).toBeDisabled();
    expect(
      screen.getByText('Importing opening balances needs the opening balance import permission.'),
    ).toBeInTheDocument();
  });
});

const bulkResult = (over: Partial<BulkImportResult> = {}): BulkImportResult => ({
  dry_run: true,
  total_rows: 3,
  valid_rows: 3,
  created: 0,
  columns: ['full_name', 'grade', 'start_date'],
  ignored_columns: [],
  errors: [],
  items: [],
  counts: {},
  ...over,
});

const KINDS = [
  { noun: 'staff', file: 'staff.csv', many: 'staff members' },
  { noun: 'rates', file: 'rates.csv', many: 'rates' },
  { noun: 'jobs', file: 'jobs.csv', many: 'jobs' },
] as const;

async function openBulkImport(user: ReturnType<typeof userEvent.setup>, noun: string) {
  await openTab(user, 'Staff, rates & jobs');
  await user.click(await screen.findByRole('button', { name: `Import ${noun}` }));
  return screen.findByRole('dialog', { name: `Import ${noun}` });
}

describe.each(KINDS)('exporting and importing $noun', ({ noun, file, many }) => {
  it('downloads them as a CSV file', async () => {
    const user = userEvent.setup();
    const { createObjectURL, names } = stubDownloads();
    const backend = setup();
    await openTab(user, 'Staff, rates & jobs');

    await user.click(await screen.findByRole('button', { name: `Export ${noun} (CSV)` }));

    await waitFor(() => expect(names).toEqual([file]));
    expect(callsOf(backend, 'GET', `/${noun}/export`)).toHaveLength(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('tells the person when the file could not be made', async () => {
    const user = userEvent.setup();
    const { names } = stubDownloads();
    setup({
      refusals: {
        [`GET /${noun}/export`]: {
          status: 400,
          code: 'BAD_REQUEST',
          message: 'Too many rows.',
        },
      },
    });
    await openTab(user, 'Staff, rates & jobs');

    await user.click(await screen.findByRole('button', { name: `Export ${noun} (CSV)` }));

    expect(await screen.findByText(`Could not export the ${noun}`)).toBeInTheDocument();
    expect(names).toEqual([]);
  });

  it('checks the file first, then imports the rows', async () => {
    const user = userEvent.setup();
    const backend = setup({ bulkResult: bulkResult() });
    const dialog = await openBulkImport(user, noun);

    expect(within(dialog).getByRole('button', { name: 'Check file' })).toBeDisabled();
    expect(within(dialog).getByText('No file chosen')).toBeInTheDocument();
    await user.upload(within(dialog).getByLabelText('CSV file'), csv(file));
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));

    expect(
      await within(dialog).findByText(/3 rows checked: 3 valid, 0 errors\./),
    ).toBeInTheDocument();
    expect(callsOf(backend, 'POST', `/imports/${noun}`)[0]?.params?.get('dry_run')).toBe('true');

    await user.click(within(dialog).getByRole('button', { name: `Import 3 ${many}` }));

    await waitFor(() => expect(callsOf(backend, 'POST', `/imports/${noun}`)).toHaveLength(2));
    expect(callsOf(backend, 'POST', `/imports/${noun}`)[1]?.params?.get('dry_run')).toBe('false');
    expect(await screen.findByText(`3 ${many} imported`)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: `Import ${noun}` })).not.toBeInTheDocument(),
    );
  });

  it('lists the rows with errors and offers no import until the file is right', async () => {
    const user = userEvent.setup();
    setup({
      bulkResult: bulkResult({
        valid_rows: 1,
        errors: [
          { row: 2, field: 'grade', code: 'unknown_grade', message: 'There is no grade XYZ.' },
          { row: 3, field: 'start_date', code: 'missing', message: 'This value is required.' },
        ],
        ignored_columns: ['favourite_colour'],
      }),
    });
    const dialog = await openBulkImport(user, noun);

    await user.upload(within(dialog).getByLabelText('CSV file'), csv(file));
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));

    expect(
      await within(dialog).findByText(/3 rows checked: 1 valid, 2 errors\./),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Ignored columns: favourite_colour')).toBeInTheDocument();
    const rows = within(within(dialog).getByRole('table', { name: 'Rows with errors' }))
      .getAllByRole('row')
      .slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('There is no grade XYZ.');
    expect(rows[1]).toHaveTextContent('This value is required.');
    expect(within(dialog).queryByRole('button', { name: /^Import \d/ })).not.toBeInTheDocument();
  });

  it('shows the rows of a file the API refused', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        [`POST /imports/${noun}`]: {
          status: 422,
          code: 'IMPORT_INVALID',
          message: 'The file has errors.',
          details: [{ row: 4, field: 'grade', code: 'unknown_grade', message: 'Unknown grade.' }],
        },
      },
    });
    const dialog = await openBulkImport(user, noun);

    await user.upload(within(dialog).getByLabelText('CSV file'), csv(file));
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));

    expect(await within(dialog).findByText('The file has errors.')).toBeInTheDocument();
    expect(within(dialog).getByRole('table', { name: 'Rows with errors' })).toHaveTextContent(
      'Unknown grade.',
    );
  });

  it('lists the columns and offers a template with them', async () => {
    const user = userEvent.setup();
    const { createObjectURL, names } = stubDownloads();
    setup();
    const dialog = await openBulkImport(user, noun);

    expect(within(dialog).getByText(/Required columns:/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Download template' }));

    expect(names).toEqual([`${noun}-import-template.csv`]);
    const blob = createObjectURL.mock.calls[0]?.[0];
    const text = (await blob?.text()) ?? '';
    expect(text.split('\r\n')[0]).toContain(
      noun === 'jobs'
        ? 'name,client_code'
        : noun === 'rates'
          ? 'kind,staff_code'
          : 'code,full_name',
    );
  });

  it('starts again when another file is chosen', async () => {
    const user = userEvent.setup();
    setup({ bulkResult: bulkResult() });
    const dialog = await openBulkImport(user, noun);

    await user.upload(within(dialog).getByLabelText('CSV file'), csv(file));
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));
    await within(dialog).findByText(/3 rows checked/);

    await user.upload(within(dialog).getByLabelText('CSV file'), csv('more.csv'));

    expect(within(dialog).queryByText(/rows checked/)).not.toBeInTheDocument();
  });
});

describe('importing staff with rates', () => {
  it('says how many rates came with the staff', async () => {
    const user = userEvent.setup();
    setup({ bulkResult: bulkResult({ valid_rows: 2, counts: { rates: 3 } }) });
    const dialog = await openBulkImport(user, 'staff');

    await user.upload(within(dialog).getByLabelText('CSV file'), csv('staff.csv'));
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Import 2 staff members' }));

    expect(await screen.findByText('2 staff members imported, with 3 rates')).toBeInTheDocument();
  });
});

describe('importing rates', () => {
  it('sends close_previous when asked to end the earlier rate', async () => {
    const user = userEvent.setup();
    const backend = setup({ bulkResult: bulkResult() });
    const dialog = await openBulkImport(user, 'rates');

    await user.click(within(dialog).getByRole('checkbox', { name: /End the earlier rate/ }));
    await user.upload(within(dialog).getByLabelText('CSV file'), csv('rates.csv'));
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));
    await within(dialog).findByText(/3 rows checked/);

    expect(callsOf(backend, 'POST', '/imports/rates')[0]?.params?.get('close_previous')).toBe(
      'true',
    );
  });

  it('does not send it by default', async () => {
    const user = userEvent.setup();
    const backend = setup({ bulkResult: bulkResult() });
    const dialog = await openBulkImport(user, 'rates');

    await user.upload(within(dialog).getByLabelText('CSV file'), csv('rates.csv'));
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));
    await within(dialog).findByText(/3 rows checked/);

    expect(callsOf(backend, 'POST', '/imports/rates')[0]?.params?.get('close_previous')).toBe(
      'false',
    );
  });
});

describe('the staff, rates and jobs permissions', () => {
  const only = (...codes: string[]) => ['organization.read', ...codes];

  it.each([
    ['member.read', 'staff', 'Staff', 'add staff'],
    ['rate.read', 'rates', 'Rates', 'manage rates'],
    ['job.read', 'jobs', 'Jobs', 'create jobs'],
  ])('needs more than %s to import %s', async (read, noun, region, writes) => {
    const user = userEvent.setup();
    setup({}, only(BULK, read));
    await openTab(user, 'Staff, rates & jobs');
    const section = await screen.findByRole('region', { name: region });

    expect(within(section).getByRole('button', { name: `Export ${noun} (CSV)` })).toBeEnabled();
    expect(within(section).getByRole('button', { name: `Import ${noun}` })).toBeDisabled();
    expect(
      within(section).getByText(`Importing needs permission to ${writes}.`),
    ).toBeInTheDocument();
  });

  it('disables a side that lacks its own permission', async () => {
    const user = userEvent.setup();
    setup({}, only(BULK, 'member.invite'));
    await openTab(user, 'Staff, rates & jobs');
    const section = await screen.findByRole('region', { name: 'Staff' });

    expect(within(section).getByRole('button', { name: 'Export staff (CSV)' })).toBeDisabled();
    expect(within(section).getByRole('button', { name: 'Import staff' })).toBeEnabled();
    expect(
      within(section).getByText('Exporting needs permission to view staff.'),
    ).toBeInTheDocument();
  });

  it('disables everything without the import and export permission', async () => {
    const user = userEvent.setup();
    setup({}, only('client.read', 'member.read', 'member.invite', 'rate.read', 'job.read'));
    await openTab(user, 'Staff, rates & jobs');

    for (const noun of ['staff', 'rates', 'jobs']) {
      expect(screen.getByRole('button', { name: `Export ${noun} (CSV)` })).toBeDisabled();
      expect(screen.getByRole('button', { name: `Import ${noun}` })).toBeDisabled();
    }
    expect(
      screen.getAllByText('Importing and exporting need the import and export permission.'),
    ).toHaveLength(3);
  });

  it('shows the page to someone who only holds the import and export permission', async () => {
    setup({}, only(BULK));

    expect(await screen.findByRole('tab', { name: 'Staff, rates & jobs' })).toBeInTheDocument();
  });
});
