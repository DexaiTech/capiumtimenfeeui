import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type { ClientDetail, ClientRateRead } from '../types';
import { techwave, techwaveDetail, testServices } from './fixtures';
import { heading, renderWorkspace, type RenderWorkspaceOptions } from './renderWorkspace';
import {
  ADA_ID,
  centralClients,
  GRACE_ID,
  invoiceTemplates,
  linkedDetail,
  northwind,
  vatRates,
} from './workspaceFixtures';

const SETTINGS = `/acme/clients/${techwave.id}/settings`;
const NAME = 'Techwave Innovations Ltd';
const RAMYA = techwaveDetail.contacts[0];
const TARAK = techwaveDetail.contacts[1];
const PAYROLL = testServices[1];
const STANDARD = vatRates[0];
const MODERN = invoiceTemplates[1];

type SettingsOptions = RenderWorkspaceOptions & {
  /** The section of the left menu to open (`?section=`); Billing when left out. */
  section?: string;
};

/** The client's settings page, once the heading is up. */
async function openSettings({ section, ...options }: SettingsOptions = {}) {
  const view = renderWorkspace(section ? `${SETTINGS}?section=${section}` : SETTINGS, options);
  await heading(NAME);
  return view;
}

/** The sections other than Billing each open on their own page of the menu. */
const openTeam = (options: RenderWorkspaceOptions = {}) =>
  openSettings({ ...options, section: 'team' });
const openServices = (options: RenderWorkspaceOptions = {}) =>
  openSettings({ ...options, section: 'services' });
const openRates = (options: RenderWorkspaceOptions = {}) =>
  openSettings({ ...options, section: 'rates' });
const openCentral = (options: RenderWorkspaceOptions = {}) =>
  openSettings({ ...options, section: 'central' });
const openDanger = (options: RenderWorkspaceOptions = {}) =>
  openSettings({ ...options, section: 'danger' });

const region = (name: string) => within(screen.getByRole('region', { name }));
const findRegion = async (name: string) => within(await screen.findByRole('region', { name }));

/** An item of the left menu of sections, or null when it is not offered. */
const menuItem = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Settings sections' })).queryByRole('link', {
    name,
  });

/** The same item, for a click: it must be there. */
const menuLink = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Settings sections' })).getByRole('link', { name });

/** The billing form shows once the lookups (VAT codes, services, templates) have loaded. */
const billingEmail = () => screen.findByRole('textbox', { name: 'Invoice email' });

const patchClient = (bodies: unknown[], response: ClientDetail = techwaveDetail) =>
  http.patch(orgApiPath('/clients/:clientId'), async ({ request }) => {
    bodies.push(await request.json());
    return ok(response);
  });

