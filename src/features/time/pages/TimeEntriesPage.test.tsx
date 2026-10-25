import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { ACME } from '../test/fixtures';
import { createBackend, timeHandlers } from '../test/handlers';
import TimeEntriesPage from './TimeEntriesPage';

describe('TimeEntriesPage: add entry', () => {
  it('starts from the client the list is filtered to', async () => {
    const user = userEvent.setup();
    server.use(...timeHandlers(createBackend()));
    renderInOrg(<TimeEntriesPage />, { route: `/acme/time/entries?client=${ACME.id}` });

    await user.click(await screen.findByRole('button', { name: 'Add entry' }));
    const form = await screen.findByRole('region', { name: 'Record time' });
    const client = within(form).getByRole('combobox', { name: 'Client' });
    await waitFor(() => expect((client as HTMLInputElement).value).toContain(ACME.name));
  });

  it('leaves the client empty when the list is not filtered', async () => {
    const user = userEvent.setup();
    server.use(...timeHandlers(createBackend()));
    renderInOrg(<TimeEntriesPage />, { route: '/acme/time/entries' });

    await user.click(await screen.findByRole('button', { name: 'Add entry' }));
    const form = await screen.findByRole('region', { name: 'Record time' });
    expect(within(form).getByRole('combobox', { name: 'Client' })).toHaveValue('');
  });
});
