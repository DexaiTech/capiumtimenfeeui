import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import type { Organization } from '@/features/organizations';
import { ok, server } from '@/test/server';

import { orgContext, testOrganization } from '../test/fixtures';
import { orgPath } from '../test/handlers';
import { renderSettings } from '../test/render';
import GeneralSettingsPage from './GeneralSettingsPage';

function capturePatch() {
  const bodies: unknown[] = [];
  server.use(
    http.patch(orgPath(''), async ({ request }) => {
      const body = (await request.json()) as Partial<Organization>;
      bodies.push(body);
      return ok({ ...testOrganization, ...body });
    }),
  );
  return bodies;
}

async function openRates(organization: Partial<Organization> = {}) {
  const user = userEvent.setup();
  renderSettings(<GeneralSettingsPage />, {
    context: { ...orgContext(), organization: { ...testOrganization, ...organization } },
  });
  await user.click(screen.getByRole('tab', { name: 'Rates' }));
  return { user, rates: within(screen.getByRole('form', { name: 'Rates' })) };
}

describe('General settings: overtime', () => {
  it('is off by default, at one and a half times, with the multiplier waiting', async () => {
    const { rates } = await openRates();

    expect(rates.getByRole('switch', { name: 'Overtime' })).not.toBeChecked();
    const multiplier = rates.getByRole('textbox', {
      name: 'Overtime rate (times the normal rate)',
    });
    expect(multiplier).toHaveValue('1.5');
    expect(multiplier).toBeDisabled();
    expect(rates.getByRole('button', { name: 'Save rate settings' })).toBeDisabled();
  });

  it('switches overtime on and sends only that', async () => {
    const bodies = capturePatch();
    const { user, rates } = await openRates();

    await user.click(rates.getByRole('switch', { name: 'Overtime' }));
    expect(
      rates.getByRole('textbox', { name: 'Overtime rate (times the normal rate)' }),
    ).toBeEnabled();
    await user.click(rates.getByRole('button', { name: 'Save rate settings' }));

    expect(await screen.findByText('Rate settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ overtime_enabled: true }]);
  });

  it('sets the multiplier in basis points', async () => {
    const bodies = capturePatch();
    const { user, rates } = await openRates({ overtime_enabled: true });

    const multiplier = rates.getByRole('textbox', {
      name: 'Overtime rate (times the normal rate)',
    });
    await user.clear(multiplier);
    await user.type(multiplier, '2');
    await user.click(rates.getByRole('button', { name: 'Save rate settings' }));

    expect(await screen.findByText('Rate settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ overtime_multiplier_bp: 20000 }]);
  });

  it('refuses a multiplier that is not from 1 to 10, without asking the API', async () => {
    const bodies = capturePatch();
    const { user, rates } = await openRates({ overtime_enabled: true });

    const multiplier = rates.getByRole('textbox', {
      name: 'Overtime rate (times the normal rate)',
    });
    await user.clear(multiplier);
    await user.type(multiplier, '0.5');
    await user.click(rates.getByRole('button', { name: 'Save rate settings' }));

    expect(
      await rates.findByText('Enter a multiple of the normal rate from 1 to 10, for example 1.5'),
    ).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });
});
