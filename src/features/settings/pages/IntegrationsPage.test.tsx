import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { adminHandlers, callsOf, createBackend, type AdminBackend } from '../test/adminHandlers';
import IntegrationsPage from './IntegrationsPage';

const READER = ['organization.read', 'integration.read'];

function setup(init: Partial<AdminBackend> = {}, permissions = OWNER_PERMISSIONS) {
  const backend = createBackend(init);
  server.use(...adminHandlers(backend));
  renderInOrg(<IntegrationsPage />, { context: contextWith(permissions) });
  return backend;
}

const cardOf = async (name: string) => within(await screen.findByRole('region', { name }));

const itemsTable = async () => {
  const element = await screen.findByRole('table', { name: 'Sync items' });
  await waitFor(() => expect(element).not.toHaveAttribute('aria-busy', 'true'));
  return element;
};

const rowsOf = (element: HTMLElement) => within(element).getAllByRole('row').slice(1);

const itemCalls = (backend: AdminBackend) => callsOf(backend, 'GET', '/integrations/sync-items');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the cards', () => {
  it('shows each integration with where it stands and what it holds', async () => {
    setup();

    const central = await cardOf('Central Client');
    expect(central.getByText('Connected')).toBeInTheDocument();
    expect(central.getByText('Linked clients').nextSibling).toHaveTextContent('12');
    expect(central.getByText('Out of date').nextSibling).toHaveTextContent('1');

    const user = await cardOf('Central User');
    expect(user.getByText('Ready')).toBeInTheDocument();
    expect(user.getByText('Last success').nextSibling).toHaveTextContent('Never');

    const pm = await cardOf('Practice Management');
    expect(pm.getByText('Off')).toBeInTheDocument();

    const bookkeeping = await cardOf('Bookkeeping');
    expect(bookkeeping.getByText('Needs attention')).toBeInTheDocument();
    expect(bookkeeping.getByRole('alert')).toHaveTextContent(
      'Services without an income account: Audit',
    );
    expect(bookkeeping.getByText('Waiting').nextSibling).toHaveTextContent('1');
    expect(bookkeeping.getByText('Failed').nextSibling).toHaveTextContent('2');
    expect(bookkeeping.getByText('Documents sent').nextSibling).toHaveTextContent('7');
  });

  it('cannot switch off the central client service', async () => {
    setup();
    const central = await cardOf('Central Client');

    expect(central.getByRole('switch', { name: 'Enabled' })).toBeDisabled();
    expect(central.getByText('Always on: it is part of the client flow.')).toBeInTheDocument();
  });

  it('switches an integration on, and off again', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const pm = await cardOf('Practice Management');

    await user.click(pm.getByRole('switch', { name: 'Enabled' }));

    await waitFor(() =>
      expect(callsOf(backend, 'PATCH', '/integrations/practice_management')).toHaveLength(1),
    );
    expect(callsOf(backend, 'PATCH', '/integrations/practice_management')[0]?.body).toEqual({
      enabled: true,
    });
    expect(await screen.findByText('Practice Management switched on')).toBeInTheDocument();
    await waitFor(async () =>
      expect((await cardOf('Practice Management')).getByText('Ready')).toBeInTheDocument(),
    );

    await user.click(
      (await cardOf('Practice Management')).getByRole('switch', { name: 'Enabled' }),
    );
    await waitFor(() =>
      expect(callsOf(backend, 'PATCH', '/integrations/practice_management')).toHaveLength(2),
    );
    expect(callsOf(backend, 'PATCH', '/integrations/practice_management')[1]?.body).toEqual({
      enabled: false,
    });
    expect(await screen.findByText('Practice Management switched off')).toBeInTheDocument();
  });

  it('keeps the settings of an integration that is off out of reach', async () => {
    setup();
    const pm = await cardOf('Practice Management');

    expect(pm.getByRole('switch', { name: 'Keep statuses in step' })).toBeDisabled();
    expect(pm.getByRole('button', { name: 'Run now' })).toBeDisabled();
  });

  it('changes the settings of practice management', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(
      (await cardOf('Practice Management')).getByRole('switch', { name: 'Enabled' }),
    );
    const pm = await cardOf('Practice Management');
    await waitFor(() =>
      expect(pm.getByRole('switch', { name: 'Keep statuses in step' })).toBeEnabled(),
    );

    await user.click(pm.getByRole('switch', { name: 'Keep statuses in step' }));

    await waitFor(() =>
      expect(callsOf(backend, 'PATCH', '/integrations/practice_management')).toHaveLength(2),
    );
    expect(callsOf(backend, 'PATCH', '/integrations/practice_management')[1]?.body).toEqual({
      config: { sync_statuses: false },
    });
    expect(await screen.findByText('Setting saved')).toBeInTheDocument();
  });

  it('changes what bookkeeping sends, and from when', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const bookkeeping = await cardOf('Bookkeeping');

    await user.click(bookkeeping.getByRole('switch', { name: 'Send invoices' }));
    await waitFor(() =>
      expect(callsOf(backend, 'PATCH', '/integrations/bookkeeping')).toHaveLength(1),
    );
    expect(callsOf(backend, 'PATCH', '/integrations/bookkeeping')[0]?.body).toEqual({
      config: { send_invoices: false },
    });

    fireEvent.change((await cardOf('Bookkeeping')).getByLabelText('Send documents issued from'), {
      target: { value: '2026-07-01' },
    });
    await waitFor(() =>
      expect(callsOf(backend, 'PATCH', '/integrations/bookkeeping')).toHaveLength(2),
    );
    expect(callsOf(backend, 'PATCH', '/integrations/bookkeeping')[1]?.body).toEqual({
      config: { send_from: '2026-07-01' },
    });

    await waitFor(async () =>
      expect(
        (await cardOf('Bookkeeping')).getByLabelText('Send documents issued from'),
      ).toHaveValue('2026-07-01'),
    );
    fireEvent.change((await cardOf('Bookkeeping')).getByLabelText('Send documents issued from'), {
      target: { value: '' },
    });
    await waitFor(() =>
      expect(callsOf(backend, 'PATCH', '/integrations/bookkeeping')).toHaveLength(3),
    );
    expect(callsOf(backend, 'PATCH', '/integrations/bookkeeping')[2]?.body).toEqual({
      config: { send_from: null },
    });
  });

  it('says what the API refused', async () => {
    const user = userEvent.setup();
    setup({
      refusals: {
        'PATCH /integrations/bookkeeping': {
          status: 409,
          code: 'INTEGRATION_ALWAYS_ON',
          message: 'Bookkeeping cannot be switched off.',
        },
      },
    });

    await user.click((await cardOf('Bookkeeping')).getByRole('switch', { name: 'Enabled' }));

    expect(await screen.findByText('Could not change the integration')).toBeInTheDocument();
    expect(screen.getByText(/Bookkeeping cannot be switched off\./)).toBeInTheDocument();
  });
});

