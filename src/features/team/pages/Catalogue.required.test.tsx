import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { server } from '@/test/server';

import { teamHandlers } from '../test/handlers';
import ActivityTypesPage from './ActivityTypesPage';
import GradesPage from './GradesPage';
import ServicesPage from './ServicesPage';

beforeEach(() => {
  server.use(...teamHandlers());
});

describe('mandatory fields of the catalogue dialogs', () => {
  it('marks the name and the code of a grade, not the rates or the target', async () => {
    const user = userEvent.setup();
    renderInOrg(<GradesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add grade' }));
    const dialog = await screen.findByRole('region', { name: 'Add grade' });
    expectRequiredFields(dialog, {
      required: ['Name', 'Code'],
      optional: [
        'Description',
        'Default charge-out rate (£ per hour)',
        'Default chargeable target (%)',
        'Sort order',
      ],
    });
  });

  it('marks the name and the code of a service', async () => {
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add service' }));
    const dialog = await screen.findByRole('region', { name: 'Add service' });
    await within(dialog).findByRole('checkbox', { name: /Bookkeeping/ });
    expectRequiredFields(dialog, {
      required: ['Name', 'Code'],
      optional: [
        'Description',
        'Billing basis',
        'Default fee (£)',
        'VAT code',
        'Invoice description',
      ],
    });
  });

  it('marks the title of a default task of a service, not its hours, due days or description', async () => {
    const user = userEvent.setup();
    renderInOrg(<ServicesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add service' }));
    const dialog = await screen.findByRole('region', { name: 'Add service' });
    await within(dialog).findByRole('checkbox', { name: /Bookkeeping/ });
    await user.click(within(dialog).getByRole('button', { name: 'Add task' }));
    expectRequiredFields(within(dialog).getByRole('group', { name: 'Default task 1' }), {
      required: ['Title'],
      optional: ['Hours budget', 'Due (days after the job starts)', 'Description'],
    });
  });

  it('marks the name and the code of an activity type', async () => {
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add activity type' }));
    const dialog = await screen.findByRole('region', { name: 'Add activity type' });
    await within(dialog).findByRole('option', { name: /Standard 20%/ });
    expectRequiredFields(dialog, {
      required: ['Name', 'Code'],
      optional: ['VAT code', 'Invoice description'],
    });
  });
});
