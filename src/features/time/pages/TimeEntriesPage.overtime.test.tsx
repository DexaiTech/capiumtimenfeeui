import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ownerContext } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { ACME, entry, TODAY } from '../test/fixtures';
import { createBackend, timeHandlers } from '../test/handlers';
import TimeEntriesPage from './TimeEntriesPage';

const RANGE = '/acme/time/entries?from=2026-10-12&to=2026-10-18';

const withOvertime = {
  ...ownerContext,
  organization: { ...ownerContext.organization, overtime_enabled: true },
};

function backendWithOvertime() {
  const backend = createBackend();
  backend.entries = [
    { ...entry({ entry_date: TODAY, minutes: 60, client: ACME }), is_overtime: true },
  ];
  return backend;
}

describe('TimeEntriesPage: overtime', () => {
  it('shows an Overtime column, marking the entries that are overtime', async () => {
    server.use(...timeHandlers(backendWithOvertime()));
    renderInOrg(<TimeEntriesPage />, { route: RANGE, context: withOvertime });

    const table = await screen.findByRole('table', { name: 'Time entries' });
    await waitFor(() => expect(table).not.toHaveAttribute('aria-busy', 'true'));
    expect(within(table).getByRole('columnheader', { name: 'Overtime' })).toBeInTheDocument();
    const [row] = within(table).getAllByRole('row').slice(1);
    expect(row).toHaveTextContent('Overtime');
  });

  it('has no Overtime column while the practice has overtime off', async () => {
    server.use(...timeHandlers(backendWithOvertime()));
    renderInOrg(<TimeEntriesPage />, { route: RANGE });

    const table = await screen.findByRole('table', { name: 'Time entries' });
    await waitFor(() => expect(table).not.toHaveAttribute('aria-busy', 'true'));
    expect(within(table).queryByRole('columnheader', { name: 'Overtime' })).not.toBeInTheDocument();
    expect(within(table).queryByText('Overtime')).not.toBeInTheDocument();
  });
});