describe('running an integration', () => {
  it('runs it now, and says what came of it', async () => {
    const user = userEvent.setup();
    const backend = setup();

    await user.click((await cardOf('Bookkeeping')).getByRole('button', { name: 'Run now' }));

    await waitFor(() =>
      expect(callsOf(backend, 'POST', '/integrations/bookkeeping/sync')).toHaveLength(1),
    );
    expect(await screen.findByText('Bookkeeping: 2 documents sent.')).toBeInTheDocument();
  });

  it('warns when the other system is not available and the work stays queued', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(
      (await cardOf('Bookkeeping')).getByRole('switch', { name: 'Mock service is available' }),
    );
    await waitFor(() =>
      expect(callsOf(backend, 'POST', '/integrations/bookkeeping/mock/availability')).toHaveLength(
        1,
      ),
    );
    expect(
      callsOf(backend, 'POST', '/integrations/bookkeeping/mock/availability')[0]?.body,
    ).toEqual({
      available: false,
    });
    expect(await screen.findByText('Mock service is off')).toBeInTheDocument();

    await user.click((await cardOf('Bookkeeping')).getByRole('button', { name: 'Run now' }));

    expect(await screen.findByText(/the work stays queued/)).toBeInTheDocument();
  });

  it('retries every failed item, and the card follows', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const bookkeeping = await cardOf('Bookkeeping');

    await user.click(bookkeeping.getByRole('button', { name: 'Retry 2 failed' }));

    await waitFor(() =>
      expect(callsOf(backend, 'POST', '/integrations/bookkeeping/retry-failed')).toHaveLength(1),
    );
    expect(await screen.findByText('2 of 2 failed items sent')).toBeInTheDocument();
    await waitFor(async () =>
      expect(
        (await cardOf('Bookkeeping')).queryByRole('button', { name: /^Retry \d+ failed$/ }),
      ).not.toBeInTheDocument(),
    );
    expect((await cardOf('Bookkeeping')).getByText('Connected')).toBeInTheDocument();
  });

  it('cannot run an integration that is switched off', async () => {
    const user = userEvent.setup();
    const backend = setup();

    await user.click(
      (await cardOf('Practice Management')).getByRole('button', { name: 'Run now' }),
    );

    expect(callsOf(backend, 'POST', '/integrations/practice_management/sync')).toHaveLength(0);
  });
});

