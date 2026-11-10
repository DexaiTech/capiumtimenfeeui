import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { branchesOnContext, branchHandlers, london } from '@/test/branches';
import { contextWith, ownerContext, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { findRowAction, rowActionNames } from '@/test/rowActions';
import { fail, ok, server } from '@/test/server';

import {
  brightside,
  corner,
  dunmore,
  lead,
  leadHandlers,
  newLeadCalls,
  oldLead,
  testLeads,
  type LeadCalls,
} from '../test/leads';
import { Where } from '../test/Where';
import LeadsPage from './LeadsPage';

type User = ReturnType<typeof userEvent.setup>;

// A row's name starts with its checkbox, "Select <lead>".
const row = (name: RegExp) => screen.findByRole('row', { name });

async function actionsOf(name: string) {
  await screen.findByRole('group', { name: `Actions for ${name}` });
  return rowActionNames(`Actions for ${name}`);
}

async function chooseAction(user: User, name: string, action: string) {
  await user.click(await findRowAction(`Actions for ${name}`, action));
}

const tick = (name: string) => screen.getByRole('checkbox', { name: `Select ${name}` });
const exportButton = () => screen.getByRole('button', { name: 'Export selected' });

/** Catches the CSV "Export selected" offers: jsdom has no object URLs and no downloads. */
function catchDownloads() {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:leads');
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
  const clicks: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push(this);
  });
  return { createObjectURL, clicks };
}

function renderPage(options: Parameters<typeof renderInOrg>[1] = {}) {
  return renderInOrg(
    <>
      <LeadsPage />
      <Where />
    </>,
    { route: '/acme/clients/leads', ...options },
  );
}

let calls: LeadCalls;

function setup(leads = testLeads) {
  calls = newLeadCalls();
  server.use(...leadHandlers(leads, calls));
}

beforeEach(() => setup());

describe('LeadsPage: the list', () => {
  it('puts the title above the Clients and Leads switch (R-02)', () => {
    renderPage();

    const title = screen.getByRole('heading', { level: 1, name: 'Leads' });
    const tabs = screen.getByRole('navigation', { name: 'Clients and leads' });
    expect(title.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('lists the open leads with their costs, the totals and the counts of each tab', async () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument();
    // The Clients | Leads tabs of the Client List, Leads marked: Clients is one click away.
    const tabs = screen.getByRole('navigation', { name: 'Clients and leads' });
    expect(within(tabs).getByRole('link', { name: /^Clients/ })).toHaveAttribute(
      'href',
      '/acme/clients',
    );
    expect(within(tabs).getByText('Leads').closest('[aria-current]')).toHaveAttribute(
      'aria-current',
      'true',
    );
    const bright = within(await row(/^Select Brightside Bakery Ltd/));
    expect(bright.getByText('Bea Bright · bea@brightside.example')).toBeInTheDocument();
    expect(bright.getByText('Referral')).toBeInTheDocument();
    expect(bright.getByText('£250.00')).toBeInTheDocument();
    expect(bright.getByText('£50.00')).toBeInTheDocument();
    expect(bright.getByText('£300.00')).toBeInTheDocument();
    expect(await row(/^Select Corner Cafe/)).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^Select Dunmore/ })).not.toBeInTheDocument();
    expect(calls.lists[0]?.get('status')).toBe('open');

    expect(await screen.findByRole('tab', { name: /^Open\s*2$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /^Converted\s*1$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Archived\s*1$/ })).toBeInTheDocument();

    const totals = within(screen.getByLabelText('Lead totals'));
    expect(totals.getByText('Open leads')).toBeInTheDocument();
    expect(totals.getByText('£262.50')).toBeInTheDocument();
    expect(totals.getByText('£312.50')).toBeInTheDocument();
  });

  it('shows the converted leads linked to their client', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);

    await user.click(screen.getByRole('tab', { name: /^Converted/ }));
    const dunmore = within(await row(/^Select Dunmore Holdings/));
    expect(dunmore.getByRole('link', { name: 'C0042 · Dunmore Holdings' })).toHaveAttribute(
      'href',
      '/acme/clients/client-dunmore',
    );
    expect(calls.lists.at(-1)?.get('status')).toBe('converted');
    expect(await actionsOf('Dunmore Holdings')).toEqual(['Open client', 'Edit', 'Archive']);
    const totals = () => within(screen.getByLabelText('Lead totals'));
    await waitFor(() => expect(totals().getByText('£550.00')).toBeInTheDocument());
  });

  it('searches the name, contact and email', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);

    await user.type(screen.getByRole('searchbox', { name: 'Search leads' }), 'corner');
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Select Brightside/ })).not.toBeInTheDocument(),
    );
    expect(await row(/^Select Corner Cafe/)).toBeInTheDocument();
    expect(calls.lists.at(-1)?.get('q')).toBe('corner');
  });

  it('shows the empty state and the error state with a retry', async () => {
    const user = userEvent.setup();
    setup([]);
    const first = renderPage();
    expect(await screen.findByText('No open leads')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add lead' })).toHaveLength(2);
    first.unmount();

    let failing = true;
    server.use(
      http.get(orgApiPath('/leads'), () =>
        failing
          ? fail(500, 'INTERNAL_ERROR', 'Boom.')
          : ok([], { meta: { next_cursor: null, has_more: false } }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Could not load the leads')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No open leads')).toBeInTheDocument();
  });

  it('shows the loading state, then the rows', async () => {
    renderPage();
    expect(screen.getByRole('table', { name: 'Leads' })).toHaveAttribute('aria-busy', 'true');
    await row(/^Select Brightside/);
    expect(screen.getByRole('table', { name: 'Leads' })).not.toHaveAttribute('aria-busy');
  });
});

