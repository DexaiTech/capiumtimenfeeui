import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import {
  accountsService,
  accountsTemplates,
  archivedService,
  bookkeeping,
  review,
  service,
  standardVat,
  taxService,
  training,
  zeroVat,
} from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import ServicesPage from './ServicesPage';

type User = ReturnType<typeof userEvent.setup>;

const row = (name: RegExp) => screen.findByRole('row', { name });

async function openActions(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  return screen.findByRole('menu', { name: `Actions for ${name}` });
}

const menuItems = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent);

async function openAdd(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Add service' }));
  const dialog = await screen.findByRole('region', { name: 'Add service' });
  // The activity types and VAT codes the form offers are loaded with it.
  await within(dialog).findByRole('checkbox', { name: /Bookkeeping/ });
  return dialog;
}

async function openEdit(user: User, name: string) {
  const menu = await openActions(user, name);
  await user.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
  const dialog = await screen.findByRole('region', { name: 'Edit service' });
  await within(dialog).findByRole('checkbox', { name: /Bookkeeping/ });
  return dialog;
}

/** The text of the first cell of every row (name and description), top to bottom. */
const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((entry) => within(entry).getAllByRole('cell')[0]?.textContent ?? '');

const MEMBER = ['organization.read'];

beforeEach(() => {
  server.use(...teamHandlers());
});