describe('the sync items', () => {
  it('lists what was queued with where it stands and why it failed', async () => {
    setup();
    const rows = rowsOf(await itemsTable());

    expect(rows).toHaveLength(4);
    for (const text of [
      'INV-0001',
      'Invoice',
      'Bookkeeping',
      'Send invoice',
      'Failed',
      '5 of 5',
      'Service Audit has no income account.',
      'UNMAPPED',
    ]) {
      expect(rows[0]).toHaveTextContent(text);
    }
    expect(rows[1]).toHaveTextContent('Credit note');
    expect(rows[2]).toHaveTextContent('Sent');
    expect(rows[2]).toHaveTextContent('Reference BK-77');
    expect(rows[3]).toHaveTextContent('Waiting');
    expect(rows[3]).toHaveTextContent('Next try');
    expect(rows[3]).toHaveTextContent('UNAVAILABLE');
  });

  it('narrows to a status and to an integration', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await itemsTable();

    await user.selectOptions(screen.getByLabelText('Status'), 'Failed');
    await waitFor(() => expect(itemCalls(backend).at(-1)?.params?.get('status')).toBe('failed'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Sync items' }))).toHaveLength(2),
    );

    await user.selectOptions(screen.getByLabelText('Integration'), 'Practice Management');
    await waitFor(() =>
      expect(itemCalls(backend).at(-1)?.params?.get('integration')).toBe('practice_management'),
    );
    expect(await screen.findByText('No sync items match')).toBeInTheDocument();
  });

  it('searches by record or error', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await itemsTable();

    await user.type(screen.getByRole('searchbox', { name: 'Search sync items' }), 'CN-0002');

    await waitFor(() => expect(itemCalls(backend).at(-1)?.params?.get('q')).toBe('CN-0002'));
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Sync items' }))).toHaveLength(1),
    );
  });

  it('shows the items of one integration from its card', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await itemsTable();

    await user.click((await cardOf('Central Client')).getByRole('button', { name: 'Sync items' }));

    await waitFor(() =>
      expect(itemCalls(backend).at(-1)?.params?.get('integration')).toBe('central_client'),
    );
    expect(screen.getByLabelText('Integration')).toHaveValue('central_client');
  });

  it('retries one item now', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await itemsTable();

    await user.click(screen.getByRole('button', { name: 'Retry INV-0001' }));

    await waitFor(() =>
      expect(callsOf(backend, 'POST', '/integrations/sync-items/0001/retry')).toHaveLength(1),
    );
    expect(await screen.findByText('INV-0001: Sent')).toBeInTheDocument();
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Sync items' }))[0]).toHaveTextContent(
        'Reference BK-NEW',
      ),
    );
    expect(screen.queryByRole('button', { name: 'Retry INV-0001' })).not.toBeInTheDocument();
  });

  it('offers a retry only for what failed or is waiting, and only to those who may manage', async () => {
    setup({}, READER);
    await itemsTable();

    expect(screen.queryByRole('button', { name: /^Retry INV/ })).not.toBeInTheDocument();
    expect(screen.getByText(/needs\s+permission to manage integrations/)).toBeInTheDocument();
  });

  it('says so when nothing was queued', async () => {
    setup({ items: [] });
    expect(await screen.findByText('Nothing to sync yet')).toBeInTheDocument();
  });

  it('loads more items a page at a time', async () => {
    const user = userEvent.setup();
    const backend = setup({ pageSize: 3 });
    expect(rowsOf(await itemsTable())).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Load more items' }));

    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Sync items' }))).toHaveLength(4),
    );
    expect(itemCalls(backend)[1]?.params?.get('cursor')).toBe('3');
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: {
        'GET /integrations/sync-items': { status: 500, code: 'SERVER_ERROR', message: 'Down.' },
      },
    });
    expect(await screen.findByText('Could not load the sync items')).toBeInTheDocument();

    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(rowsOf(await itemsTable())).toHaveLength(4);
  });
});