describe('LeadsPage: selection, columns and export', () => {
  it('selects leads one by one or all at once, like the other grids', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);

    // Toolbar order: Show/Hide Columns, Export selected, then the primary Add lead.
    const columnsButton = screen.getByRole('button', { name: 'Show/Hide Columns' });
    const addLead = screen.getByRole('button', { name: 'Add lead' });
    expect(columnsButton.compareDocumentPosition(exportButton())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(exportButton().compareDocumentPosition(addLead)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(exportButton()).toBeDisabled();

    await user.click(tick(brightside.name));
    expect(tick(brightside.name)).toBeChecked();
    expect(tick(corner.name)).not.toBeChecked();
    expect(exportButton()).toBeEnabled();

    const all = screen.getByRole('checkbox', { name: 'Select all rows' });
    await user.click(all);
    expect(tick(brightside.name)).toBeChecked();
    expect(tick(corner.name)).toBeChecked();
    await user.click(all);
    expect(tick(brightside.name)).not.toBeChecked();
    expect(tick(corner.name)).not.toBeChecked();
    expect(exportButton()).toBeDisabled();
  });

  it('toggles a lead with the Space key', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);

    tick(corner.name).focus();
    expect(tick(corner.name)).toHaveFocus();
    await user.keyboard(' ');
    expect(tick(corner.name)).toBeChecked();
    await user.keyboard(' ');
    expect(tick(corner.name)).not.toBeChecked();
  });

  it('clears the selection when the tab or the search changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);

    await user.click(tick(brightside.name));
    await user.click(screen.getByRole('tab', { name: /^Converted/ }));
    await row(/^Select Dunmore/);
    expect(tick(dunmore.name)).not.toBeChecked();
    expect(exportButton()).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: /^Open/ }));
    await row(/^Select Brightside/);
    expect(tick(brightside.name)).not.toBeChecked();

    await user.click(tick(corner.name));
    await user.type(screen.getByRole('searchbox', { name: 'Search leads' }), 'corner');
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Select Brightside/ })).not.toBeInTheDocument(),
    );
    expect(tick(corner.name)).not.toBeChecked();
    expect(exportButton()).toBeDisabled();
  });

  it('exports the visible columns of the selected leads as a CSV file', async () => {
    const { createObjectURL, clicks } = catchDownloads();
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);

    // A hidden column is left out of the file too.
    await user.click(screen.getByRole('button', { name: 'Show/Hide Columns' }));
    const menu = await screen.findByRole('dialog', { name: 'Visible columns' });
    await user.click(within(menu).getByRole('checkbox', { name: 'Onboarding' }));
    await user.keyboard('{Escape}');

    await user.click(tick(brightside.name));
    await user.click(exportButton());

    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.download).toBe('leads-selected.csv');
    expect(clicks[0]?.href).toBe('blob:leads');
    const blob = createObjectURL.mock.calls[0]?.[0];
    // UTF-8 with a byte-order mark for Excel (`text()` drops the mark), CRLF line ends.
    expect([...new Uint8Array((await blob?.arrayBuffer()) ?? new ArrayBuffer(0), 0, 3)]).toEqual([
      0xef, 0xbb, 0xbf,
    ]);
    const csv = await blob?.text();
    expect(csv).toBe(
      'Lead,Contact,Email,Phone,Source,Acquisition,Total cost,Status,Added\r\n' +
        'Brightside Bakery Ltd,Bea Bright,bea@brightside.example,,Referral,250.00,300.00,Open,01/10/2026\r\n',
    );
  });

  it('leaves a selected lead that leaves the list out of the export', async () => {
    const { createObjectURL } = catchDownloads();
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Corner/);

    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    await chooseAction(user, corner.name, 'Archive');
    const dialog = await screen.findByRole('dialog', { name: 'Archive lead?' });
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Select Corner/ })).not.toBeInTheDocument(),
    );
    expect(tick(brightside.name)).toBeChecked();

    await user.click(exportButton());
    const csv = await createObjectURL.mock.calls[0]?.[0].text();
    expect(csv).toContain(brightside.name);
    expect(csv).not.toContain(corner.name);
  });

  it('writes a converted lead with its status, and neutralises a leading + as Clients does', async () => {
    setup([...testLeads.filter((entry) => entry !== dunmore), { ...dunmore, phone: '+44 1' }]);
    const { createObjectURL } = catchDownloads();
    const user = userEvent.setup();
    renderPage({ route: '/acme/clients/leads?tab=converted' });
    await row(/^Select Dunmore/);

    await user.click(tick(dunmore.name));
    await user.click(exportButton());
    const csv = await createObjectURL.mock.calls[0]?.[0].text();
    expect(csv?.split('\r\n')[1]).toBe(
      "Dunmore Holdings,,,'+44 1,,400.00,150.00,550.00,Converted,01/10/2026",
    );
  });

  it('selects only the loaded rows: Load more does not tick the next page', async () => {
    const extra = lead('lead-extra', 'Extra Lead Ltd');
    server.use(
      http.get(orgApiPath('/leads'), ({ request }) =>
        new URL(request.url).searchParams.get('cursor') === '2'
          ? ok([extra], { meta: { next_cursor: null, has_more: false } })
          : ok([brightside, corner], { meta: { next_cursor: '2', has_more: true } }),
      ),
    );
    const { createObjectURL } = catchDownloads();
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);

    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await row(/^Select Extra Lead/);
    expect(tick(extra.name)).not.toBeChecked();
    expect(tick(brightside.name)).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toHaveProperty(
      'indeterminate',
      true,
    );

    await user.click(exportButton());
    const csv = await createObjectURL.mock.calls[0]?.[0].text();
    expect(csv?.trimEnd().split('\r\n')).toHaveLength(3);
    expect(csv).not.toContain(extra.name);
  });

  it('cannot export the rows of the previous tab while the new one loads', async () => {
    let release = () => {};
    const archivedLoaded = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(orgApiPath('/leads'), async ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        if (status === 'archived') await archivedLoaded;
        return ok(status === 'archived' ? [oldLead] : [brightside, corner], {
          meta: { next_cursor: null, has_more: false },
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);

    await user.click(screen.getByRole('tab', { name: /^Archived/ }));
    // The open leads stay on screen until the archived ones arrive.
    await user.click(tick(brightside.name));
    expect(exportButton()).toBeDisabled();

    release();
    await row(/^Select Old Prospect/);
    expect(screen.queryByRole('row', { name: /^Select Brightside/ })).not.toBeInTheDocument();
    expect(exportButton()).toBeDisabled();
  });

  it('hides a column and remembers it after a re-render', async () => {
    const user = userEvent.setup();
    const view = renderPage();
    await row(/^Select Brightside/);

    await user.click(screen.getByRole('button', { name: 'Show/Hide Columns' }));
    const menu = await screen.findByRole('dialog', { name: 'Visible columns' });
    // Nothing is hidden at first; the lead and its status cannot be hidden.
    for (const name of ['Source', 'Acquisition', 'Onboarding', 'Total cost', 'Added']) {
      expect(within(menu).getByRole('checkbox', { name })).toBeEnabled();
      expect(within(menu).getByRole('checkbox', { name })).toBeChecked();
    }
    expect(within(menu).getByRole('checkbox', { name: 'Lead' })).toBeDisabled();
    expect(within(menu).getByRole('checkbox', { name: 'Status' })).toBeDisabled();
    await user.click(within(menu).getByRole('checkbox', { name: 'Source' }));

    expect(screen.queryByRole('columnheader', { name: 'Source' })).not.toBeInTheDocument();
    expect(screen.queryByText('Referral')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('tf:columns:leads')).toBe('["source"]');

    view.unmount();
    renderPage();
    await row(/^Select Brightside/);
    expect(screen.queryByRole('columnheader', { name: 'Source' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Acquisition' })).toBeInTheDocument();
  });

  it('keeps Export selected disabled while there are no leads', async () => {
    setup([]);
    renderPage();
    expect(await screen.findByText('No open leads')).toBeInTheDocument();
    expect(exportButton()).toBeDisabled();
  });
});

describe('LeadsPage: permissions', () => {
  it('lets a reader see the leads but offers no change', async () => {
    renderPage({ context: contextWith(STAFF_PERMISSIONS) });
    expect(await row(/^Select Brightside/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add lead' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Actions for/ })).not.toBeInTheDocument();
  });

  it('lets a reader select, choose the columns and export', async () => {
    const { clicks } = catchDownloads();
    const user = userEvent.setup();
    renderPage({ context: contextWith(STAFF_PERMISSIONS) });
    await row(/^Select Brightside/);

    expect(screen.getByRole('button', { name: 'Show/Hide Columns' })).toBeInTheDocument();
    await user.click(tick(brightside.name));
    await user.click(exportButton());
    expect(clicks[0]?.download).toBe('leads-selected.csv');
  });

  it('keeps the row actions of each tab, with no Delete', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await actionsOf(brightside.name)).toEqual(['Edit', 'Convert to client', 'Archive']);
    await user.click(screen.getByRole('tab', { name: /^Converted/ }));
    expect(await actionsOf(dunmore.name)).toEqual(['Open client', 'Edit', 'Archive']);
    await user.click(screen.getByRole('tab', { name: /^Archived/ }));
    expect(await actionsOf(oldLead.name)).toEqual(['Edit', 'Unarchive']);
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('offers each action only with its permission', async () => {
    const first = renderPage({
      context: contextWith(['client.read', 'client.update']),
    });
    expect(await actionsOf('Brightside Bakery Ltd')).toEqual(['Edit']);
    first.unmount();

    renderPage({ context: contextWith(['client.read', 'client.create', 'client.delete']) });
    expect(await actionsOf('Brightside Bakery Ltd')).toEqual(['Convert to client', 'Archive']);
    expect(screen.getByRole('button', { name: 'Add lead' })).toBeInTheDocument();
  });

  it('offers convert only on open leads and unarchive on archived ones', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await actionsOf('Brightside Bakery Ltd')).toEqual([
      'Edit',
      'Convert to client',
      'Archive',
    ]);
    await user.click(screen.getByRole('tab', { name: /^Archived/ }));
    expect(await actionsOf(oldLead.name)).toEqual(['Edit', 'Unarchive']);
  });
});

describe('LeadFormPanel', () => {
  it('adds a lead, sending the costs in pence', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add lead' }));
    const dialog = await screen.findByRole('region', { name: 'Add lead' });
    expectRequiredFields(dialog, {
      required: ['Name'],
      optional: ['Contact name', 'Email', 'Acquisition cost (£)', 'Onboarding cost (£)'],
    });

    const field = (name: string) => within(dialog).getByRole('textbox', { name });
    await user.type(field('Name'), '  Evergreen LLP ');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Client type' }), 'llp');
    await user.type(field('Contact name'), 'Eve Green');
    await user.type(field('Source'), 'Website');
    await user.type(field('Acquisition cost (£)'), '1,250');
    await user.type(field('Onboarding cost (£)'), '49.99');
    expect(within(dialog).getByText('£1,299.99')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add lead' }));

    expect(await screen.findByText('Evergreen LLP added')).toBeInTheDocument();
    expect(calls.creates).toEqual([
      {
        name: 'Evergreen LLP',
        client_type: 'llp',
        contact_name: 'Eve Green',
        email: null,
        phone: null,
        source: 'Website',
        notes: null,
        acquisition_cost: 125000,
        onboarding_cost: 4999,
      },
    ]);
    expect(await row(/^Select Evergreen LLP/)).toBeInTheDocument();
  });

  it('checks the name, the email and the amounts before sending', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add lead' }));
    const dialog = await screen.findByRole('region', { name: 'Add lead' });

    await user.type(within(dialog).getByRole('textbox', { name: 'Email' }), 'not-an-email');
    await user.type(within(dialog).getByRole('textbox', { name: 'Acquisition cost (£)' }), '-5');
    await user.type(within(dialog).getByRole('textbox', { name: 'Onboarding cost (£)' }), '1.234');
    await user.click(within(dialog).getByRole('button', { name: 'Add lead' }));

    expect(await within(dialog).findByText('Enter the lead name')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid email address')).toBeInTheDocument();
    expect(
      within(dialog).getAllByText('Enter an amount in pounds, for example 250 or 99.50'),
    ).toHaveLength(2);
    expect(calls.creates).toEqual([]);
  });

  it('groups the fields in sections like the client form, under the required-fields note (R-06)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add lead' }));
    const dialog = await screen.findByRole('region', { name: 'Add lead' });

    expect(
      within(dialog).getByText('Fields marked with a red star are required.'),
    ).toBeInTheDocument();
    const about = within(within(dialog).getByRole('region', { name: 'About the lead' }));
    expect(about.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(about.getByRole('combobox', { name: 'Client type' })).toBeInTheDocument();
    expect(about.getByRole('textbox', { name: 'Source' })).toBeInTheDocument();
    const contact = within(within(dialog).getByRole('region', { name: 'Contact' }));
    expect(contact.getByRole('textbox', { name: 'Contact name' })).toBeInTheDocument();
    expect(contact.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
    expect(contact.getByRole('textbox', { name: 'Phone' })).toBeInTheDocument();
    const costs = within(within(dialog).getByRole('region', { name: 'Costs' }));
    expect(
      costs.getByText('Optional. A blank amount counts as nothing spent.'),
    ).toBeInTheDocument();
    expect(costs.getByRole('textbox', { name: 'Acquisition cost (£)' })).toBeInTheDocument();
    expect(costs.getByRole('textbox', { name: 'Onboarding cost (£)' })).toBeInTheDocument();
    expect(costs.getByText('Total cost')).toBeInTheDocument();
  });

  it('folds Notes on Add lead and opens it on Edit lead', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add lead' }));
    const add = await screen.findByRole('region', { name: 'Add lead' });
    const addNotes = within(add).getByText('Notes', { selector: 'summary span' });
    expect(within(add).getByText('Optional.')).toBeInTheDocument();
    expect(addNotes.closest('details')).not.toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: 'Close Add lead' }));

    await row(/^Select Brightside/);
    await chooseAction(user, brightside.name, 'Edit');
    const edit = await screen.findByRole('region', { name: 'Edit lead' });
    const editNotes = within(edit).getByText('Notes', { selector: 'summary span' });
    expect(editNotes.closest('details')).toHaveAttribute('open');
  });

  it('opens the folded Notes when the server refuses them', async () => {
    server.use(
      http.post(orgApiPath('/leads'), () =>
        fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
          details: [
            { field: 'notes', code: 'string_too_long', message: 'Use at most 5000 characters' },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add lead' }));
    const dialog = await screen.findByRole('region', { name: 'Add lead' });
    const notes = within(dialog).getByText('Notes', { selector: 'summary span' });
    expect(notes.closest('details')).not.toHaveAttribute('open');

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Evergreen LLP');
    await user.click(within(dialog).getByRole('button', { name: 'Add lead' }));

    expect(await within(dialog).findByText('Use at most 5000 characters')).toBeInTheDocument();
    expect(notes.closest('details')).toHaveAttribute('open');
  });

  it('edits a lead, sending only what changed', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);
    await chooseAction(user, brightside.name, 'Edit');
    const dialog = await screen.findByRole('region', { name: 'Edit lead' });

    const onboarding = within(dialog).getByRole('textbox', { name: 'Onboarding cost (£)' });
    expect(onboarding).toHaveValue('50.00');
    expect(within(dialog).getByRole('button', { name: 'Save lead' })).toBeDisabled();
    await user.clear(onboarding);
    await user.type(onboarding, '75');
    await user.click(within(dialog).getByRole('button', { name: 'Save lead' }));

    expect(await screen.findByText(`${brightside.name} saved`)).toBeInTheDocument();
    expect(calls.updates).toEqual([{ id: brightside.id, body: { onboarding_cost: 7500 } }]);
    expect(await within(await row(/^Select Brightside/)).findByText('£325.00')).toBeInTheDocument();
  });

  it('shows the history of the lead at the foot of Edit lead, not of Add lead (R-17)', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);
    await user.click(screen.getByRole('button', { name: 'Add lead' }));
    await screen.findByRole('region', { name: 'Add lead' });
    expect(screen.queryByRole('list', { name: 'History entries' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close Add lead' }));

    await chooseAction(user, brightside.name, 'Edit');
    const dialog = await screen.findByRole('region', { name: 'Edit lead' });
    const history = await within(dialog).findByRole('list', { name: 'History entries' });
    expect(within(history).getByText('Lead added')).toBeInTheDocument();
    expect(calls.histories).toHaveLength(1);
    expect(calls.histories[0]?.get('target_type')).toBe('lead');
    expect(calls.histories[0]?.get('target_id')).toBe(brightside.id);
    expect(calls.histories[0]?.get('include_related')).toBeNull();
  });

  it('reads the costs in the practice currency, so an edit keeps the amounts (R-18)', async () => {
    const user = userEvent.setup();
    // The yen has no minor unit: 5000 in the API is ¥5,000.
    renderPage({
      context: { ...ownerContext, organization: { ...ownerContext.organization, currency: 'JPY' } },
    });
    await row(/^Select Brightside/);
    await chooseAction(user, brightside.name, 'Edit');
    const dialog = await screen.findByRole('region', { name: 'Edit lead' });

    const onboarding = within(dialog).getByRole('textbox', { name: /^Onboarding cost/ });
    expect(onboarding).toHaveValue('5000');
    await user.clear(onboarding);
    await user.type(onboarding, '7500');
    await user.click(within(dialog).getByRole('button', { name: 'Save lead' }));

    expect(await screen.findByText(`${brightside.name} saved`)).toBeInTheDocument();
    // The untouched acquisition cost is not rescaled, so it is not sent.
    expect(calls.updates).toEqual([{ id: brightside.id, body: { onboarding_cost: 7500 } }]);
  });
});

