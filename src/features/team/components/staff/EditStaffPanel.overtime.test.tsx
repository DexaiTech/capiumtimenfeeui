import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { ownerContext } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import { detailOf, sam } from '../../test/fixtures';
import { orgApiPath, teamHandlers } from '../../test/handlers';
import { EditStaffPanel } from './EditStaffPanel';

const withOvertime = {
  ...ownerContext,
  organization: { ...ownerContext.organization, overtime_enabled: true },
};

const LABEL = 'Overtime rate (times the normal rate)';

async function openPanel(person = sam, context = ownerContext) {
  renderInOrg(<EditStaffPanel staff={person} onClose={() => undefined} />, { context });
  const dialog = await screen.findByRole('region', { name: 'Edit staff member' });
  await within(dialog).findByRole('combobox', { name: 'Grade' });
  return dialog;
}

beforeEach(() => {
  server.use(...teamHandlers());
});

describe('EditStaffPanel: overtime', () => {
  it('has no overtime field while the practice has overtime off', async () => {
    const dialog = await openPanel({ ...sam, overtime_multiplier_bp: 20000 });

    expect(within(dialog).queryByRole('textbox', { name: LABEL })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Chargeable target (%)' })).toBeVisible();
  });

  it('offers the practice rate until the person has their own', async () => {
    const dialog = await openPanel(sam, withOvertime);

    const field = within(dialog).getByRole('textbox', { name: LABEL });
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', 'Practice rate, 1.5×');
  });

  it('sets their own multiplier in basis points', async () => {
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/staff/${sam.id}`), async ({ request }) => {
        body = await request.json();
        return ok(detailOf({ ...sam, overtime_multiplier_bp: 20000 }));
      }),
    );
    const user = userEvent.setup();
    const dialog = await openPanel(sam, withOvertime);

    await user.type(within(dialog).getByRole('textbox', { name: LABEL }), '2');
    await user.click(within(dialog).getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Details of Sam Staff saved')).toBeInTheDocument();
    expect(body).toEqual({ overtime_multiplier_bp: 20000 });
  });

  it('clears it, so the practice rate applies again', async () => {
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/staff/${sam.id}`), async ({ request }) => {
        body = await request.json();
        return ok(detailOf({ ...sam, overtime_multiplier_bp: null }));
      }),
    );
    const user = userEvent.setup();
    const dialog = await openPanel({ ...sam, overtime_multiplier_bp: 18000 }, withOvertime);

    const field = within(dialog).getByRole('textbox', { name: LABEL });
    expect(field).toHaveValue('1.8');
    await user.clear(field);
    await user.click(within(dialog).getByRole('button', { name: 'Save details' }));

    await screen.findByText('Details of Sam Staff saved');
    expect(body).toEqual({ overtime_multiplier_bp: null });
  });

  it('refuses a multiplier that is not from 1 to 10, without asking the API', async () => {
    let asked = false;
    server.use(
      http.patch(orgApiPath(`/staff/${sam.id}`), () => {
        asked = true;
        return ok(detailOf(sam));
      }),
    );
    const user = userEvent.setup();
    const dialog = await openPanel(sam, withOvertime);

    await user.type(within(dialog).getByRole('textbox', { name: LABEL }), '0.5');
    await user.click(within(dialog).getByRole('button', { name: 'Save details' }));

    expect(
      await within(dialog).findByText(
        'Enter a multiple of the normal rate from 1 to 10, for example 1.5, or leave it empty',
      ),
    ).toBeInTheDocument();
    expect(asked).toBe(false);
  });
});
