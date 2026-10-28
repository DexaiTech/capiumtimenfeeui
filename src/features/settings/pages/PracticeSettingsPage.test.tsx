import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { Organization } from '@/features/organizations';
import { expectRequiredFields } from '@/test/requiredFields';
import { fail, ok, server } from '@/test/server';

import { orgContext, staffRole, testOrganization } from '../test/fixtures';
import { orgPath } from '../test/handlers';
import { renderSettings } from '../test/render';
import PracticeSettingsPage from './PracticeSettingsPage';

type User = ReturnType<typeof userEvent.setup>;

function capturePatch(respond: (body: Partial<Organization>) => Organization) {
  const bodies: unknown[] = [];
  server.use(
    http.patch(orgPath(''), async ({ request }) => {
      const body = (await request.json()) as Partial<Organization>;
      bodies.push(body);
      return ok(respond(body));
    }),
  );
  return bodies;
}

const field = (name: string) => screen.getByRole('textbox', { name });

/** Practice Settings is one form; its sections are tabs. */
async function openTab(user: User, label: string) {
  await user.click(screen.getByRole('tab', { name: label }));
}

describe('PracticeSettingsPage', () => {
  it('points to General Settings for time recording instead of repeating it', () => {
    renderSettings(<PracticeSettingsPage />);

    expect(screen.getByText(/Time recording settings have moved to/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'General Settings' })).toHaveAttribute(
      'href',
      '/lovelace/settings/general',
    );
    expect(screen.queryByRole('combobox', { name: 'Time increment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Timesheet approval' })).not.toBeInTheDocument();
  });

  it('shows every setting, one tab at a time, with the rate in pounds and the currency read-only', async () => {
    const user = userEvent.setup();
    renderSettings(<PracticeSettingsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Practice' })).toBeInTheDocument();
    // Details is the default tab.
    expect(field('Practice name')).toHaveValue('Lovelace & Co');

    await openTab(user, 'Address');
    expect(field('Address line 1')).toHaveValue('1 High Street');
    expect(field('Postcode')).toHaveValue('EC1A 1AA');

    await openTab(user, 'Billing');
    expect(field('Default charge-out rate (£ per hour)')).toHaveValue('95.00');
    expect(field('Payment terms (days)')).toHaveValue('30');
    expect(field('VAT number')).toHaveValue('GB123456789');
    expect(field('Currency')).toHaveValue('GBP · British Pound (£)');
    expect(field('Currency')).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'VAT registered' })).toBeChecked();

    await openTab(user, 'Invoices');
    expect(field('Bank details')).toHaveValue('');
    expect(field('Invoice footer')).toHaveValue('');

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('sends only what changed, the rate as pence, across tabs', async () => {
    const bodies = capturePatch((body) => ({ ...testOrganization, ...body }));
    const user = userEvent.setup();
    renderSettings(<PracticeSettingsPage />);

    await openTab(user, 'Address');
    await user.clear(field('Address line 1'));

    await openTab(user, 'Billing');
    const rate = field('Default charge-out rate (£ per hour)');
    await user.clear(rate);
    await user.type(rate, '1,234.5');
    await user.clear(field('Payment terms (days)'));
    await user.type(field('Payment terms (days)'), '14');

    await openTab(user, 'Invoices');
    await user.type(field('Bank details'), 'Sort code 00-00-00');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Practice settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        address_line1: null,
        bank_details: 'Sort code 00-00-00',
        payment_terms_days: 14,
        default_charge_rate: 123450,
      },
    ]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled(),
    );
  });

  it('hides the VAT number when not VAT registered and sends the switch', async () => {
    const bodies = capturePatch((body) => ({ ...testOrganization, ...body }));
    const user = userEvent.setup();
    renderSettings(<PracticeSettingsPage />);
    await openTab(user, 'Billing');

    await user.click(screen.getByRole('switch', { name: 'VAT registered' }));
    expect(screen.queryByRole('textbox', { name: 'VAT number' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(bodies).toEqual([{ vat_registered: false }]));
  });

  it('validates money, days, email and country before sending anything', async () => {
    const bodies = capturePatch((body) => ({ ...testOrganization, ...body }));
    const user = userEvent.setup();
    renderSettings(<PracticeSettingsPage />);

    await user.clear(field('Email'));
    await user.type(field('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();

    await openTab(user, 'Address');
    await user.clear(field('Country'));
    await user.type(field('Country'), 'G1');

    await openTab(user, 'Billing');
    const rate = field('Default charge-out rate (£ per hour)');
    await user.clear(rate);
    await user.type(rate, '95.555');
    await user.clear(field('Payment terms (days)'));
    await user.type(field('Payment terms (days)'), '400');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Enter an hourly rate in pounds, for example 95.00'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter a number of days from 0 to 365')).toBeInTheDocument();
    await openTab(user, 'Address');
    expect(field('Country')).toHaveAttribute('aria-invalid', 'true');
    expect(bodies).toEqual([]);
  });

  it('puts 422 details on their fields, mapping the API names to the form', async () => {
    server.use(
      http.patch(orgPath(''), () =>
        fail(422, 'VALIDATION_ERROR', 'Invalid.', {
          details: [{ field: 'default_charge_rate', message: 'Too high for this practice.' }],
        }),
      ),
    );
    const user = userEvent.setup();
    renderSettings(<PracticeSettingsPage />);
    await openTab(user, 'Billing');

    const rate = field('Default charge-out rate (£ per hour)');
    await user.clear(rate);
    await user.type(rate, '9999');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Too high for this practice.')).toBeInTheDocument();
    expect(rate).toHaveAttribute('aria-invalid', 'true');
  });

  it('is read-only without organization.update', async () => {
    const user = userEvent.setup();
    renderSettings(<PracticeSettingsPage />, {
      context: orgContext({ role: staffRole, permissions: ['organization.read'] }),
    });
    const form = screen.getByRole('form', { name: 'Practice settings' });
    expect(within(form).getByRole('textbox', { name: 'Practice name' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete practice' })).not.toBeInTheDocument();

    await openTab(user, 'Billing');
    expect(within(form).getByRole('switch', { name: 'VAT registered' })).toBeDisabled();
  });

  it('offers no way to delete the practice, not even to an Owner', () => {
    renderSettings(<PracticeSettingsPage />);
    expect(screen.queryByRole('button', { name: 'Delete practice' })).not.toBeInTheDocument();
  });
});

describe('PracticeSettingsPage: mandatory fields', () => {
  it('stars the name, country, payment terms and default rate, not the optional ones', async () => {
    const user = userEvent.setup();
    renderSettings(<PracticeSettingsPage />);
    const form = screen.getByRole('form', { name: 'Practice settings' });

    expectRequiredFields(form, {
      required: ['Practice name'],
      optional: ['Company number', 'Email', 'Phone'],
    });
    await openTab(user, 'Address');
    expectRequiredFields(form, {
      required: ['Country'],
      optional: ['Address line 1', 'Address line 2', 'Town or city', 'Postcode'],
    });
    await openTab(user, 'Billing');
    expectRequiredFields(form, {
      required: [/^Default charge-out rate/, 'Payment terms (days)'],
    });
    await openTab(user, 'Invoices');
    expectRequiredFields(form, { required: [], optional: ['Bank details', 'Invoice footer'] });
  });
});
