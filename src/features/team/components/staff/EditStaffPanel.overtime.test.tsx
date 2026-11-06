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

// APT81 retired the per-staff multiplier: overtime rates (Team & Rates → Overtime Rates) and
// working hours (the staff page) replace it.
describe('EditStaffPanel: overtime', () => {
  it('has no overtime multiplier field, with overtime off or on', async () => {
    const off = await openPanel({ ...sam, overtime_multiplier_bp: 20000 });
    expect(within(off).queryByRole('textbox', { name: LABEL })).not.toBeInTheDocument();
    expect(within(off).getByRole('textbox', { name: 'Chargeable target (%)' })).toBeVisible();
  });

  it('has no overtime multiplier field while the practice has overtime on', async () => {
    const dialog = await openPanel({ ...sam, overtime_multiplier_bp: 20000 }, withOvertime);

    expect(within(dialog).queryByRole('textbox', { name: LABEL })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/times the normal rate/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Chargeable target (%)' })).toBeVisible();
  });

  it('never sends the retired multiplier, even for a person who has one stored', async () => {
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/staff/${sam.id}`), async ({ request }) => {
        body = await request.json();
        return ok(detailOf({ ...sam, chargeable_target_bp: 7500 }));
      }),
    );
    const user = userEvent.setup();
    const dialog = await openPanel({ ...sam, overtime_multiplier_bp: 18000 }, withOvertime);

    const target = within(dialog).getByRole('textbox', { name: 'Chargeable target (%)' });
    await user.clear(target);
    await user.type(target, '75');
    await user.click(within(dialog).getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Details of Sam Staff saved')).toBeInTheDocument();
    expect(body).toEqual({ chargeable_target_bp: 7500 });
  });
});
