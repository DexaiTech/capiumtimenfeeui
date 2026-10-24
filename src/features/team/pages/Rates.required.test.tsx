import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { http } from 'msw';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields, isMarkedRequired } from '@/test/requiredFields';
import { server } from '@/test/server';

import { sam, samChargeRule, testCostRules } from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import CostRatesPage from './CostRatesPage';
import RatePreviewPage from './RatePreviewPage';
import StaffDetailPage from './StaffDetailPage';

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  server.use(
    ...teamHandlers(),
    http.get(orgApiPath('/audit-logs/history'), () => Response.json({ data: [] })),
  );
});

async function openRuleActions(user: User, subject: string) {
  const name = `Actions for the rate of ${subject}`;
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('menu', { name });
}

describe('mandatory fields of the rate dialogs', () => {
  it('marks the scope, the rate and the start of a new rate', async () => {
    const user = userEvent.setup();
    renderInOrg(<CostRatesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add rate' }));
    const dialog = await screen.findByRole('region', { name: 'Add cost rate' });
    expectRequiredFields(dialog, {
      required: ['Applies to', 'Rate per hour (£)', 'Effective from'],
      optional: ['Effective to'],
    });
    // Whatever the level needs is mandatory too.
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Applies to' }), 'Staff');
    expect(isMarkedRequired(within(dialog).getByRole('combobox', { name: 'Staff member' }))).toBe(
      true,
    );
  });

  it('marks the rate and the start of an edit, and the last day of an end-dating', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers({ rules: testCostRules }));
    renderInOrg(<CostRatesPage />);
    let menu = await openRuleActions(user, 'Sam Staff');
    await user.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    let dialog = await screen.findByRole('region', { name: 'Edit rate' });
    expectRequiredFields(dialog, {
      required: ['Rate per hour (£)', 'Effective from'],
      optional: ['Effective to'],
    });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    menu = await openRuleActions(user, 'Sam Staff');
    await user.click(within(menu).getByRole('menuitem', { name: 'End-date' }));
    dialog = await screen.findByRole('dialog', { name: 'End-date rate' });
    expectRequiredFields(dialog, { required: ['Last day of the rate'] });
  });

  it('marks the rate and the start of a staff member rate', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers({ rules: [samChargeRule] }));
    renderInOrg(
      <Routes>
        <Route path="/acme/team/staff/:staffId" element={<StaffDetailPage />} />
      </Routes>,
      { context: contextWith(OWNER_PERMISSIONS), route: `/acme/team/staff/${sam.id}` },
    );
    await user.click(await screen.findByRole('button', { name: 'Set charge-out rate' }));
    const dialog = await screen.findByRole('region', { name: /new charge-out/i });
    expectRequiredFields(dialog, { required: ['Rate (£ per hour)', 'Starts on'] });
  });

  it('marks the staff member of the rate preview, not the date or the optional filters', async () => {
    renderInOrg(<RatePreviewPage />);
    await screen.findByRole('combobox', { name: 'Staff member' });
    expect(isMarkedRequired(screen.getByRole('combobox', { name: 'Staff member' }))).toBe(true);
    expectRequiredFields(document.body, { required: [], optional: ['Date', 'Service'] });
    expect(isMarkedRequired(screen.getByRole('combobox', { name: 'Client' }))).toBe(false);
  });
});