describe('the sync log', () => {
  it('lists every attempt, newest first, and narrows to an outcome', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await screen.findByRole('tab', { name: 'Sync log' }));

    const table = await screen.findByRole('table', { name: 'Sync log' });
    await waitFor(() => expect(table).not.toHaveAttribute('aria-busy', 'true'));
    const rows = rowsOf(table);
    expect(rows).toHaveLength(3);
    for (const text of [
      'Central Client',
      'Sync',
      'Received',
      'Client',
      'Worked',
      'Client updated from the central service.',
    ]) {
      expect(rows[0]).toHaveTextContent(text);
    }
    expect(rows[1]).toHaveTextContent('Failed');
    expect(rows[1]).toHaveTextContent('The central service did not answer.');
    expect(rows[2]).toHaveTextContent('Skipped');

    await user.selectOptions(screen.getByLabelText('Outcome'), 'Failed');
    await waitFor(() =>
      expect(callsOf(backend, 'GET', '/integrations/sync-logs').at(-1)?.params?.get('status')).toBe(
        'failed',
      ),
    );
    await waitFor(() =>
      expect(rowsOf(screen.getByRole('table', { name: 'Sync log' }))).toHaveLength(1),
    );
  });
});

describe('the mappings', () => {
  async function openMappings(user: ReturnType<typeof userEvent.setup>) {
    await user.click((await cardOf('Bookkeeping')).getByRole('button', { name: 'Mappings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bookkeeping mappings' });
    await within(dialog).findByLabelText('Account code for Audit');
    return dialog;
  }

  it('shows what is mapped and what is not', async () => {
    const user = userEvent.setup();
    setup();
    const dialog = await openMappings(user);

    expect(within(dialog).getByRole('status')).toHaveTextContent(
      '1 of 3 services and 1 of 2 VAT codes are not mapped.',
    );
    expect(within(dialog).getByLabelText('Account code for Lines without a service')).toHaveValue(
      '4000',
    );
    expect(within(dialog).getByLabelText('Account name for Bookkeeping')).toHaveValue(
      'Bookkeeping income',
    );
    expect(within(dialog).getByLabelText('Account code for Audit')).toHaveValue('');
    expect(within(dialog).getByLabelText('Tax code for Lines without a VAT code')).toHaveValue(
      'NONE',
    );
    expect(within(dialog).getByLabelText('Tax code for Standard 20%')).toHaveValue('');
  });

  it('saves the complete set of mappings', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openMappings(user);

    await user.type(within(dialog).getByLabelText('Account code for Audit'), '4020');
    await user.type(within(dialog).getByLabelText('Tax code for Standard 20%'), 'OUT20');
    await user.click(within(dialog).getByRole('button', { name: 'Save mappings' }));

    await waitFor(() =>
      expect(callsOf(backend, 'PUT', '/integrations/bookkeeping/mappings')).toHaveLength(1),
    );
    expect(callsOf(backend, 'PUT', '/integrations/bookkeeping/mappings')[0]?.body).toEqual({
      services: [
        { service_id: null, account_code: '4000', account_name: 'Sales' },
        { service_id: 'svc-audit', account_code: '4020', account_name: null },
        { service_id: 'svc-books', account_code: '4010', account_name: 'Bookkeeping income' },
      ],
      vat_rates: [
        { vat_rate_id: null, tax_code: 'NONE', tax_name: null },
        { vat_rate_id: 'vat-std', tax_code: 'OUT20', tax_name: null },
      ],
    });
    expect(await screen.findByText('Mappings saved')).toBeInTheDocument();
    expect(
      screen.getByText('Everything is mapped. Retry the failed items to send them.'),
    ).toBeInTheDocument();
  });

  it('leaves out a row whose code was cleared, which unmaps it', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openMappings(user);

    await user.clear(within(dialog).getByLabelText('Account code for Bookkeeping'));
    await user.click(within(dialog).getByRole('button', { name: 'Save mappings' }));

    await waitFor(() =>
      expect(callsOf(backend, 'PUT', '/integrations/bookkeeping/mappings')).toHaveLength(1),
    );
    const body = callsOf(backend, 'PUT', '/integrations/bookkeeping/mappings')[0]?.body as {
      services: Array<{ service_id: string | null }>;
    };
    expect(body.services.map((row) => row.service_id)).toEqual([null]);
  });

  it('refuses a code the bookkeeping system could not take, without asking the API', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const dialog = await openMappings(user);

    await user.type(within(dialog).getByLabelText('Account code for Audit'), 'bad code!');
    await user.click(within(dialog).getByRole('button', { name: 'Save mappings' }));

    expect(
      await within(dialog).findByText('Use letters, digits and . _ / - (1 to 20 characters)'),
    ).toBeInTheDocument();
    expect(callsOf(backend, 'PUT', '/integrations/bookkeeping/mappings')).toHaveLength(0);
  });

  it('can be read but not changed by someone who may not manage integrations', async () => {
    const user = userEvent.setup();
    setup({}, READER);
    const dialog = await openMappings(user);

    expect(within(dialog).getByLabelText('Account code for Audit')).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Save mappings' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: {
        'GET /integrations/bookkeeping/mappings': {
          status: 500,
          code: 'SERVER_ERROR',
          message: 'Down.',
        },
      },
    });
    await user.click((await cardOf('Bookkeeping')).getByRole('button', { name: 'Mappings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bookkeeping mappings' });
    expect(await within(dialog).findByText('Could not load the mappings')).toBeInTheDocument();

    backend.refusals = {};
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByLabelText('Account code for Audit')).toBeInTheDocument();
  });
});

describe('the permissions', () => {
  it('lets someone who may only read see everything and change nothing', async () => {
    setup({}, READER);
    const bookkeeping = await cardOf('Bookkeeping');

    expect(bookkeeping.getByRole('switch', { name: 'Enabled' })).toBeDisabled();
    expect(bookkeeping.getByRole('switch', { name: 'Send invoices' })).toBeDisabled();
    expect(bookkeeping.getByRole('button', { name: 'Run now' })).toBeDisabled();
    expect(bookkeeping.getByRole('button', { name: 'Retry 2 failed' })).toBeDisabled();
    expect(bookkeeping.getByRole('button', { name: 'Mappings' })).toBeEnabled();
  });

  it('needs permission to read the integrations, and asks the API for nothing without it', async () => {
    const backend = setup({}, ['organization.read']);

    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(callsOf(backend, 'GET', '/integrations')).toHaveLength(0);
  });
});

describe('a failed load', () => {
  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    const backend = setup({
      refusals: { 'GET /integrations': { status: 500, code: 'SERVER_ERROR', message: 'Down.' } },
    });

    expect(await screen.findByText('Could not load the integrations')).toBeInTheDocument();
    backend.refusals = {};
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Bookkeeping' })).toBeInTheDocument();
  });
});
