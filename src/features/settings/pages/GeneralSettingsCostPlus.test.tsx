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

const LABEL = 'Cost-plus mark-up (%)';

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

async function openRates() {
  const user = userEvent.setup();
  renderSettings(<GeneralSettingsPage />, { context: orgContext() });
  await user.click(screen.getByRole('tab', { name: 'Rates' }));
  return { user, rates: within(screen.getByRole('form', { name: 'Rates' })) };
}

describe('General settings: the cost-plus mark-up of the recovery analysis', () => {
  it('starts at 50%', async () => {
    const { rates } = await openRates();
    expect(rates.getByRole('textbox', { name: LABEL })).toHaveValue('50');
  });

  it('is sent in basis points', async () => {
    const bodies = capturePatch();
    const { user, rates } = await openRates();

    const markup = rates.getByRole('textbox', { name: LABEL });
    await user.clear(markup);
    await user.type(markup, '75');
    await user.click(rates.getByRole('button', { name: 'Save rate settings' }));

    expect(await screen.findByText('Rate settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ cost_plus_markup_bp: 7500 }]);
  });

  it('refuses what is not a percentage, without asking the API', async () => {
    const bodies = capturePatch();
    const { user, rates } = await openRates();

    const markup = rates.getByRole('textbox', { name: LABEL });
    await user.clear(markup);
    await user.type(markup, 'lots');
    await user.click(rates.getByRole('button', { name: 'Save rate settings' }));

    expect(
      await rates.findByText(
        'Enter a percentage from 0 to 1000 with at most two decimals, for example 50',
      ),
    ).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });
});

describe('General settings: the recovery rate priority', () => {
  it('lists the client job-specific rate, then the task rate, then the staff rate by default', async () => {
    const { rates } = await openRates();
    expect(rates.getByRole('combobox', { name: '1st rate' })).toHaveValue('client_job');
    expect(rates.getByRole('combobox', { name: '2nd rate' })).toHaveValue('task');
    expect(rates.getByRole('combobox', { name: '3rd rate' })).toHaveValue('staff');
    expect(
      rates.getByText(
        /Client job-specific rate, then task-specific rate, then staff charge-out rate/,
      ),
    ).toBeInTheDocument();
  });

  it('sends the order the practice chooses', async () => {
    const bodies = capturePatch();
    const { user, rates } = await openRates();

    await user.selectOptions(rates.getByRole('combobox', { name: '1st rate' }), 'task');
    await user.selectOptions(rates.getByRole('combobox', { name: '2nd rate' }), 'client_job');
    await user.click(rates.getByRole('button', { name: 'Save rate settings' }));

    expect(await screen.findByText('Rate settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ recovery_rate_order: ['task', 'client_job', 'staff'] }]);
  });

  it('refuses a rate chosen twice, without asking the API', async () => {
    const bodies = capturePatch();
    const { user, rates } = await openRates();

    await user.selectOptions(rates.getByRole('combobox', { name: '1st rate' }), 'staff');
    await user.click(rates.getByRole('button', { name: 'Save rate settings' }));

    expect(
      (await rates.findAllByText('Each rate can come once only: choose another rate')).length,
    ).toBeGreaterThan(0);
    expect(bodies).toEqual([]);
  });
});
