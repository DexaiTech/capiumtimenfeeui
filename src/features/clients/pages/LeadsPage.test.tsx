import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { findRowAction, rowActionNames } from '@/test/rowActions';
import { fail, ok, server } from '@/test/server';

import {
  brightside,
  corner,
  leadHandlers,
  newLeadCalls,
  oldLead,
  testLeads,
  type LeadCalls,
} from '../test/leads';
import { Where } from '../test/Where';
import LeadsPage from './LeadsPage';

type User = ReturnType<typeof userEvent.setup>;

const row = (name: RegExp) => screen.findByRole('row', { name });

async function actionsOf(name: string) {
  await screen.findByRole('group', { name: `Actions for ${name}` });
  return rowActionNames(`Actions for ${name}`);
}

async function chooseAction(user: User, name: string, action: string) {
  await user.click(await findRowAction(`Actions for ${name}`, action));
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
  it('lists the open leads with their costs, the totals and the counts of each tab', async () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Client List' })).toHaveAttribute(
      'href',
      '/acme/clients',
    );
    const bright = within(await row(/^Brightside Bakery Ltd/));
    expect(bright.getByText('Bea Bright · bea@brightside.example')).toBeInTheDocument();
    expect(bright.getByText('Referral')).toBeInTheDocument();
    expect(bright.getByText('£250.00')).toBeInTheDocument();
    expect(bright.getByText('£50.00')).toBeInTheDocument();
    expect(bright.getByText('£300.00')).toBeInTheDocument();
    expect(await row(/^Corner Cafe/)).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^Dunmore/ })).not.toBeInTheDocument();
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
    await row(/^Brightside/);

    await user.click(screen.getByRole('tab', { name: /^Converted/ }));
    const dunmore = within(await row(/^Dunmore Holdings/));
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
    await row(/^Brightside/);

    await user.type(screen.getByRole('searchbox', { name: 'Search leads' }), 'corner');
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Brightside/ })).not.toBeInTheDocument(),
    );
    expect(await row(/^Corner Cafe/)).toBeInTheDocument();
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
});

describe('LeadsPage: permissions', () => {
  it('lets a reader see the leads but offers no change', async () => {
    renderPage({ context: contextWith(STAFF_PERMISSIONS) });
    expect(await row(/^Brightside/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add lead' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Actions for/ })).not.toBeInTheDocument();
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
    expect(await row(/^Evergreen LLP/)).toBeInTheDocument();
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

  it('edits a lead, sending only what changed', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Brightside/);
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
    expect(await within(await row(/^Brightside/)).findByText('£325.00')).toBeInTheDocument();
  });
});

describe('LeadsPage: converting', () => {
  it('converts a lead into a client after asking, and opens the client', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/^Brightside/);

    await chooseAction(user, brightside.name, 'Convert to client');
    const dialog = await screen.findByRole('dialog', { name: 'Convert to client?' });
    expect(within(dialog).getByText(/Bea Bright as its primary contact/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Convert' }));

    expect(await screen.findByText(`${brightside.name} is now a client`)).toBeInTheDocument();
    expect(calls.converts).toEqual([{ id: brightside.id, body: {} }]);
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Brightside/ })).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole('tab', { name: /^Converted\s*2$/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open client' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/acme/clients/client-lead-bright');
  });

  it('explains a refusal in the dialog', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/leads/:id/convert'), () =>
        fail(409, 'LEAD_ALREADY_CONVERTED', 'This lead is already a client.'),
      ),
    );
    renderPage();
    await row(/^Corner/);

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
    await row(/^Corner/);

    await chooseAction(user, corner.name, 'Archive');
    const dialog = await screen.findByRole('dialog', { name: 'Archive lead?' });
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));
    expect(await screen.findByText(`${corner.name} archived`)).toBeInTheDocument();
    expect(calls.archives).toEqual([corner.id]);
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Corner/ })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('tab', { name: /^Archived/ }));
    expect(await row(/^Corner Cafe/)).toBeInTheDocument();
    await chooseAction(user, corner.name, 'Unarchive');
    expect(await screen.findByText(`${corner.name} unarchived`)).toBeInTheDocument();
    expect(calls.unarchives).toEqual([corner.id]);
    expect(await screen.findByRole('tab', { name: /^Open\s*2$/ })).toBeInTheDocument();
  });
});
