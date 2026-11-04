import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tokenStore } from '@/services/api';
import { contextWith, ownerContext, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { findRowAction, rowAction, rowActionNames } from '@/test/rowActions';
import { fail, ok, server } from '@/test/server';

import { CLIENTS_PREFS_KEY, INITIAL_CLIENTS_PREFS, useClientsPrefs } from '../store';
import { mutual, techwave, techwaveDetail } from '../test/fixtures';
import { clientsHandlers } from '../test/handlers';
import ClientsPage from './ClientsPage';

function Where() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

const table = () => screen.getByRole('table', { name: 'Clients' });
const clientRow = (name: string) => screen.findByRole('row', { name });

beforeEach(() => {
  window.localStorage.clear();
  useClientsPrefs.setState(INITIAL_CLIENTS_PREFS);
});

describe('ClientsPage list', () => {
  it('renders the rows with the columns of APT76', async () => {
    server.use(...clientsHandlers());
    renderInOrg(<ClientsPage />);

    const row = await clientRow(techwave.name);
    const headers = within(table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    // Client, Client Type, Registration, Services, then the actions. Contact details are on the
    // client's own page, deadlines in Practice Manager, and Central is gone (APT76).
    expect(headers).toEqual(['', 'Client', 'Client Type', 'Registration', 'Services', 'Action']);

    const cells = within(row);
    expect(cells.getByText('Techwave Innovations Ltd')).toHaveAttribute(
      'title',
      'Techwave Innovations Ltd',
    );
    expect(cells.getByText('APX006')).toBeInTheDocument();
    expect(cells.getByText('Limited')).toBeInTheDocument();
    expect(cells.getByText('xero')).toBeInTheDocument();
    expect(cells.getByText('678654QJ')).toBeInTheDocument();
    // Segment and Activity are shown from Show/Hide Columns.
    expect(cells.queryByText('Bronze')).not.toBeInTheDocument();
    // The health score is not a grid column (APT73).
    expect(cells.queryByRole('meter', { name: 'Health score' })).not.toBeInTheDocument();
    expect(row).not.toHaveTextContent('83/100');
    expect(cells.queryByText('Ramya Menon')).not.toBeInTheDocument();
    expect(cells.queryByText('ramya@techwave.example')).not.toBeInTheDocument();
    expect(cells.queryByText('1 Overdue by 1d')).not.toBeInTheDocument();
    expect(cells.queryByText('20/05/2026 - 09:23PM')).not.toBeInTheDocument();
    expect(cells.getByText('Accounts')).toBeInTheDocument();
    expect(cells.getByRole('button', { name: 'Show all 2 services' })).toHaveTextContent('+1');
    expect(cells.queryByText('Local')).not.toBeInTheDocument();
    expect(cells.getByRole('checkbox', { name: `Select ${techwave.name}` })).toBeInTheDocument();

    const second = await clientRow(mutual.name);
    expect(within(second).getByText('Sole Trader')).toBeInTheDocument();
    expect(within(second).queryByText('2 Due today')).not.toBeInTheDocument();
    expect(
      within(second).queryByRole('button', { name: `Add contact for ${mutual.name}` }),
    ).not.toBeInTheDocument();

    // The client count comes from the summary; there is no Users tab.
    expect(await screen.findByText('12', { selector: '.cc-count' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Users/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'AML' })).not.toBeInTheDocument();
  });

  it('debounces the quick search and sends q once typing stops', async () => {
    const queries: Array<string | null> = [];
    server.use(...clientsHandlers({ onList: (params) => queries.push(params.get('q')) }));
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);

    await user.type(screen.getByRole('searchbox', { name: 'Quick search clients' }), 'wave');

    await waitFor(() => expect(queries).toContain('wave'));
    expect(queries.filter((q) => q !== null)).toEqual(['wave']);
    await waitFor(() => expect(screen.queryByRole('row', { name: mutual.name })).toBeNull());
    expect(screen.getByRole('row', { name: techwave.name })).toBeInTheDocument();
  });

  it('toggles the sort and order of a header and reports aria-sort', async () => {
    // Segment is shown from Show/Hide Columns.
    useClientsPrefs.setState({ hiddenColumns: [] });
    const sorts: string[] = [];
    server.use(
      ...clientsHandlers({
        onList: (params) => sorts.push(`${params.get('sort')}:${params.get('order')}`),
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);
    expect(sorts).toEqual(['name:asc']);

    const clientHeader = screen.getByRole('columnheader', { name: 'Client' });
    expect(clientHeader).toHaveAttribute('aria-sort', 'ascending');
    await user.click(within(clientHeader).getByRole('button', { name: 'Client' }));
    await waitFor(() => expect(sorts).toContain('name:desc'));
    expect(clientHeader).toHaveAttribute('aria-sort', 'descending');

    const segmentHeader = screen.getByRole('columnheader', { name: 'Segment' });
    await user.click(within(segmentHeader).getByRole('button', { name: 'Segment' }));
    await waitFor(() => expect(sorts).toContain('segment:asc'));
    expect(segmentHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(clientHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('hides a column and remembers it after a reload', async () => {
    server.use(...clientsHandlers());
    const user = userEvent.setup();
    const view = renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);

    await user.click(screen.getByRole('button', { name: /Show\/Hide Columns/ }));
    const panel = await screen.findByRole('dialog', { name: 'Show or hide columns' });
    await user.click(within(panel).getByRole('checkbox', { name: 'Registration' }));

    expect(screen.queryByRole('columnheader', { name: 'Registration' })).toBeNull();
    expect(screen.queryByText('678654QJ')).toBeNull();
    expect(window.localStorage.getItem(CLIENTS_PREFS_KEY)).toContain('reg_no');

    view.unmount();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);
    expect(screen.queryByRole('columnheader', { name: 'Registration' })).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Services' })).toBeInTheDocument();
  });

  it('builds the list query from the filters and the Drafts button', async () => {
    const seen: URLSearchParams[] = [];
    server.use(...clientsHandlers({ onList: (params) => seen.push(params) }));
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);

    await user.click(screen.getByRole('button', { name: /^Filter$/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter clients' });
    const status = within(within(panel).getByRole('group', { name: 'Status' }));
    await user.click(status.getByRole('checkbox', { name: 'Active' }));
    await user.click(status.getByRole('checkbox', { name: 'Inactive' }));
    // There is no AML filter any more.
    expect(within(panel).queryByRole('group', { name: 'AML status' })).not.toBeInTheDocument();
    const segment = within(within(panel).getByRole('group', { name: 'Segment' }));
    await user.click(segment.getByRole('checkbox', { name: 'Gold' }));
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Service' }), 'Payroll');
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Manager' }),
      'Grace Hopper',
    );

    await waitFor(() => {
      const last = seen.at(-1);
      expect(last?.getAll('status')).toEqual(['active', 'inactive']);
      expect(last?.has('aml_status')).toBe(false);
      expect(last?.getAll('segment')).toEqual(['Gold']);
      expect(last?.get('service_id')).toBe('0198c1f2-0000-7000-8000-00000000e003');
      expect(last?.get('manager_user_id')).toBe('0198c1f2-0000-7000-8000-00000000f001');
    });
    expect(screen.getByRole('button', { name: /Filter.*5 filters applied/ })).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Drafts' }));
    await waitFor(() => expect(seen.at(-1)?.getAll('status')).toEqual(['prospect']));
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers the segments of Settings in the filter and opens on ?segment=', async () => {
    const seen: URLSearchParams[] = [];
    server.use(...clientsHandlers({ onList: (params) => seen.push(params) }));
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />, { route: '/acme/clients?segment=Silver' });
    await clientRow(techwave.name);
    await waitFor(() => expect(seen.at(-1)?.getAll('segment')).toEqual(['Silver']));

    await user.click(screen.getByRole('button', { name: /^Filter\s*\d/ }));
    const panel = await screen.findByRole('dialog', { name: 'Filter clients' });
    const segment = within(within(panel).getByRole('group', { name: 'Segment' }));
    expect(await segment.findByRole('checkbox', { name: 'Gold' })).toBeInTheDocument();
    expect(segment.getByRole('checkbox', { name: 'Silver' })).toBeChecked();
    // Whatever clients have is listed too; an inactive segment nobody has is not.
    expect(segment.getByRole('checkbox', { name: 'Platinum' })).toBeInTheDocument();
    expect(segment.queryByRole('checkbox', { name: 'Retail' })).not.toBeInTheDocument();
  });

  it('hides the segment column, filter and analytics when segments are switched off', async () => {
    const seen: URLSearchParams[] = [];
    server.use(...clientsHandlers({ onList: (params) => seen.push(params) }));
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />, {
      route: '/acme/clients?segment=Silver',
      context: {
        ...ownerContext,
        organization: { ...ownerContext.organization, client_segments_enabled: false },
      },
    });
    const row = await clientRow(techwave.name);

    // A `?segment=` link (or a saved filter set) no longer narrows the list.
    await waitFor(() => expect(seen.at(-1)?.has('segment')).toBe(false));
    expect(screen.queryByRole('columnheader', { name: 'Segment' })).toBeNull();
    expect(within(row).queryByText('Bronze')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Show\/Hide Columns/ }));
    const columns = await screen.findByRole('dialog', { name: 'Show or hide columns' });
    expect(within(columns).getByRole('checkbox', { name: 'Registration' })).toBeInTheDocument();
    expect(within(columns).queryByRole('checkbox', { name: 'Segment' })).toBeNull();
    // Segment (and Branch, off here too) stay hidden but are not listed: once Activity is shown,
    // every listed column shows and "Show all columns" has nothing left to do.
    const showAll = within(columns).getByRole('button', { name: 'Show all columns' });
    expect(showAll).toBeEnabled();
    await user.click(within(columns).getByRole('checkbox', { name: 'Activity' }));
    expect(showAll).toBeDisabled();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: /^Filter$/ }));
    const filters = await screen.findByRole('dialog', { name: 'Filter clients' });
    expect(within(filters).getByRole('group', { name: 'Status' })).toBeInTheDocument();
    expect(within(filters).queryByRole('group', { name: 'Segment' })).toBeNull();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Analytics' }));
    const analytics = await screen.findByRole('dialog', { name: 'Client analytics' });
    expect(await within(analytics).findByText('By status')).toBeInTheDocument();
    // No deadlines on the client list (APT76).
    expect(within(analytics).queryByText(/deadlines/)).not.toBeInTheDocument();
    expect(within(analytics).queryByText('By segment')).toBeNull();
  });

  it('saves, applies and deletes a filter set', async () => {
    const seen: URLSearchParams[] = [];
    server.use(...clientsHandlers({ onList: (params) => seen.push(params) }));
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);

    await user.click(screen.getByRole('button', { name: 'Drafts' }));
    await user.click(screen.getByRole('button', { name: 'Filter set' }));
    let panel = await screen.findByRole('dialog', { name: 'Saved filter sets' });
    await user.type(within(panel).getByRole('textbox', { name: 'Filter set name' }), 'Prospects');
    await user.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(within(panel).getByRole('button', { name: /^Prospects/ })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Drafts' }));
    await waitFor(() => expect(seen.at(-1)?.getAll('status')).toEqual([]));

    await user.click(screen.getByRole('button', { name: 'Filter set' }));
    panel = await screen.findByRole('dialog', { name: 'Saved filter sets' });
    await user.click(within(panel).getByRole('button', { name: /^Prospects/ }));
    await waitFor(() => expect(seen.at(-1)?.getAll('status')).toEqual(['prospect']));

    await user.click(screen.getByRole('button', { name: 'Filter set' }));
    panel = await screen.findByRole('dialog', { name: 'Saved filter sets' });
    await user.click(within(panel).getByRole('button', { name: 'Delete filter set Prospects' }));
    expect(within(panel).getByText('No saved filter sets yet.')).toBeInTheDocument();
  });

  it('opens the client when a row is clicked and marks selected rows', async () => {
    server.use(...clientsHandlers());
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    const row = await clientRow(techwave.name);

    await user.click(within(row).getByRole('checkbox', { name: `Select ${techwave.name}` }));
    expect(row).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: 'Bulk actions for 1 selected' })).toBeEnabled();

    await user.click(screen.getByRole('checkbox', { name: 'Select all clients on this page' }));
    expect(screen.getByRole('button', { name: 'Bulk actions for 2 selected' })).toBeEnabled();
  });

  it('shows the empty state with Add Client and Import', async () => {
    server.use(...clientsHandlers({ clients: [] }));
    renderInOrg(<ClientsPage />);
    expect(await screen.findByRole('heading', { name: 'No clients yet' })).toBeInTheDocument();
    const state = screen.getByRole('heading', { name: 'No clients yet' }).parentElement;
    if (!state) throw new Error('no empty state');
    expect(within(state).getByRole('button', { name: 'Add Client' })).toBeInTheDocument();
    expect(within(state).getByRole('button', { name: 'Import' })).toBeInTheDocument();
  });

  it('shows an error state with a working retry', async () => {
    let calls = 0;
    server.use(
      http.get(orgApiPath('/clients'), () => {
        calls += 1;
        return calls === 1
          ? fail(500, 'INTERNAL_ERROR', 'The server failed.', { requestId: 'req-500' })
          : ok([techwave], { meta: { next_cursor: null, has_more: false } });
      }),
      ...clientsHandlers(),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Could not load the clients' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await clientRow(techwave.name)).toBeInTheDocument();
  });

  it('loads the next page with the cursor', async () => {
    const cursors: Array<string | null> = [];
    server.use(
      http.get(orgApiPath('/clients'), ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return cursor
          ? ok([mutual], { meta: { next_cursor: null, has_more: false } })
          : ok([techwave], { meta: { next_cursor: 'c2', has_more: true } });
      }),
      ...clientsHandlers(),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await clientRow(mutual.name)).toBeInTheDocument();
    expect(cursors).toEqual([null, 'c2']);
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});

