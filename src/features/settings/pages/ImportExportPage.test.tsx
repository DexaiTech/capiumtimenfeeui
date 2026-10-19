import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import type { ImportResult } from '../adminTypes';
import { adminHandlers, callsOf, createBackend, type AdminBackend } from '../test/adminHandlers';
import ImportExportPage from './ImportExportPage';

const READER = ['organization.read', 'client.read'];
const CREATOR = ['organization.read', 'client.create'];

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

  it('says what is not available yet, on its own tab', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('tab', { name: 'Staff, rates & jobs' }));

    const others = screen.getByRole('region', { name: 'Staff, rates and jobs' });
    expect(within(others).getAllByText('Not available yet')).toHaveLength(3);
    expect(within(others).getByRole('link', { name: 'Open Staff' })).toHaveAttribute(
      'href',
      '/acme/team/staff',
    );
    expect(within(others).getByRole('link', { name: 'Open Rates' })).toHaveAttribute(
      'href',
      '/acme/team/charge-out-rates',
    );
    expect(within(others).getByRole('link', { name: 'Open Jobs' })).toHaveAttribute(
      'href',
      '/acme/settings/integrations',
    );
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
});