describe('ServicesPage list', () => {
  it('lists the services with their defaults, VAT, invoice wording, activity types and status', async () => {
    renderInOrg(<ServicesPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Services' })).toBeInTheDocument();
    const accounts = within(await row(/^Year-end accounts/));
    expect(accounts.getByText('ACCS')).toBeInTheDocument();
    expect(accounts.getByText('Fixed fee')).toBeInTheDocument();
    expect(accounts.getByText('£450.00')).toBeInTheDocument();
    expect(accounts.getByText('Billable')).toBeInTheDocument();
    expect(accounts.getByText('Standard 20%')).toBeInTheDocument();
    expect(accounts.getByText('Preparation of annual accounts')).toBeInTheDocument();
    expect(accounts.getByText('Bookkeeping')).toBeInTheDocument();
    expect(accounts.getByText('Review')).toBeInTheDocument();
    expect(accounts.getByText('Active')).toBeInTheDocument();
    // The number of default tasks.
    expect(accounts.getByText('3')).toBeInTheDocument();

    const tax = within(await row(/^Tax advice/));
    expect(tax.getByText('Ad hoc tax questions')).toBeInTheDocument();
    expect(tax.getByText('Hourly')).toBeInTheDocument();
    expect(tax.getByText('Non-billable')).toBeInTheDocument();
    // Without a fee, a VAT code, an invoice description or default tasks: a dash; no limit: every type.
    expect(tax.getAllByText('—')).toHaveLength(4);
    expect(tax.getByText('All activity types')).toBeInTheDocument();

    expect(within(await row(/^Legacy payroll/)).getByText('Inactive')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /^All services\s*3$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /^Active\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Inactive\s*1$/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 services')).toBeInTheDocument();
  });

  it('names the first activity types and counts the rest', async () => {
    const many = service('service-many', 'MANY', 'Many types', {
      activity_code_ids: [bookkeeping.id, review.id, training.id, 'act-x'],
    });
    server.use(...teamHandlers({ services: [many] }));
    renderInOrg(<ServicesPage />);
    const entry = within(await row(/^Many types/));
    expect(entry.getByText('Bookkeeping')).toBeInTheDocument();
    expect(entry.getByText('+1 more')).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/services'), () => new Promise(() => undefined)));
    renderInOrg(<ServicesPage />);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('filters by status and quick search on the client', async () => {
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    await row(/^Year-end accounts/);

    await user.click(screen.getByRole('tab', { name: /^Active/ }));
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Legacy payroll/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('row', { name: /^Tax advice/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 3 services')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Inactive/ }));
    expect(await row(/^Legacy payroll/)).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^Tax advice/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^All services/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search services' }), 'annual');
    // The search also reads the invoice wording.
    await waitFor(() => expect(names()).toEqual(['Year-end accounts']));
  });

  it('sorts by a header, ascending then descending, with empty values last', async () => {
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    await row(/^Year-end accounts/);
    // As the API sends them until a header is chosen.
    expect(names()).toEqual([
      'Year-end accounts',
      'Tax adviceAd hoc tax questions',
      'Legacy payroll',
    ]);

    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(names().map((text) => text.slice(0, 6))).toEqual(['Legacy', 'Tax ad', 'Year-e']);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(names().map((text) => text.slice(0, 6))).toEqual(['Year-e', 'Tax ad', 'Legacy']);

    await user.click(screen.getByRole('button', { name: 'Default fee' }));
    expect(names().map((text) => text.slice(0, 6))).toEqual(['Year-e', 'Tax ad', 'Legacy']);
    await user.click(screen.getByRole('button', { name: 'Default fee' }));
    // Services without a fee stay at the bottom whichever way it is sorted.
    expect(names()[0]?.startsWith('Year-e')).toBe(true);
  });

  it('hides and shows columns', async () => {
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    await row(/^Year-end accounts/);

    expect(screen.getByRole('columnheader', { name: /VAT code/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show/Hide Columns' }));
    await user.click(screen.getByRole('checkbox', { name: 'VAT code' }));
    expect(screen.queryByRole('columnheader', { name: /VAT code/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Name' })).toBeDisabled();
  });

  it('shows the empty state, the no-match state and the error state with a retry', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers({ services: [] }));
    const first = renderInOrg(<ServicesPage />);
    expect(await screen.findByText('No services yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add service' })).toHaveLength(2);
    await user.type(screen.getByRole('searchbox', { name: 'Search services' }), 'zzz');
    expect(await screen.findByText('No services match')).toBeInTheDocument();
    first.unmount();

    let fails = true;
    server.use(
      http.get(orgApiPath('/services'), () =>
        fails ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok([taxService]),
      ),
    );
    renderInOrg(<ServicesPage />);
    expect(await screen.findByText('Could not load the services')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/^Tax advice/)).toBeInTheDocument();
  });

  it('lets any member read the list but offers no change without settings.manage', async () => {
    renderInOrg(<ServicesPage />, { context: contextWith(MEMBER) });
    expect(await row(/^Year-end accounts/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
  });

  it('offers Deactivate to an active service and Activate to an inactive one', async () => {
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    expect(menuItems(await openActions(user, 'Tax advice'))).toEqual([
      'Edit',
      'Deactivate',
      'Delete',
    ]);
    await user.keyboard('{Escape}');
    expect(menuItems(await openActions(user, 'Legacy payroll'))).toEqual([
      'Edit',
      'Activate',
      'Delete',
    ]);
  });

  it('deactivates and activates a service, and explains a refusal', async () => {
    let attempt = 0;
    server.use(
      http.post(orgApiPath(`/services/${taxService.id}/deactivate`), () => {
        attempt += 1;
        return attempt === 1
          ? fail(403, 'PERMISSION_DENIED', 'You need settings.manage.')
          : ok({ ...taxService, is_active: false, status: 'inactive' });
      }),
      http.post(orgApiPath(`/services/${archivedService.id}/activate`), () =>
        ok({ ...archivedService, is_active: true, status: 'active' }),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    await user.click(
      within(await openActions(user, 'Tax advice')).getByRole('menuitem', { name: 'Deactivate' }),
    );
    expect(await screen.findByText("You don't have permission to do that")).toBeInTheDocument();
    await user.click(
      within(await openActions(user, 'Tax advice')).getByRole('menuitem', { name: 'Deactivate' }),
    );
    expect(await screen.findByText('Tax advice deactivated')).toBeInTheDocument();

    await user.click(
      within(await openActions(user, 'Legacy payroll')).getByRole('menuitem', { name: 'Activate' }),
    );
    expect(await screen.findByText('Legacy payroll activated')).toBeInTheDocument();
  });
});

describe('ServiceFormPanel', () => {
  it('adds a service, sends exactly the filled fields and then limits it to the ticked activity types', async () => {
    const calls: Array<{ method: string; body: unknown }> = [];
    server.use(
      http.post(orgApiPath('/services'), async ({ request }) => {
        calls.push({ method: 'POST', body: await request.json() });
        return ok(service('service-pay', 'PAY', 'Payroll'), { status: 201 });
      }),
      http.put(orgApiPath('/services/service-pay/activity-codes'), async ({ request }) => {
        calls.push({ method: 'PUT', body: await request.json() });
        return ok({ service_id: 'service-pay', restricted: true, activity_codes: [] });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    const dialog = await openAdd(user);
    // New services start hourly and billable, with no VAT code and no activity limit.
    expect(within(dialog).getByRole('combobox', { name: 'Billing basis' })).toHaveValue('hourly');
    expect(within(dialog).getByRole('checkbox', { name: /Billable by default/ })).toBeChecked();
    expect(within(dialog).getByRole('combobox', { name: 'VAT code' })).toHaveValue('');
    expect(
      within(within(dialog).getByRole('combobox', { name: 'VAT code' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['No default VAT code', 'Standard 20% (20%)', 'Zero rated (0%)']);
    // Inactive activity types are not offered for a new service.
    expect(within(dialog).queryByRole('checkbox', { name: /Training/ })).not.toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Payroll');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'pay');
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Description' }),
      'Monthly payroll',
    );
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Billing basis' }),
      'Fixed fee',
    );
    await user.type(within(dialog).getByRole('textbox', { name: 'Default fee (£)' }), '1,200.50');
    await user.click(within(dialog).getByRole('checkbox', { name: /Billable by default/ }));
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'VAT code' }),
      'Zero rated (0%)',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Invoice description' }),
      'Payroll services',
    );
    const order = within(dialog).getByRole('textbox', { name: 'Sort order' });
    await user.clear(order);
    await user.type(order, '3');
    await user.click(within(dialog).getByRole('checkbox', { name: /Bookkeeping/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Review/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));

    expect(await screen.findByText('Payroll added')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'POST',
        body: {
          code: 'PAY',
          name: 'Payroll',
          billing_basis: 'fixed',
          default_billable: false,
          sort_order: 3,
          description: 'Monthly payroll',
          default_fee: 120050,
          vat_rate_id: zeroVat.id,
          invoice_description: 'Payroll services',
        },
      },
      { method: 'PUT', body: { activity_code_ids: [bookkeeping.id, review.id] } },
    ]);
  });

  it('does not touch the activity types of a new service that has no limit', async () => {
    let put = 0;
    server.use(
      http.post(orgApiPath('/services'), () =>
        ok(service('service-pay', 'PAY', 'Payroll'), { status: 201 }),
      ),
      http.put(orgApiPath('/services/service-pay/activity-codes'), () => {
        put += 1;
        return ok({});
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Payroll');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'pay');
    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));

    expect(await screen.findByText('Payroll added')).toBeInTheDocument();
    expect(put).toBe(0);
  });

  it('validates the fields before sending anything', async () => {
    let posted = 0;
    server.use(
      http.post(orgApiPath('/services'), () => {
        posted += 1;
        return ok(service('service-pay', 'PAY', 'Payroll'), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Default fee (£)' }), 'abc');
    const order = within(dialog).getByRole('textbox', { name: 'Sort order' });
    await user.clear(order);
    await user.type(order, '20000');
    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));

    expect(await within(dialog).findByText('Enter the service name')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a code for the service')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Enter an amount in pounds, for example 250.00'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a whole number from 0 to 10000')).toBeInTheDocument();
    expect(posted).toBe(0);
  });

  it('shows a duplicate code or name on its field and keeps the dialog open', async () => {
    let attempt = 0;
    server.use(
      http.post(orgApiPath('/services'), () => {
        attempt += 1;
        return attempt === 1
          ? fail(409, 'SERVICE_CODE_TAKEN', 'A service with this code already exists.')
          : fail(409, 'SERVICE_NAME_TAKEN', 'A service with this name already exists.');
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Tax advice');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'tax');
    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));
    expect(
      await within(dialog).findByText('A service with this code already exists.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Code' })).toHaveAccessibleDescription(
      'A service with this code already exists.',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));
    expect(
      await within(dialog).findByText('A service with this name already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Add service' })).toBeInTheDocument();
  });

  it('edits a service and sends only what changed, clearing a field with null', async () => {
    const calls: Array<{ method: string; body: unknown }> = [];
    server.use(
      http.patch(orgApiPath(`/services/${accountsService.id}`), async ({ request }) => {
        calls.push({ method: 'PATCH', body: await request.json() });
        return ok(accountsService);
      }),
      http.put(
        orgApiPath(`/services/${accountsService.id}/activity-codes`),
        async ({ request }) => {
          calls.push({ method: 'PUT', body: await request.json() });
          return ok({});
        },
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    const dialog = await openEdit(user, 'Year-end accounts');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Year-end accounts');
    expect(within(dialog).getByRole('textbox', { name: 'Default fee (£)' })).toHaveValue('450.00');
    expect(within(dialog).getByRole('combobox', { name: 'VAT code' })).toHaveValue(standardVat.id);
    expect(within(dialog).getByRole('checkbox', { name: /Bookkeeping/ })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Review/ })).toBeChecked();
    // Nothing changed, nothing to save.
    expect(within(dialog).getByRole('button', { name: 'Save service' })).toBeDisabled();

    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Annual accounts');
    await user.clear(within(dialog).getByRole('textbox', { name: 'Invoice description' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save service' }));

    expect(await screen.findByText('Annual accounts saved')).toBeInTheDocument();
    // The activity types were not touched, so they were not sent.
    expect(calls).toEqual([
      { method: 'PATCH', body: { name: 'Annual accounts', invoice_description: null } },
    ]);
  });

  it('replaces only the activity types when they are all that changed, and removes the limit with none', async () => {
    const calls: Array<{ method: string; body: unknown }> = [];
    server.use(
      http.patch(orgApiPath(`/services/${accountsService.id}`), async ({ request }) => {
        calls.push({ method: 'PATCH', body: await request.json() });
        return ok(accountsService);
      }),
      http.put(
        orgApiPath(`/services/${accountsService.id}/activity-codes`),
        async ({ request }) => {
          calls.push({ method: 'PUT', body: await request.json() });
          return ok({});
        },
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    let dialog = await openEdit(user, 'Year-end accounts');
    await user.click(within(dialog).getByRole('checkbox', { name: /Review/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save service' }));
    expect(await screen.findByText('Year-end accounts saved')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Edit service' })).not.toBeInTheDocument(),
    );

    dialog = await openEdit(user, 'Year-end accounts');
    await user.click(within(dialog).getByRole('checkbox', { name: /Bookkeeping/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Review/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save service' }));
    await waitFor(() => expect(calls).toHaveLength(2));

    expect(calls).toEqual([
      { method: 'PUT', body: { activity_code_ids: [bookkeeping.id] } },
      // The service lists two types and all are unticked: an empty list removes the limit.
      { method: 'PUT', body: { activity_code_ids: [] } },
    ]);
  });

  it('keeps an inactive activity type the service is still limited to', async () => {
    const limited = service('service-limited', 'LIM', 'Limited', {
      activity_code_ids: [training.id],
    });
    server.use(...teamHandlers({ services: [limited] }));
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    await user.click(await screen.findByRole('button', { name: 'Actions for Limited' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('region', { name: 'Edit service' });
    const kept = await within(dialog).findByRole('checkbox', { name: /Training/ });
    expect(kept).toBeChecked();
    expect(within(dialog).getByText('TRN · inactive')).toBeInTheDocument();
  });

  it('says so when the service was saved but its activity types were refused', async () => {
    server.use(
      http.post(orgApiPath('/services'), () =>
        ok(service('service-pay', 'PAY', 'Payroll'), { status: 201 }),
      ),
      http.put(orgApiPath('/services/service-pay/activity-codes'), () =>
        fail(422, 'VALIDATION_ERROR', 'One of the activity types does not exist.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Payroll');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'pay');
    await user.click(within(dialog).getByRole('checkbox', { name: /Bookkeeping/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));

    expect(
      await screen.findByText('Payroll saved, but its activity types were not'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /One of the activity types does not exist\. Edit the service to try again\./,
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Add service' })).not.toBeInTheDocument(),
    );
  });
});

describe('ServiceFormPanel default tasks', () => {
  const dialogOf = () => screen.getByRole('region', { name: 'Edit service' });
  const titlesIn = (dialog: HTMLElement) =>
    within(dialog)
      .queryAllByRole('textbox', { name: 'Title' })
      .map((box) => (box as HTMLInputElement).value);

  it('shows the count of default tasks in its own sortable column', async () => {
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    await row(/^Year-end accounts/);
    expect(screen.getByRole('columnheader', { name: /Default tasks/ })).toBeInTheDocument();
    expect(within(await row(/^Tax advice/)).getAllByText('—').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Default tasks' }));
    await user.click(screen.getByRole('button', { name: 'Default tasks' }));
    expect(names()[0]?.startsWith('Year-e')).toBe(true);
  });

  it('loads the default tasks of the service being edited, in order', async () => {
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    const dialog = await openEdit(user, 'Year-end accounts');
    await waitFor(() =>
      expect(titlesIn(dialog)).toEqual([
        'Request records',
        'Prepare the accounts',
        'Partner review',
      ]),
    );
    const second = within(within(dialog).getByRole('group', { name: 'Default task 2' }));
    expect(second.getByRole('textbox', { name: 'Hours budget' })).toHaveValue('4:30');
    expect(second.getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Trial balance to draft accounts',
    );
    const first = within(within(dialog).getByRole('group', { name: 'Default task 1' }));
    expect(first.getByRole('textbox', { name: 'Due (days after the job starts)' })).toHaveValue(
      '7',
    );
    // Nothing changed: nothing to save.
    expect(within(dialog).getByRole('button', { name: 'Save service' })).toBeDisabled();
  });

  it('saves a changed list with PUT, replacing the whole ordered list, and no service PATCH', async () => {
    const calls: Array<{ method: string; body: unknown }> = [];
    server.use(
      http.patch(orgApiPath(`/services/${accountsService.id}`), async ({ request }) => {
        calls.push({ method: 'PATCH', body: await request.json() });
        return ok(accountsService);
      }),
      http.put(
        orgApiPath(`/services/${accountsService.id}/task-templates`),
        async ({ request }) => {
          calls.push({ method: 'PUT', body: await request.json() });
          return ok(accountsTemplates);
        },
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    const dialog = await openEdit(user, 'Year-end accounts');
    await waitFor(() => expect(titlesIn(dialog)).toHaveLength(3));

    await user.click(within(dialog).getByRole('button', { name: 'Remove task 2' }));
    await user.click(within(dialog).getByRole('button', { name: 'Move task 2 up' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    const added = within(within(dialog).getByRole('group', { name: 'Default task 3' }));
    await user.type(added.getByRole('textbox', { name: 'Title' }), 'File the accounts');
    await user.type(added.getByRole('textbox', { name: 'Hours budget' }), '0:45{Enter}');
    await user.click(within(dialog).getByRole('button', { name: 'Save service' }));

    expect(await screen.findByText('Year-end accounts saved')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'PUT',
        body: {
          templates: [
            {
              title: 'Partner review',
              description: null,
              budget_minutes: null,
              due_offset_days: 30,
            },
            {
              title: 'Request records',
              description: null,
              budget_minutes: null,
              due_offset_days: 7,
            },
            {
              title: 'File the accounts',
              description: null,
              budget_minutes: 45,
              due_offset_days: null,
            },
          ],
        },
      },
    ]);
  });

  it('does not send the default tasks when only the service changed', async () => {
    const calls: string[] = [];
    server.use(
      http.patch(orgApiPath(`/services/${accountsService.id}`), () => {
        calls.push('PATCH');
        return ok(accountsService);
      }),
      http.put(orgApiPath(`/services/${accountsService.id}/task-templates`), () => {
        calls.push('PUT');
        return ok([]);
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    const dialog = await openEdit(user, 'Year-end accounts');
    await waitFor(() => expect(titlesIn(dialog)).toHaveLength(3));
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Annual accounts');
    await user.click(within(dialog).getByRole('button', { name: 'Save service' }));
    expect(await screen.findByText('Annual accounts saved')).toBeInTheDocument();
    expect(calls).toEqual(['PATCH']);
  });

  it('saves a changed list when it is all that changed, and an emptied list clears them', async () => {
    const calls: Array<{ method: string; body: unknown }> = [];
    server.use(
      http.patch(orgApiPath(`/services/${accountsService.id}`), async ({ request }) => {
        calls.push({ method: 'PATCH', body: await request.json() });
        return ok(accountsService);
      }),
      http.put(
        orgApiPath(`/services/${accountsService.id}/task-templates`),
        async ({ request }) => {
          calls.push({ method: 'PUT', body: await request.json() });
          return ok([]);
        },
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    const dialog = await openEdit(user, 'Year-end accounts');
    await waitFor(() => expect(titlesIn(dialog)).toHaveLength(3));
    for (let i = 0; i < 3; i += 1) {
      await user.click(within(dialog).getByRole('button', { name: 'Remove task 1' }));
    }
    await user.click(within(dialog).getByRole('button', { name: 'Save service' }));
    expect(await screen.findByText('Year-end accounts saved')).toBeInTheDocument();
    expect(calls).toEqual([{ method: 'PUT', body: { templates: [] } }]);
  });

  it('adds a service with default tasks: the service first, then the list', async () => {
    const calls: Array<{ method: string; path: string; body: unknown }> = [];
    server.use(
      http.post(orgApiPath('/services'), async ({ request }) => {
        calls.push({ method: 'POST', path: '/services', body: await request.json() });
        return ok(service('service-pay', 'PAY', 'Payroll'), { status: 201 });
      }),
      http.put(orgApiPath('/services/service-pay/task-templates'), async ({ request }) => {
        calls.push({ method: 'PUT', path: 'task-templates', body: await request.json() });
        return ok([]);
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Payroll');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'pay');
    await user.click(within(dialog).getByRole('button', { name: 'Paste a list' }));
    await user.click(within(dialog).getByRole('textbox', { name: 'Tasks to add' }));
    await user.paste('1. Collect inputs\n2. Run payroll');
    await user.click(within(dialog).getByRole('button', { name: 'Add 2 tasks' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));

    expect(await screen.findByText('Payroll added')).toBeInTheDocument();
    expect(calls.map((call) => call.method)).toEqual(['POST', 'PUT']);
    expect(calls[1]?.body).toEqual({
      templates: [
        { title: 'Collect inputs', description: null, budget_minutes: null, due_offset_days: null },
        { title: 'Run payroll', description: null, budget_minutes: null, due_offset_days: null },
      ],
    });
  });

  it('does not save and shows the errors while a row has no title or a wrong number of days', async () => {
    let puts = 0;
    server.use(
      http.put(orgApiPath(`/services/${accountsService.id}/task-templates`), () => {
        puts += 1;
        return ok([]);
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    const dialog = await openEdit(user, 'Year-end accounts');
    await waitFor(() => expect(titlesIn(dialog)).toHaveLength(3));
    await user.clear(within(dialog).getAllByRole('textbox', { name: 'Title' })[0] as HTMLElement);
    const days = within(dialog).getAllByRole('textbox', {
      name: 'Due (days after the job starts)',
    })[2] as HTMLElement;
    await user.clear(days);
    await user.type(days, '4000');
    await user.click(within(dialog).getByRole('button', { name: 'Save service' }));

    expect(await within(dialog).findByText('Enter the task title')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Enter a whole number of days from 0 to 3650'),
    ).toBeInTheDocument();
    expect(puts).toBe(0);
  });

  it('shows the API refusal of the list in the dialog and keeps it open', async () => {
    server.use(
      http.put(orgApiPath(`/services/${accountsService.id}/task-templates`), () =>
        fail(422, 'VALIDATION_ERROR', 'Some fields are not valid.', {
          details: [
            { field: 'templates.0.title', code: 'too_long', message: 'The title is too long.' },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    const dialog = await openEdit(user, 'Year-end accounts');
    await waitFor(() => expect(titlesIn(dialog)).toHaveLength(3));
    await user.click(within(dialog).getByRole('button', { name: 'Remove task 3' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save service' }));

    expect(await within(dialog).findByText('The title is too long.')).toBeInTheDocument();
    expect(dialogOf()).toBeInTheDocument();
  });

  it('says so when a new service was saved but its default tasks were refused', async () => {
    server.use(
      http.post(orgApiPath('/services'), () =>
        ok(service('service-pay', 'PAY', 'Payroll'), { status: 201 }),
      ),
      http.put(orgApiPath('/services/service-pay/task-templates'), () =>
        fail(403, 'PERMISSION_DENIED', 'You need settings.manage.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Payroll');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'pay');
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Run payroll');
    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));

    expect(
      await screen.findByText('Payroll saved, but its default tasks were not'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Add service' })).not.toBeInTheDocument(),
    );
  });

  it('offers a retry when the default tasks cannot be loaded, and does not touch them', async () => {
    let attempt = 0;
    server.use(
      http.get(orgApiPath(`/services/${accountsService.id}/task-templates`), () => {
        attempt += 1;
        return attempt === 1 ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok(accountsTemplates);
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    const dialog = await openEdit(user, 'Year-end accounts');
    expect(await within(dialog).findByText(/Could not load the default tasks/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(titlesIn(dialog)).toHaveLength(3));
  });
});

describe('ServicesPage delete', () => {
  it('deletes an unused service after confirmation', async () => {
    let deleted = 0;
    server.use(
      http.delete(orgApiPath(`/services/${taxService.id}`), () => {
        deleted += 1;
        return ok({ outcome: 'deleted', id: taxService.id });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    await user.click(
      within(await openActions(user, 'Tax advice')).getByRole('menuitem', { name: 'Delete' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Delete service?' });
    expect(within(dialog).getByText(/is not used by any job/)).toBeInTheDocument();
    expect(deleted).toBe(0);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Tax advice deleted')).toBeInTheDocument();
    expect(deleted).toBe(1);
  });

  it('explains that a used service is deactivated instead, and reports what happened', async () => {
    server.use(
      http.delete(orgApiPath(`/services/${accountsService.id}`), () =>
        ok({ outcome: 'deactivated', id: accountsService.id }),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    await user.click(
      within(await openActions(user, 'Year-end accounts')).getByRole('menuitem', {
        name: 'Delete',
      }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate service?' });
    expect(within(dialog).getByText(/cannot be deleted/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Year-end accounts deactivated instead')).toBeInTheDocument();
    expect(
      screen.getByText(/It is used by jobs, engagements, invoices or rates, so it was kept/),
    ).toBeInTheDocument();
  });

  it('keeps the dialog open with the refusal of the API', async () => {
    server.use(
      http.delete(orgApiPath(`/services/${taxService.id}`), () =>
        fail(403, 'PERMISSION_DENIED', 'You need the settings.manage permission.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);

    await user.click(
      within(await openActions(user, 'Tax advice')).getByRole('menuitem', { name: 'Delete' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Delete service?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(
      await within(dialog).findByText('You need the settings.manage permission.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Delete service?' })).toBeInTheDocument();
  });
});