describe('ClientsPage actions', () => {
  it('validates the Add Client form and maps a 422 field error', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      ...clientsHandlers(),
      http.post(orgApiPath('/clients'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
          details: [
            {
              field: 'company_number',
              code: 'string_too_long',
              message: 'Use at most 20 characters',
            },
          ],
        });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);

    await user.click(screen.getByRole('button', { name: 'Add Client' }));
    const dialog = await screen.findByRole('region', { name: 'Add Client' });
    const form = within(dialog);
    await user.click(form.getByRole('button', { name: 'Add Client' }));
    expect(await form.findByText('Enter the client name')).toBeInTheDocument();

    await user.type(form.getByRole('textbox', { name: 'Client name' }), 'Nyro Technologies');
    await user.type(form.getByRole('textbox', { name: 'Email' }), 'not-an-email');
    await user.type(form.getByRole('textbox', { name: 'Year-end day' }), '31');
    await user.click(form.getByRole('button', { name: 'Add Client' }));
    expect(await form.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(form.getByText('Give both the year-end month and day, or neither')).toBeInTheDocument();
    expect(body).toBeUndefined();

    await user.clear(form.getByRole('textbox', { name: 'Email' }));
    await user.type(form.getByRole('textbox', { name: 'Email' }), 'hi@nyro.example');
    await user.selectOptions(form.getByRole('combobox', { name: 'Year-end month' }), 'February');
    await user.click(form.getByRole('button', { name: 'Add Client' }));
    expect(await form.findByText('This day does not exist in that month')).toBeInTheDocument();

    await user.selectOptions(form.getByRole('combobox', { name: 'Year-end month' }), 'March');
    await user.type(form.getByRole('textbox', { name: 'Company number' }), '12345678');
    await user.selectOptions(form.getByRole('combobox', { name: 'Manager' }), 'Grace Hopper');
    await user.click(form.getByRole('button', { name: 'Add Client' }));

    const companyNumber = form.getByRole('textbox', { name: 'Company number' });
    await waitFor(() => expect(companyNumber).toHaveAttribute('aria-invalid', 'true'));
    expect(form.getByText('Use at most 20 characters')).toBeInTheDocument();
    expect(body).toMatchObject({
      name: 'Nyro Technologies',
      email: 'hi@nyro.example',
      year_end_month: 3,
      year_end_day: 31,
      company_number: '12345678',
      client_type: 'limited_company',
      status: 'active',
      manager_user_id: '0198c1f2-0000-7000-8000-00000000f001',
      health_score: null,
    });
    expect(body).not.toHaveProperty('code');
  });

  it('creates a client and refreshes the list', async () => {
    let lists = 0;
    server.use(
      ...clientsHandlers({ onList: () => (lists += 1) }),
      http.post(orgApiPath('/clients'), () => ok(techwaveDetail, { status: 201 })),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);
    await user.click(screen.getByRole('button', { name: 'Add Client' }));
    const dialog = await screen.findByRole('region', { name: 'Add Client' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Client name' }), 'Techwave');
    await user.click(within(dialog).getByRole('button', { name: 'Add Client' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Add Client' })).toBeNull());
    expect(await screen.findByText('Client created')).toBeInTheDocument();
    await waitFor(() => expect(lists).toBeGreaterThan(1));
  });

  it('picks the segment from the segments of Settings and sends it', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      ...clientsHandlers(),
      http.post(orgApiPath('/clients'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok(techwaveDetail, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);
    await user.click(screen.getByRole('button', { name: 'Add Client' }));
    const dialog = await screen.findByRole('region', { name: 'Add Client' });
    const form = within(dialog);

    const segment = form.getByRole('combobox', { name: 'Segment' });
    // Active segments only: Retail is inactive, and nothing the design once listed is invented.
    expect(await within(segment).findByRole('option', { name: 'Gold' })).toBeInTheDocument();
    expect(
      within(segment)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['No segment', 'Gold', 'Silver']);
    await user.type(form.getByRole('textbox', { name: 'Client name' }), 'Techwave');
    await user.selectOptions(segment, 'Gold');
    await user.click(form.getByRole('button', { name: 'Add Client' }));

    await waitFor(() => expect(body).toMatchObject({ name: 'Techwave', segment: 'Gold' }));
  });

  it('keeps a segment the practice has not defined on the client being edited', async () => {
    server.use(...clientsHandlers());
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);
    await user.click(await findRowAction(`Actions for ${techwave.name}`, 'Edit'));
    const dialog = await screen.findByRole('region', { name: `Edit ${techwave.name}` });
    const segment = within(dialog).getByRole('combobox', { name: 'Segment' });
    await waitFor(() => expect(segment).toHaveValue('Bronze'));
    expect(
      within(segment).getByRole('option', { name: 'Bronze (not in Settings)' }),
    ).toBeInTheDocument();
  });

  it('shows which client already has a typed code, on the code field', async () => {
    const message =
      'The code ACME is already used by Acme Ltd (archived). Change that client’s code, or delete it, to use the code again.';
    server.use(
      ...clientsHandlers(),
      http.post(orgApiPath('/clients'), () => fail(409, 'CLIENT_CODE_TAKEN', message)),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);
    await user.click(screen.getByRole('button', { name: 'Add Client' }));
    const dialog = await screen.findByRole('region', { name: 'Add Client' });
    const form = within(dialog);

    expect(
      form.getByText(
        'Left blank, the next code from the numbering sequence is used. You can also type your own fixed number.',
      ),
    ).toBeInTheDocument();
    await user.type(form.getByRole('textbox', { name: 'Client name' }), 'New Acme');
    await user.type(form.getByRole('textbox', { name: 'Client code' }), 'acme');
    await user.click(form.getByRole('button', { name: 'Add Client' }));

    expect(await form.findByText(message)).toBeInTheDocument();
    expect(form.getByRole('textbox', { name: 'Client code' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('opens the new client on its own page after creating it', async () => {
    server.use(
      ...clientsHandlers(),
      http.post(orgApiPath('/clients'), () => ok(techwaveDetail, { status: 201 })),
    );
    const user = userEvent.setup();
    renderInOrg(
      <>
        <ClientsPage />
        <Where />
      </>,
      { route: '/acme/clients?new=1' },
    );
    const dialog = await screen.findByRole('region', { name: 'Add Client' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Client name' }), 'Techwave');
    await user.click(within(dialog).getByRole('button', { name: 'Add Client' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        `/acme/clients/${techwaveDetail.id}`,
      ),
    );
  });

  it('shows the dry-run errors of an import and imports a clean file', async () => {
    const runs: string[] = [];
    let clean = false;
    server.use(
      ...clientsHandlers(),
      http.post(orgApiPath('/imports/clients'), ({ request }) => {
        const dryRun = new URL(request.url).searchParams.get('dry_run') ?? '';
        runs.push(dryRun);
        if (dryRun === 'false') {
          return ok({
            dry_run: false,
            total_rows: 2,
            valid_rows: 2,
            created: 2,
            columns: ['name'],
            ignored_columns: [],
            errors: [],
            clients: [],
          });
        }
        return ok({
          dry_run: true,
          total_rows: 3,
          valid_rows: clean ? 2 : 1,
          created: 0,
          columns: ['name', 'email'],
          ignored_columns: ['Favourite colour'],
          errors: clean
            ? []
            : [
                { row: 2, field: 'email', code: 'value_error', message: 'Enter a valid email' },
                { row: 3, field: 'code', code: 'CLIENT_CODE_TAKEN', message: 'Code in use' },
              ],
          clients: [],
        });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);

    await user.click(screen.getByRole('button', { name: 'Import' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import clients' });
    const file = new File(['name,email\nA,a@x.example\n'], 'clients.csv', { type: 'text/csv' });
    await user.upload(within(dialog).getByLabelText('CSV file'), file);
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));

    const errors = await within(dialog).findByRole('table', { name: 'Rows with errors' });
    expect(
      within(errors).getByRole('row', { name: '2 email Enter a valid email' }),
    ).toBeInTheDocument();
    expect(within(errors).getByRole('row', { name: '3 code Code in use' })).toBeInTheDocument();
    expect(within(dialog).getByText(/3 rows checked: 1 valid, 2 errors/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Ignored columns: Favourite colour/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Import \d/ })).toBeNull();
    expect(runs).toEqual(['true']);

    clean = true;
    await user.click(within(dialog).getByRole('button', { name: 'Check file' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Import 2 clients' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Import clients' })).toBeNull(),
    );
    expect(runs).toEqual(['true', 'true', 'false']);
    expect(await screen.findByText('2 clients imported')).toBeInTheDocument();
  });

  it('exports the filtered list as a blob with the bearer token', async () => {
    tokenStore.set('token-export');
    let auth: string | null = null;
    let query: URLSearchParams | undefined;
    server.use(
      ...clientsHandlers(),
      http.get(orgApiPath('/clients/export'), ({ request }) => {
        auth = request.headers.get('Authorization');
        query = new URL(request.url).searchParams;
        return new HttpResponse('code,name\r\nAPX006,Techwave\r\n', {
          headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        });
      }),
    );
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:clients');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this);
    });
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);

    await user.click(screen.getByRole('button', { name: 'Drafts' }));
    await user.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => expect(clicks).toHaveLength(1));
    expect(auth).toBe('Bearer token-export');
    expect(query?.get('format')).toBe('csv');
    expect(query?.getAll('status')).toEqual(['prospect']);
    expect(query?.get('sort')).toBe('name');
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(await blob?.text()).toContain('APX006');
    expect(clicks[0]?.download).toBe('clients.csv');
    expect(clicks[0]?.href).toBe('blob:clients');
  });

  it('archives a client from its row actions', async () => {
    let archived = '';
    server.use(
      ...clientsHandlers(),
      http.post(orgApiPath('/clients/:clientId/archive'), ({ params }) => {
        archived = String(params.clientId);
        return ok({ ...techwaveDetail, status: 'archived' });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await user.click(await findRowAction(`Actions for ${techwave.name}`, 'Archive'));
    const dialog = await screen.findByRole('dialog', { name: 'Archive client' });
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(archived).toBe(techwave.id));
  });

  it('explains CLIENT_IN_USE when a delete is refused', async () => {
    server.use(
      ...clientsHandlers(),
      http.delete(orgApiPath('/clients/:clientId'), () =>
        fail(409, 'CLIENT_IN_USE', 'This client has jobs or invoices. Archive it instead.', {
          details: { jobs: 2, invoices: 1 },
        }),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);
    expect(rowActionNames(`Actions for ${techwave.name}`)).toEqual([
      'View',
      'Edit',
      'Archive',
      'Delete',
    ]);
    await user.click(rowAction(`Actions for ${techwave.name}`, 'Delete'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete client' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(
      await within(dialog).findByText('This client has jobs or invoices. Archive it instead.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Delete client' })).toBeInTheDocument();
  });

  it('hides what the role may not do', async () => {
    server.use(...clientsHandlers());
    renderInOrg(<ClientsPage />, { context: contextWith(STAFF_PERMISSIONS) });
    const row = await clientRow(mutual.name);

    expect(screen.queryByRole('button', { name: 'Add Client' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /Add contact/ })).toBeNull();

    expect(rowActionNames(`Actions for ${mutual.name}`)).toEqual(['View']);
  });

  it('shows the same data as cards in the grid view', async () => {
    server.use(...clientsHandlers());
    const user = userEvent.setup();
    renderInOrg(<ClientsPage />);
    await clientRow(techwave.name);
    await user.click(screen.getByRole('button', { name: 'Grid view' }));
    const cards = await screen.findByRole('list', { name: 'Clients' });
    const card = within(cards).getByRole('listitem', { name: techwave.name });
    expect(within(card).getByText('Registration')).toBeInTheDocument();
    expect(within(card).getByText('678654QJ')).toBeInTheDocument();
    // No contact, deadlines or Central on a card either (APT76).
    expect(within(card).queryByText('Ramya Menon')).not.toBeInTheDocument();
    expect(within(card).queryByText('1 Overdue by 1d')).not.toBeInTheDocument();
    expect(within(card).queryByText('Local')).not.toBeInTheDocument();
    expect(useClientsPrefs.getState().view).toBe('grid');
  });
});