describe('LeadsPage: converting', () => {
  it('converts a lead into a client after asking, and opens the client', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Brightside/);

    await chooseAction(user, brightside.name, 'Convert to client');
    const dialog = await screen.findByRole('dialog', { name: 'Convert to client?' });
    expect(within(dialog).getByText(/Bea Bright as its primary contact/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Convert' }));

    expect(await screen.findByText(`${brightside.name} is now a client`)).toBeInTheDocument();
    expect(calls.converts).toEqual([{ id: brightside.id, body: {} }]);
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Select Brightside/ })).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole('tab', { name: /^Converted\s*2$/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open client' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/acme/clients/client-lead-bright');
  });

  it('asks for the branch of the new client while the practice uses branches (APT74)', async () => {
    server.use(...branchHandlers());
    const user = userEvent.setup();
    renderPage({ context: branchesOnContext });
    await row(/^Select Brightside/);

    await chooseAction(user, brightside.name, 'Convert to client');
    const dialog = await screen.findByRole('dialog', { name: 'Convert to client?' });
    const convert = within(dialog).getByRole('button', { name: 'Convert' });
    expect(convert).toBeDisabled();
    const branch = within(dialog).getByRole('combobox', { name: 'Branch' });
    await within(branch).findByRole('option', { name: 'London' });
    await user.selectOptions(branch, 'London');
    await user.click(convert);

    expect(await screen.findByText(`${brightside.name} is now a client`)).toBeInTheDocument();
    expect(calls.converts).toEqual([{ id: brightside.id, body: { branch_id: london.id } }]);
  });

  it('explains a refusal in the dialog', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/leads/:id/convert'), () =>
        fail(409, 'LEAD_ALREADY_CONVERTED', 'This lead is already a client.'),
      ),
    );
    renderPage();
    await row(/^Select Corner/);

    await chooseAction(user, corner.name, 'Convert to client');
    const dialog = await screen.findByRole('dialog', { name: 'Convert to client?' });
    await user.click(within(dialog).getByRole('button', { name: 'Convert' }));
    expect(await within(dialog).findByText('This lead is already a client.')).toBeInTheDocument();
  });
});