describe('BillingCard', () => {
  it('shows the saved settings and keeps Save off until something changes', async () => {
    await openSettings();
    await billingEmail();

    const billing = region('Billing');
    expect(billing.getByRole('textbox', { name: 'Invoice email' })).toHaveValue('');
    expect(billing.getByRole('combobox', { name: 'Billing contact' })).toHaveDisplayValue(
      'Tarak Patel (tarak@techwave.example)',
    );
    expect(billing.getByRole('textbox', { name: 'Payment terms (days)' })).toHaveValue('30');
    expect(billing.getByRole('combobox', { name: 'Default VAT code' })).toHaveDisplayValue(
      'No default VAT code',
    );
    expect(billing.getByRole('combobox', { name: 'Default service' })).toHaveDisplayValue(
      'No default service',
    );
    expect(billing.getByRole('combobox', { name: 'Invoice template' })).toHaveDisplayValue(
      'Practice default',
    );
    expect(billing.getByRole('button', { name: 'Save billing settings' })).toBeDisabled();
  });

  it('says so while there are unsaved changes, and Discard puts the saved values back', async () => {
    const bodies: unknown[] = [];
    const user = userEvent.setup();
    await openSettings({ handlers: [patchClient(bodies)] });
    await billingEmail();

    const billing = region('Billing');
    const discard = billing.getByRole('button', { name: 'Discard changes' });
    expect(discard).toBeDisabled();
    expect(billing.queryByText('You have unsaved changes.')).not.toBeInTheDocument();

    const terms = billing.getByRole('textbox', { name: 'Payment terms (days)' });
    await user.clear(terms);
    await user.type(terms, '14');
    expect(billing.getByRole('status')).toHaveTextContent('You have unsaved changes.');
    expect(discard).toBeEnabled();
    expect(billing.getByRole('button', { name: 'Save billing settings' })).toBeEnabled();

    await user.click(discard);
    expect(terms).toHaveValue('30');
    expect(billing.queryByText('You have unsaved changes.')).not.toBeInTheDocument();
    expect(billing.getByRole('button', { name: 'Save billing settings' })).toBeDisabled();
    expect(bodies).toEqual([]);
  });

  it('offers the VAT codes, services and templates of the practice', async () => {
    await openSettings();
    await billingEmail();

    const billing = region('Billing');
    const options = (name: string) =>
      within(billing.getByRole('combobox', { name }))
        .getAllByRole('option')
        .map((option) => option.textContent);
    expect(options('Default VAT code')).toEqual([
      'No default VAT code',
      'Standard (20%)',
      'Zero rated (0%)',
    ]);
    expect(options('Default service')).toEqual(['No default service', 'Accounts', 'Payroll']);
    expect(options('Invoice template')).toEqual([
      'Practice default',
      'Classic (default)',
      'Modern',
    ]);
    expect(options('Billing contact')).toEqual([
      'No billing contact',
      'Ramya Menon (ramya@techwave.example)',
      'Tarak Patel (tarak@techwave.example)',
    ]);
  });

  it('saves only the fields that changed, with the exact PATCH body', async () => {
    const bodies: unknown[] = [];
    const contactCalls: unknown[] = [];
    const user = userEvent.setup();
    await openSettings({
      handlers: [
        patchClient(bodies),
        http.patch(orgApiPath('/clients/:clientId/contacts/:contactId'), ({ params }) => {
          contactCalls.push(params.contactId);
          return ok(TARAK);
        }),
      ],
    });
    await billingEmail();
    const billing = region('Billing');

    await user.type(
      billing.getByRole('textbox', { name: 'Invoice email' }),
      'billing@techwave.example',
    );
    const terms = billing.getByRole('textbox', { name: 'Payment terms (days)' });
    await user.clear(terms);
    await user.type(terms, '14');
    await user.selectOptions(
      billing.getByRole('combobox', { name: 'Default VAT code' }),
      'Standard (20%)',
    );
    await user.selectOptions(billing.getByRole('combobox', { name: 'Default service' }), 'Payroll');
    await user.selectOptions(billing.getByRole('combobox', { name: 'Invoice template' }), 'Modern');
    await user.type(billing.getByRole('textbox', { name: 'Billing notes' }), 'Pay by BACS');
    await user.click(billing.getByRole('button', { name: 'Save billing settings' }));

    await waitFor(() =>
      expect(bodies).toEqual([
        {
          invoice_email: 'billing@techwave.example',
          payment_terms_days: 14,
          default_vat_rate_id: STANDARD?.id,
          default_service_id: PAYROLL?.id,
          invoice_template_id: MODERN?.id,
          billing_notes: 'Pay by BACS',
        },
      ]),
    );
    expect(await screen.findByText('Billing settings saved')).toBeInTheDocument();
    // The billing contact did not change: the contacts are left alone.
    expect(contactCalls).toEqual([]);
    // Saved: nothing left to save.
    expect(billing.getByRole('button', { name: 'Save billing settings' })).toBeDisabled();
  });

  it('sends null for a field that was cleared', async () => {
    const bodies: unknown[] = [];
    const user = userEvent.setup();
    await openSettings({
      clients: [{ ...techwaveDetail, invoice_email: 'old@techwave.example' }],
      handlers: [patchClient(bodies)],
    });
    await billingEmail();
    const billing = region('Billing');

    await user.clear(billing.getByRole('textbox', { name: 'Invoice email' }));
    await user.clear(billing.getByRole('textbox', { name: 'Payment terms (days)' }));
    await user.click(billing.getByRole('button', { name: 'Save billing settings' }));

    await waitFor(() =>
      expect(bodies).toEqual([{ invoice_email: null, payment_terms_days: null }]),
    );
  });

  it('makes another contact the billing contact: the new one is flagged before the old one is cleared', async () => {
    const bodies: unknown[] = [];
    const contactCalls: Array<[string, unknown]> = [];
    const user = userEvent.setup();
    await openSettings({
      handlers: [
        patchClient(bodies),
        http.patch(
          orgApiPath('/clients/:clientId/contacts/:contactId'),
          async ({ params, request }) => {
            contactCalls.push([String(params.contactId), await request.json()]);
            return ok(TARAK);
          },
        ),
      ],
    });
    await billingEmail();
    const billing = region('Billing');

    await user.selectOptions(
      billing.getByRole('combobox', { name: 'Billing contact' }),
      'Ramya Menon (ramya@techwave.example)',
    );
    await user.click(billing.getByRole('button', { name: 'Save billing settings' }));

    await waitFor(() => expect(contactCalls).toHaveLength(2));
    expect(contactCalls).toEqual([
      [RAMYA?.id, { is_billing: true }],
      [TARAK?.id, { is_billing: false }],
    ]);
    // Nothing else changed: the client is not patched.
    expect(bodies).toEqual([]);
    expect(await screen.findByText('Billing settings saved')).toBeInTheDocument();
  });

  it('removes the billing contact', async () => {
    const contactCalls: Array<[string, unknown]> = [];
    const user = userEvent.setup();
    await openSettings({
      handlers: [
        http.patch(
          orgApiPath('/clients/:clientId/contacts/:contactId'),
          async ({ params, request }) => {
            contactCalls.push([String(params.contactId), await request.json()]);
            return ok(TARAK);
          },
        ),
      ],
    });
    await billingEmail();
    const billing = region('Billing');

    await user.selectOptions(
      billing.getByRole('combobox', { name: 'Billing contact' }),
      'No billing contact',
    );
    await user.click(billing.getByRole('button', { name: 'Save billing settings' }));

    await waitFor(() => expect(contactCalls).toEqual([[TARAK?.id, { is_billing: false }]]));
  });

  it('checks the fields before sending anything', async () => {
    const bodies: unknown[] = [];
    const user = userEvent.setup();
    await openSettings({ handlers: [patchClient(bodies)] });
    await billingEmail();
    const billing = region('Billing');

    await user.type(billing.getByRole('textbox', { name: 'Invoice email' }), 'not-an-email');
    const terms = billing.getByRole('textbox', { name: 'Payment terms (days)' });
    await user.clear(terms);
    await user.type(terms, 'abc');
    await user.click(billing.getByRole('button', { name: 'Save billing settings' }));

    expect(await billing.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(billing.getByText('Enter a number of days from 0 to 365')).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('maps a 422 onto the fields it names', async () => {
    const user = userEvent.setup();
    await openSettings({
      handlers: [
        http.patch(orgApiPath('/clients/:clientId'), () =>
          fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
            details: [
              {
                field: 'invoice_email',
                code: 'invalid',
                message: 'This email address cannot receive invoices.',
              },
            ],
          }),
        ),
      ],
    });
    await billingEmail();
    const billing = region('Billing');

    await user.type(
      billing.getByRole('textbox', { name: 'Invoice email' }),
      'billing@techwave.example',
    );
    await user.click(billing.getByRole('button', { name: 'Save billing settings' }));

    expect(
      await billing.findByText('This email address cannot receive invoices.'),
    ).toBeInTheDocument();
    expect(billing.getByRole('textbox', { name: 'Invoice email' })).toBeInvalid();
  });

  it('explains a choice that was removed while the form was open', async () => {
    const user = userEvent.setup();
    await openSettings({
      handlers: [
        http.patch(orgApiPath('/clients/:clientId'), () =>
          fail(404, 'RESOURCE_NOT_FOUND', 'Service not found.', {
            details: { field: 'default_service_id' },
          }),
        ),
      ],
    });
    await billingEmail();
    const billing = region('Billing');

    await user.selectOptions(billing.getByRole('combobox', { name: 'Default service' }), 'Payroll');
    await user.click(billing.getByRole('button', { name: 'Save billing settings' }));

    expect(
      await billing.findByText('This choice is no longer available. Choose another.'),
    ).toBeInTheDocument();
    expect(billing.getByRole('combobox', { name: 'Default service' })).toBeInvalid();
  });

  it('shows any other failure above the button', async () => {
    const user = userEvent.setup();
    await openSettings({
      handlers: [
        http.patch(orgApiPath('/clients/:clientId'), () =>
          fail(409, 'CLIENT_CODE_TAKEN', 'Something conflicts with another client.'),
        ),
      ],
    });
    await billingEmail();
    const billing = region('Billing');

    await user.type(billing.getByRole('textbox', { name: 'Billing notes' }), 'Hello');
    await user.click(billing.getByRole('button', { name: 'Save billing settings' }));

    expect(await billing.findByRole('alert')).toHaveTextContent(
      'Something conflicts with another client.',
    );
  });

  it('is read-only for a role that may not update clients', async () => {
    await openSettings({ permissions: STAFF_PERMISSIONS });
    await billingEmail();
    const billing = region('Billing');

    expect(billing.getByRole('textbox', { name: 'Invoice email' })).toBeDisabled();
    expect(billing.getByRole('combobox', { name: 'Default VAT code' })).toBeDisabled();
    expect(billing.queryByRole('button', { name: 'Save billing settings' })).toBeNull();
  });
});

describe('TeamCard', () => {
  it('saves the partner and the manager, sending only what changed', async () => {
    const bodies: unknown[] = [];
    const user = userEvent.setup();
    await openTeam({ handlers: [patchClient(bodies)] });
    const team = await findRegion('Team');

    expect(await team.findByRole('combobox', { name: 'Manager' })).toHaveDisplayValue(
      'Grace Hopper',
    );
    expect(team.getByRole('combobox', { name: 'Partner' })).toHaveDisplayValue('Nobody');
    expect(team.getByRole('button', { name: 'Save team' })).toBeDisabled();

    await user.selectOptions(team.getByRole('combobox', { name: 'Partner' }), 'Ada Lovelace');
    await user.selectOptions(team.getByRole('combobox', { name: 'Manager' }), 'Nobody');
    await user.click(team.getByRole('button', { name: 'Save team' }));

    await waitFor(() =>
      expect(bodies).toEqual([{ partner_user_id: ADA_ID, manager_user_id: null }]),
    );
    expect(await screen.findByText('Team saved')).toBeInTheDocument();
  });

  it('Discard puts the partner and the manager back', async () => {
    const user = userEvent.setup();
    await openTeam();
    const team = await findRegion('Team');

    const partner = await team.findByRole('combobox', { name: 'Partner' });
    expect(team.getByRole('button', { name: 'Discard changes' })).toBeDisabled();
    await user.selectOptions(partner, 'Ada Lovelace');
    expect(team.getByRole('status')).toHaveTextContent('You have unsaved changes.');

    await user.click(team.getByRole('button', { name: 'Discard changes' }));
    expect(partner).toHaveDisplayValue('Nobody');
    expect(team.getByRole('button', { name: 'Save team' })).toBeDisabled();
  });

  it('sends one field when only one changed', async () => {
    const bodies: unknown[] = [];
    const user = userEvent.setup();
    await openTeam({ handlers: [patchClient(bodies)] });
    const team = await findRegion('Team');

    await user.selectOptions(
      await team.findByRole('combobox', { name: 'Partner' }),
      'Grace Hopper',
    );
    await user.click(team.getByRole('button', { name: 'Save team' }));

    await waitFor(() => expect(bodies).toEqual([{ partner_user_id: GRACE_ID }]));
  });

  it('says why the team cannot be shown without the staff list', async () => {
    await openTeam({
      permissions: OWNER_PERMISSIONS.filter((permission) => permission !== 'member.read'),
    });
    const team = await findRegion('Team');
    expect(team.getByText(/Your role does not include the staff list/)).toBeInTheDocument();
    expect(team.queryByRole('combobox')).toBeNull();
    expect(team.queryByRole('button', { name: 'Save team' })).toBeNull();
  });

  it('cannot be saved by a role that may not update clients', async () => {
    await openTeam({ permissions: STAFF_PERMISSIONS });
    const team = await findRegion('Team');
    expect(await team.findByRole('combobox', { name: 'Partner' })).toBeDisabled();
    expect(team.queryByRole('button', { name: 'Save team' })).toBeNull();
  });
});

describe('ServicesCard', () => {
  const caption = `Services of ${NAME}`;
  const engagement = techwaveDetail.engagements[0];

  it('lists the services the client takes', async () => {
    await openServices();
    const row = within(await screen.findByRole('table', { name: caption })).getByRole('row', {
      name: /Accounts/,
    });
    expect(row).toHaveTextContent('Fixed fee');
    expect(row).toHaveTextContent('£1,500.00');
    expect(row).toHaveTextContent('Annually');
    expect(row).toHaveTextContent('01/04/2026');
    expect(row).toHaveTextContent('Active');
  });

  it('adds a service with the fee in pounds sent as pence', async () => {
    const posted: unknown[] = [];
    const user = userEvent.setup();
    await openServices({
      handlers: [
        http.post(orgApiPath('/clients/:clientId/services'), async ({ request }) => {
          posted.push(await request.json());
          return ok(engagement, { status: 201 });
        }),
      ],
    });
    await screen.findByRole('table', { name: caption });

    await user.click(screen.getByRole('button', { name: 'Add service' }));
    const dialog = await screen.findByRole('region', { name: 'Add service' });
    const service = within(dialog).getByRole('combobox', { name: 'Service' });
    // Accounts is already taken: only Payroll is offered.
    expect(within(service).queryByRole('option', { name: /Accounts/ })).toBeNull();
    await user.selectOptions(service, 'PAY · Payroll');
    await user.type(within(dialog).getByRole('textbox', { name: /Agreed fee/ }), '1,234.5');
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Frequency' }),
      'Monthly',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add service' }));

    await waitFor(() =>
      expect(posted).toEqual([
        {
          service_id: PAYROLL?.id,
          fee: 123450,
          frequency: 'monthly',
          start_date: null,
          end_date: null,
          is_active: true,
          auto_create_jobs: false,
        },
      ]),
    );
  });

  it('removes a service after a confirmation', async () => {
    const removed: string[] = [];
    const user = userEvent.setup();
    await openServices({
      handlers: [
        http.delete(orgApiPath('/clients/:clientId/services/:engagementId'), ({ params }) => {
          removed.push(String(params.engagementId));
          return ok(null);
        }),
      ],
    });
    await screen.findByRole('table', { name: caption });

    await user.click(screen.getByRole('button', { name: 'Remove Accounts' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove service' });
    expect(removed).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(removed).toEqual([engagement?.id]));
    expect(await screen.findByText('Service removed')).toBeInTheDocument();
  });

  it('explains a refused removal inside the dialog', async () => {
    const user = userEvent.setup();
    await openServices({
      handlers: [
        http.delete(orgApiPath('/clients/:clientId/services/:engagementId'), () =>
          fail(409, 'CLIENT_SERVICE_IN_USE', 'Jobs still use this service.'),
        ),
      ],
    });
    await screen.findByRole('table', { name: caption });

    await user.click(screen.getByRole('button', { name: 'Remove Accounts' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove service' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Jobs still use this service.',
    );
  });

  it('shows no edit actions to a read-only role', async () => {
    await openServices({ permissions: STAFF_PERMISSIONS });
    expect(await screen.findByRole('table', { name: caption })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add service' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Accounts' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Accounts' })).toBeNull();
  });

  it('invites a client without services to add one', async () => {
    await openServices({ clients: [{ ...techwaveDetail, engagements: [] }] });
    expect(await screen.findByText('This client takes no services yet')).toBeInTheDocument();
  });
});

describe('RatesCard', () => {
  const caption = `Rate overrides of ${NAME}`;
  const rate = (fields: Partial<ClientRateRead> & Pick<ClientRateRead, 'id'>): ClientRateRead => ({
    client_id: techwave.id,
    user_id: null,
    user_name: null,
    hourly_rate: 12000,
    effective_from: '2000-01-01',
    effective_to: null,
    created_at: '2026-01-10T09:00:00Z',
    updated_at: '2026-01-10T09:00:00Z',
    ...fields,
  });
  const everyone = rate({ id: '0198c1f2-0000-7000-8000-0000000ff001' });
  const later = rate({
    id: '0198c1f2-0000-7000-8000-0000000ff002',
    user_id: GRACE_ID,
    user_name: 'Grace Hopper',
    hourly_rate: 15000,
    effective_from: '2999-01-01',
  });
  const ended = rate({
    id: '0198c1f2-0000-7000-8000-0000000ff003',
    user_id: ADA_ID,
    user_name: 'Ada Lovelace',
    hourly_rate: 8000,
    effective_from: '2001-01-01',
    effective_to: '2001-12-31',
  });
  const withRates = (rates: ClientRateRead[]): ClientDetail => ({ ...techwaveDetail, rates });
  const open = (
    rates: ClientRateRead[] = [everyone, later, ended],
    options: RenderWorkspaceOptions = {},
  ) => openRates({ clients: [withRates(rates)], ...options });
  const rowOf = (name: RegExp) =>
    within(screen.getByRole('table', { name: caption })).getByRole('row', { name });

  it('lists the overrides, the latest start first, with where each stands', async () => {
    await open();
    await screen.findByRole('table', { name: caption });

    const rows = within(screen.getByRole('table', { name: caption }))
      .getAllByRole('row')
      .slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Grace Hopper');
    expect(rows[0]).toHaveTextContent('£150.00 / h');
    expect(rows[0]).toHaveTextContent('01/01/2999');
    expect(rows[0]).toHaveTextContent('Starts later');
    expect(rows[1]).toHaveTextContent('Ada Lovelace');
    expect(rows[1]).toHaveTextContent('£80.00 / h');
    expect(rows[1]).toHaveTextContent('31/12/2001');
    expect(rows[1]).toHaveTextContent('Ended');
    expect(rows[2]).toHaveTextContent('Everyone');
    expect(rows[2]).toHaveTextContent('£120.00 / h');
    expect(rows[2]).toHaveTextContent('01/01/2000');
    expect(rows[2]).toHaveTextContent('No end date');
    expect(rows[2]).toHaveTextContent('Current');
  });

  it('adds a rate for everyone, leaving the period out', async () => {
    const posted: unknown[] = [];
    const user = userEvent.setup();
    await open([], {
      handlers: [
        http.post(orgApiPath('/clients/:clientId/rates'), async ({ request }) => {
          posted.push(await request.json());
          return ok(everyone, { status: 201 });
        }),
      ],
    });
    expect(await screen.findByText('No rate overrides')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add rate' }));
    const dialog = await screen.findByRole('region', { name: 'Add client rate' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), '95');
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));

    await waitFor(() => expect(posted).toEqual([{ user_id: null, hourly_rate: 9500 }]));
    expect(await screen.findByText('Rate added')).toBeInTheDocument();
  });

  it('adds a rate for one person and a period', async () => {
    const posted: unknown[] = [];
    const user = userEvent.setup();
    await open([everyone], {
      handlers: [
        http.post(orgApiPath('/clients/:clientId/rates'), async ({ request }) => {
          posted.push(await request.json());
          return ok(later, { status: 201 });
        }),
      ],
    });
    await screen.findByRole('table', { name: caption });

    await user.click(screen.getByRole('button', { name: 'Add rate' }));
    const dialog = await screen.findByRole('region', { name: 'Add client rate' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Applies to' }),
      'Grace Hopper',
    );
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), '120.50');
    fireEvent.change(within(dialog).getByLabelText('Effective from'), {
      target: { value: '2026-07-01' },
    });
    fireEvent.change(within(dialog).getByLabelText('Effective to'), {
      target: { value: '2026-12-31' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));

    await waitFor(() =>
      expect(posted).toEqual([
        {
          user_id: GRACE_ID,
          hourly_rate: 12050,
          effective_from: '2026-07-01',
          effective_to: '2026-12-31',
        },
      ]),
    );
  });

  it('checks the amount and the period before sending', async () => {
    const posted: unknown[] = [];
    const user = userEvent.setup();
    await open([], {
      handlers: [
        http.post(orgApiPath('/clients/:clientId/rates'), async ({ request }) => {
          posted.push(await request.json());
          return ok(everyone, { status: 201 });
        }),
      ],
    });
    await user.click(await screen.findByRole('button', { name: 'Add rate' }));
    const dialog = await screen.findByRole('region', { name: 'Add client rate' });

    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));
    expect(
      await within(dialog).findByText('Enter an hourly rate in pounds, for example 95 or 120.50'),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), '95');
    fireEvent.change(within(dialog).getByLabelText('Effective from'), {
      target: { value: '2026-07-01' },
    });
    fireEvent.change(within(dialog).getByLabelText('Effective to'), {
      target: { value: '2026-06-01' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));
    expect(
      await within(dialog).findByText('The end date is before the start date'),
    ).toBeInTheDocument();
    expect(posted).toEqual([]);
  });

  it('maps a 422 onto the field it names', async () => {
    const user = userEvent.setup();
    await open([], {
      handlers: [
        http.post(orgApiPath('/clients/:clientId/rates'), () =>
          fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
            details: [
              {
                field: 'effective_from',
                code: 'invalid',
                message: 'A rate already starts on that day.',
              },
            ],
          }),
        ),
      ],
    });
    await user.click(await screen.findByRole('button', { name: 'Add rate' }));
    const dialog = await screen.findByRole('region', { name: 'Add client rate' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), '95');
    fireEvent.change(within(dialog).getByLabelText('Effective from'), {
      target: { value: '2026-07-01' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));

    expect(
      await within(dialog).findByText('A rate already starts on that day.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Effective from')).toBeInvalid();
  });

  it('changes the amount of a rate and nothing else', async () => {
    const patched: Array<[string, unknown]> = [];
    const user = userEvent.setup();
    await open([everyone], {
      handlers: [
        http.patch(orgApiPath('/clients/:clientId/rates/:rateId'), async ({ params, request }) => {
          patched.push([String(params.rateId), await request.json()]);
          return ok(everyone);
        }),
      ],
    });
    await screen.findByRole('table', { name: caption });

    await user.click(screen.getByRole('button', { name: 'Edit rate of Everyone' }));
    const dialog = await screen.findByRole('region', { name: 'Edit client rate' });
    expect(within(dialog).getByRole('combobox', { name: 'Applies to' })).toBeDisabled();
    expect(within(dialog).getByLabelText('Effective from')).toBeDisabled();
    expect(within(dialog).getByLabelText('Effective to')).toBeDisabled();
    const amount = within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' });
    expect(amount).toHaveValue('120.00');
    await user.clear(amount);
    await user.type(amount, '130');
    await user.click(within(dialog).getByRole('button', { name: 'Save rate' }));

    await waitFor(() => expect(patched).toEqual([[everyone.id, { hourly_rate: 13000 }]]));
    expect(await screen.findByText('Rate updated')).toBeInTheDocument();
  });

  it('end-dates a rate through its rate rule', async () => {
    const patched: Array<[string, unknown]> = [];
    const user = userEvent.setup();
    await open([everyone], {
      handlers: [
        http.patch(orgApiPath('/rates/:rateId'), async ({ params, request }) => {
          patched.push([String(params.rateId), await request.json()]);
          return ok(everyone);
        }),
      ],
    });
    await screen.findByRole('table', { name: caption });

    await user.click(screen.getByRole('button', { name: 'End-date rate of Everyone' }));
    const dialog = await screen.findByRole('region', { name: 'End-date rate' });
    // A rate with no end date offers no "remove".
    expect(within(dialog).queryByRole('button', { name: 'Remove end date' })).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Last day of the rate'), {
      target: { value: '2026-12-31' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Save end date' }));

    await waitFor(() => expect(patched).toEqual([[everyone.id, { effective_to: '2026-12-31' }]]));
    expect(await screen.findByText('Rate end-dated')).toBeInTheDocument();
  });

  it('makes a rate open-ended again', async () => {
    const patched: Array<[string, unknown]> = [];
    const user = userEvent.setup();
    const ending = rate({ id: everyone.id, effective_to: '2999-12-31' });
    await open([ending], {
      handlers: [
        http.patch(orgApiPath('/rates/:rateId'), async ({ params, request }) => {
          patched.push([String(params.rateId), await request.json()]);
          return ok(ending);
        }),
      ],
    });
    await screen.findByRole('table', { name: caption });

    await user.click(screen.getByRole('button', { name: 'End-date rate of Everyone' }));
    const dialog = await screen.findByRole('region', { name: 'End-date rate' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove end date' }));

    await waitFor(() => expect(patched).toEqual([[everyone.id, { effective_to: null }]]));
    expect(await screen.findByText('End date removed')).toBeInTheDocument();
  });

  it('offers no end date for a rate that has ended', async () => {
    await open();
    await screen.findByRole('table', { name: caption });
    expect(screen.queryByRole('button', { name: 'End-date rate of Ada Lovelace' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'End-date rate of Grace Hopper' }),
    ).toBeInTheDocument();
    expect(rowOf(/Ada Lovelace/)).toBeInTheDocument();
  });

  it('deletes a rate after a confirmation', async () => {
    const removed: string[] = [];
    const user = userEvent.setup();
    await open([everyone], {
      handlers: [
        http.delete(orgApiPath('/clients/:clientId/rates/:rateId'), ({ params }) => {
          removed.push(String(params.rateId));
          return ok(null);
        }),
      ],
    });
    await screen.findByRole('table', { name: caption });

    await user.click(screen.getByRole('button', { name: 'Delete rate of Everyone' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete rate' });
    expect(dialog).toHaveTextContent('Delete the £120.00 an hour rate of Everyone');
    expect(removed).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(removed).toEqual([everyone.id]));
    expect(await screen.findByText('Rate deleted')).toBeInTheDocument();
  });

  it('suggests an end date when a rate that was used cannot be deleted', async () => {
    const user = userEvent.setup();
    await open([everyone], {
      handlers: [
        http.delete(orgApiPath('/clients/:clientId/rates/:rateId'), () =>
          fail(409, 'RATE_IN_USE', 'Time was recorded at this rate.'),
        ),
      ],
    });
    await screen.findByRole('table', { name: caption });

    await user.click(screen.getByRole('button', { name: 'Delete rate of Everyone' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete rate' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Time was recorded at this rate.');
    expect(alert).toHaveTextContent('End-date it instead');
  });

  it('is left out for a role without rate.read', async () => {
    await openRates({
      permissions: STAFF_PERMISSIONS,
      clients: [{ ...techwaveDetail, rates: null }],
    });
    // The section is not in the menu, so its address shows Billing instead.
    await billingEmail();
    expect(screen.queryByRole('region', { name: 'Rate overrides' })).toBeNull();
    expect(menuItem('Rate overrides')).toBeNull();
  });

  it('is read-only without rate.manage', async () => {
    await open([everyone], {
      permissions: OWNER_PERMISSIONS.filter((permission) => permission !== 'rate.manage'),
    });
    expect(await screen.findByRole('table', { name: caption })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add rate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit rate of Everyone' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete rate of Everyone' })).toBeNull();
  });
});

describe('CentralCard', () => {
  it('says a local client is not linked and offers to link it', async () => {
    await openCentral();
    const central = await findRegion('Central client');
    expect(central.getByText('Local')).toBeInTheDocument();
    expect(central.getByRole('button', { name: 'Link to a central client' })).toBeInTheDocument();
    expect(central.queryByRole('button', { name: 'Unlink' })).toBeNull();
    expect(central.queryByRole('button', { name: 'Sync with central' })).toBeNull();
    expect(central.queryByText('Central client ID')).toBeNull();
  });

  it('shows the central id and when it was last confirmed for a linked client', async () => {
    await openCentral({ clients: [linkedDetail] });
    const central = await findRegion('Central client');
    expect(central.getByText('Synced 12/05/2026')).toBeInTheDocument();
    expect(central.getByText('cen-0001')).toBeInTheDocument();
    expect(central.getByText('Last confirmed').nextElementSibling).toHaveTextContent('12/05/2026');
    expect(central.getByRole('button', { name: 'Sync with central' })).toBeInTheDocument();
    expect(central.getByRole('button', { name: 'Unlink' })).toBeInTheDocument();
    expect(central.queryByRole('button', { name: 'Link to a central client' })).toBeNull();
  });

  it('says it was never confirmed when the client has not been synchronised yet', async () => {
    await openCentral({
      clients: [{ ...linkedDetail, central_synced_at: null, central_sync_state: 'stale' }],
    });
    const central = await findRegion('Central client');
    expect(central.getByText('Last confirmed').nextElementSibling).toHaveTextContent('Never');
    expect(central.getByText('Stale')).toBeInTheDocument();
  });

  it('synchronises now', async () => {
    const calls: string[] = [];
    const user = userEvent.setup();
    await openCentral({
      clients: [linkedDetail],
      handlers: [
        http.post(orgApiPath('/clients/:clientId/central-sync'), ({ params }) => {
          calls.push(String(params.clientId));
          return ok({
            client_id: techwave.id,
            code: techwave.code,
            name: techwave.name,
            central_id: 'cen-0001',
            state: 'synced',
            changed: false,
            changes: {},
            from_cache: false,
            message: null,
            synced_at: '2026-06-15T10:00:00Z',
          });
        }),
      ],
    });
    const central = await findRegion('Central client');

    await user.click(central.getByRole('button', { name: 'Sync with central' }));
    await waitFor(() => expect(calls).toEqual([techwave.id]));
    expect(await screen.findByText('Already up to date')).toBeInTheDocument();
  });

  it('unlinks after a confirmation', async () => {
    const calls: string[] = [];
    const user = userEvent.setup();
    await openCentral({
      clients: [linkedDetail],
      handlers: [
        http.delete(orgApiPath('/clients/:clientId/central-link'), ({ params }) => {
          calls.push(String(params.clientId));
          return ok(techwaveDetail);
        }),
      ],
    });
    const central = await findRegion('Central client');

    await user.click(central.getByRole('button', { name: 'Unlink' }));
    const dialog = await screen.findByRole('dialog', { name: 'Unlink from central' });
    expect(dialog).toHaveTextContent('Its name and address become editable here');
    expect(calls).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Unlink' }));

    await waitFor(() => expect(calls).toEqual([techwave.id]));
    expect(await screen.findByText('Client unlinked')).toBeInTheDocument();
  });

  it('explains a refused unlink inside the dialog', async () => {
    const user = userEvent.setup();
    await openCentral({
      clients: [linkedDetail],
      handlers: [
        http.delete(orgApiPath('/clients/:clientId/central-link'), () =>
          fail(409, 'CENTRAL_LINK_NOT_FOUND', 'The client is not linked.'),
        ),
      ],
    });
    const central = await findRegion('Central client');

    await user.click(central.getByRole('button', { name: 'Unlink' }));
    const dialog = await screen.findByRole('dialog', { name: 'Unlink from central' });
    await user.click(within(dialog).getByRole('button', { name: 'Unlink' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The client is not linked.');
  });

  it('links a local client to the central client picked', async () => {
    const bodies: unknown[] = [];
    const user = userEvent.setup();
    await openCentral({
      handlers: [
        http.get(orgApiPath('/central-clients'), () =>
          ok({ items: centralClients, source: 'live', stale: false }),
        ),
        http.post(orgApiPath('/clients/:clientId/central-link'), async ({ request }) => {
          bodies.push(await request.json());
          return ok(linkedDetail);
        }),
      ],
    });
    const central = await findRegion('Central client');

    await user.click(central.getByRole('button', { name: 'Link to a central client' }));
    const dialog = await screen.findByRole('dialog', { name: 'Link to a central client' });
    // A central client already used in this practice cannot be linked again.
    expect(await within(dialog).findByText('In use')).toBeInTheDocument();
    await user.click(
      await within(dialog).findByRole('button', { name: `Link to ${northwind.name}` }),
    );

    await waitFor(() => expect(bodies).toEqual([{ central_id: northwind.central_id }]));
    expect(await screen.findByText('Client linked')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Link to a central client' })).toBeNull(),
    );
  });

  it('explains a refused link inside the dialog', async () => {
    const user = userEvent.setup();
    await openCentral({
      handlers: [
        http.get(orgApiPath('/central-clients'), () =>
          ok({ items: centralClients, source: 'live', stale: false }),
        ),
        http.post(orgApiPath('/clients/:clientId/central-link'), () =>
          fail(409, 'CENTRAL_CLIENT_ALREADY_LINKED', 'This central client is already linked.'),
        ),
      ],
    });
    const central = await findRegion('Central client');

    await user.click(central.getByRole('button', { name: 'Link to a central client' }));
    const dialog = await screen.findByRole('dialog', { name: 'Link to a central client' });
    await user.click(
      await within(dialog).findByRole('button', { name: `Link to ${northwind.name}` }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'This central client is already linked.',
    );
  });

  it('offers neither link nor unlink to a role that may not create clients', async () => {
    await openCentral({ permissions: STAFF_PERMISSIONS, clients: [linkedDetail] });
    const central = await findRegion('Central client');
    expect(central.queryByRole('button', { name: 'Unlink' })).toBeNull();
    expect(central.queryByRole('button', { name: 'Sync with central' })).toBeNull();
    expect(central.queryByRole('button', { name: 'Link to a central client' })).toBeNull();
    expect(central.getByText('cen-0001')).toBeInTheDocument();
  });
});

describe('DangerCard', () => {
  it('archives the client after a confirmation', async () => {
    const archived: string[] = [];
    const user = userEvent.setup();
    await openDanger({
      handlers: [
        http.post(orgApiPath('/clients/:clientId/archive'), ({ params }) => {
          archived.push(String(params.clientId));
          return ok({ ...techwaveDetail, status: 'archived' });
        }),
      ],
    });
    const danger = await findRegion('Danger zone');

    await user.click(danger.getByRole('button', { name: 'Archive client' }));
    const dialog = await screen.findByRole('dialog', { name: 'Archive client' });
    expect(archived).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));

    await waitFor(() => expect(archived).toEqual([techwave.id]));
    expect(await screen.findByText('Client archived')).toBeInTheDocument();
  });

  it('restores an archived client after a confirmation', async () => {
    const bodies: unknown[] = [];
    const user = userEvent.setup();
    await openDanger({
      clients: [{ ...techwaveDetail, status: 'archived' }],
      handlers: [patchClient(bodies)],
    });
    const danger = await findRegion('Danger zone');
    expect(danger.queryByRole('button', { name: 'Archive client' })).toBeNull();

    await user.click(danger.getByRole('button', { name: 'Restore client' }));
    const dialog = await screen.findByRole('dialog', { name: 'Restore client' });
    await user.click(within(dialog).getByRole('button', { name: 'Restore' }));

    await waitFor(() => expect(bodies).toEqual([{ status: 'active' }]));
  });

  it('is left out for a role without client.delete', async () => {
    await openDanger({
      permissions: OWNER_PERMISSIONS.filter((permission) => permission !== 'client.delete'),
    });
    await billingEmail();
    expect(screen.queryByRole('region', { name: 'Danger zone' })).toBeNull();
    expect(menuItem('Danger zone')).toBeNull();
  });
});

describe('the left menu of sections', () => {
  const sectionNames = () =>
    within(screen.getByRole('navigation', { name: 'Settings sections' }))
      .getAllByRole('link')
      .map((link) => link.textContent);

  it('lists the sections in order and starts on Billing', async () => {
    await openSettings();
    await billingEmail();

    expect(sectionNames()).toEqual([
      'Billing',
      'Team',
      'Services',
      'Rate overrides',
      'Central client',
      'Danger zone',
    ]);
    expect(menuItem('Billing')).toHaveAttribute('aria-current', 'page');
    expect(menuItem('Team')).not.toHaveAttribute('aria-current');
    // One section at a time: the others are not on the page.
    expect(screen.queryByRole('region', { name: 'Team' })).toBeNull();
  });

  it('shows the section that is picked and marks it as the current one', async () => {
    const user = userEvent.setup();
    await openSettings();
    await billingEmail();

    await user.click(menuLink('Team'));
    expect(await screen.findByRole('region', { name: 'Team' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Billing' })).toBeNull();
    expect(menuItem('Team')).toHaveAttribute('aria-current', 'page');
    expect(menuItem('Billing')).not.toHaveAttribute('aria-current');

    await user.click(menuLink('Billing'));
    expect(await billingEmail()).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Team' })).toBeNull();
    expect(menuItem('Billing')).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to Billing for a section it does not know', async () => {
    await openSettings({ section: 'nonsense' });
    await billingEmail();
    expect(menuItem('Billing')).toHaveAttribute('aria-current', 'page');
  });

  it('leaves out the rates and the danger zone for a role that may not see them', async () => {
    await openSettings({
      permissions: STAFF_PERMISSIONS,
      clients: [{ ...techwaveDetail, rates: null }],
    });
    await billingEmail();
    expect(sectionNames()).toEqual(['Billing', 'Team', 'Services', 'Central client']);
  });
});
