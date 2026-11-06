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

// APT81 retired the multiplier: overtime is a cost only, priced by Team & Rates → Overtime Rates.
describe('General settings: overtime', () => {
  it('is off by default and says overtime is a cost that never changes what clients pay', async () => {
    const { rates } = await openRates();

    const overtime = rates.getByRole('switch', { name: 'Overtime' });
    expect(overtime).not.toBeChecked();
    expect(
      rates.getByText(
        "On: hours beyond a person's standard hours are overtime: staff confirm them when recording, approvers approve them, and their cost is shown on the Staff Cost report. Overtime never changes what clients are charged.",
      ),
    ).toBeInTheDocument();
    expect(rates.queryByText(/charged and costed/)).not.toBeInTheDocument();
    expect(rates.getByRole('button', { name: 'Save rate settings' })).toBeDisabled();
  });

  it('has no multiplier field any more, and points to the Overtime Rates page', async () => {
    const { rates } = await openRates({ overtime_enabled: true, overtime_multiplier_bp: 20000 });

    expect(
      rates.queryByRole('textbox', { name: 'Overtime rate (times the normal rate)' }),
    ).not.toBeInTheDocument();
    expect(rates.queryByText(/times the normal rate/)).not.toBeInTheDocument();
    expect(rates.getByRole('link', { name: 'Team & Rates → Overtime Rates' })).toHaveAttribute(
      'href',
      `/${testOrganization.slug}/team/overtime-rates`,
    );
  });

  it('switches overtime on and sends only that, never a multiplier', async () => {
    const bodies = capturePatch();
    const { user, rates } = await openRates();

    await user.click(rates.getByRole('switch', { name: 'Overtime' }));
    await user.click(rates.getByRole('button', { name: 'Save rate settings' }));

    expect(await screen.findByText('Rate settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ overtime_enabled: true }]);
  });

  it('switches overtime off again', async () => {
    const bodies = capturePatch();
    const { user, rates } = await openRates({ overtime_enabled: true });

    await user.click(rates.getByRole('switch', { name: 'Overtime' }));
    await user.click(rates.getByRole('button', { name: 'Save rate settings' }));

    expect(await screen.findByText('Rate settings saved')).toBeInTheDocument();
    expect(bodies).toEqual([{ overtime_enabled: false }]);
  });
});