describe('LeadsPage: archiving', () => {
  it('archives a lead after asking, and unarchives it', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Corner/);

    await chooseAction(user, corner.name, 'Archive');
    const dialog = await screen.findByRole('dialog', { name: 'Archive lead?' });
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText(`${corner.name} archived`)).toBeInTheDocument();
    expect(calls.archives).toEqual([corner.id]);
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Select Corner/ })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('tab', { name: /^Archived/ }));
    expect(await row(/^Select Corner Cafe/)).toBeInTheDocument();
    await chooseAction(user, corner.name, 'Unarchive');
    expect(await screen.findByText(`${corner.name} unarchived`)).toBeInTheDocument();
    expect(calls.unarchives).toEqual([corner.id]);
    expect(await screen.findByRole('tab', { name: /^Open\s*2$/ })).toBeInTheDocument();
  });

  it('says archiving a converted lead leaves its client alone (R-19)', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Select Corner/);

    // An open lead: the wording is unchanged.
    await chooseAction(user, corner.name, 'Archive');
    const open = await screen.findByRole('dialog', { name: 'Archive lead?' });
    expect(open).toHaveTextContent(
      'Corner Cafe moves to Archived and can no longer be converted. Unarchive it at any time to pick it up again.',
    );
    await user.click(within(open).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /^Converted/ }));
    await row(/^Select Dunmore Holdings/);
    await chooseAction(user, dunmore.name, 'Archive');
    const converted = await screen.findByRole('dialog', { name: 'Archive lead?' });
    expect(converted).toHaveTextContent(
      'Dunmore Holdings moves to Archived. The client it became is not changed. Unarchive it at any time.',
    );
    expect(converted).not.toHaveTextContent('can no longer be converted');
  });
});
