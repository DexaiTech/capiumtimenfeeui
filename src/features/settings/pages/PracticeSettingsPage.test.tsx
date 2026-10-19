import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { Organization } from '@/features/organizations';
import { fail, ok, server } from '@/test/server';

import { orgContext, staffRole, testOrganization } from '../test/fixtures';
import { orgPath } from '../test/handlers';
import { renderSettings } from '../test/render';
import PracticeSettingsPage from './PracticeSettingsPage';

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

describe('PracticeSettingsPage', () => {
  it('shows every setting, with the rate in pounds and the currency read-only', () => {
    renderSettings(<PracticeSettingsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Practice' })).toBeInTheDocument();
    expect(field('Practice name')).toHaveValue('Lovelace & Co');
    expect(field('Default charge-out rate (£ per hour)')).toHaveValue('95.00');
    expect(field('Payment terms (days)')).toHaveValue('30');
    expect(field('VAT number')).toHaveValue('GB123456789');
    expect(field('Currency')).toHaveValue('GBP · British Pound (£)');
    expect(field('Currency')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Time increment' })).toHaveValue('6');
    expect(screen.getByRole('switch', { name: 'VAT registered' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Timesheet approval' })).not.toBeChecked();
    expect(field('Address line 1')).toHaveValue('1 High Street');
    expect(field('Postcode')).toHaveValue('EC1A 1AA');
    expect(field('Bank details')).toHaveValue('');
    expect(field('Invoice footer')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('sends only what changed, the rate as pence and the increment as a number', async () => {
    const bodies = capturePatch((body) => ({ ...testOrganization, ...body }));
    const user = userEvent.setup();
    renderSettings(<PracticeSettingsPage />);

    const rate = field('Default charge-out rate (£ per hour)');
    await user.clear(rate);
    await user.type(rate, '1,234.5');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time increment' }), '15');
    await user.click(screen.getByRole('switch', { name: 'Timesheet approval' }));
    await user.clear(field('Payment terms (days)'));
    await user.type(field('Payment terms (days)'), '14');
    await user.type(field('Bank details'), 'Sort code 00-00-00');
    await user.clear(field('Address line 1'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Practice settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        address_line1: null,
        bank_details: 'Sort code 00-00-00',
        payment_terms_days: 14,
        default_charge_rate: 123450,
        time_increment_minutes: 15,
        require_timesheet_approval: true,
      },
    ]);
    // The saved values become the new baseline.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled(),
    );
  });

  it('hides the VAT number when not VAT registered and sends the switch', async () => {
    const bodies = capturePatch((body) => ({ ...testOrganization, ...body }));
    const user = userEvent.setup();
    renderSettings(<PracticeSettingsPage />);

    await user.click(screen.getByRole('switch', { name: 'VAT registered' }));
    expect(screen.queryByRole('textbox', { name: 'VAT number' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(bodies).toEqual([{ vat_registered: false }]));
  });

  it('validates money, days, email and country before sending anything', async () => {
    const bodies = capturePatch((body) => ({ ...testOrganization, ...body }));
    const user = userEvent.setup();
    renderSettings(<PracticeSettingsPage />);

    const rate = field('Default charge-out rate (£ per hour)');
    await user.clear(rate);
    await user.type(rate, '95.555');
    await user.clear(field('Payment terms (days)'));
    await user.type(field('Payment terms (days)'), '400');
    await user.clear(field('Email'));
    await user.type(field('Email'), 'not-an-email');
    await user.clear(field('Country'));
    await user.type(field('Country'), 'G1');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Enter an hourly rate in pounds, for example 95.00'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter a number of days from 0 to 365')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
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

    const rate = field('Default charge-out rate (£ per hour)');
    await user.clear(rate);
    await user.type(rate, '9999');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Too high for this practice.')).toBeInTheDocument();
    expect(rate).toHaveAttribute('aria-invalid', 'true');
  });

  it('is read-only without organization.update', () => {
    renderSettings(<PracticeSettingsPage />, {
      context: orgContext({ role: staffRole, permissions: ['organization.read'] }),
    });
    const form = screen.getByRole('form', { name: 'Practice settings' });
    expect(within(form).getByRole('textbox', { name: 'Practice name' })).toBeDisabled();
    expect(within(form).getByRole('switch', { name: 'VAT registered' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete practice' })).not.toBeInTheDocument();
  });

  it('offers deleting the practice to an Owner', () => {
    renderSettings(<PracticeSettingsPage />);
    expect(screen.getByRole('button', { name: 'Delete practice' })).toBeInTheDocument();
  });
});
