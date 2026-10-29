import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { findRowAction } from '@/test/rowActions';
import { server } from '@/test/server';

import { ACME, entry, SAM } from '../test/fixtures';
import { callsTo, createBackend, timeHandlers } from '../test/handlers';
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

function Where() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

describe('TimeEntriesPage: bill the selected time', () => {
  const RANGE = '/acme/time/entries?from=2026-10-12&to=2026-10-18';

  it('creates an invoice from the entries ticked', async () => {
    const user = userEvent.setup();
    server.use(...timeHandlers(createBackend()));
    renderInOrg(
      <>
        <TimeEntriesPage />
        <Where />
      </>,
      { route: RANGE, context: contextWith(OWNER_PERMISSIONS) },
    );

    const table = await screen.findByRole('table', { name: 'Time entries' });
    await waitFor(() => expect(table).not.toHaveAttribute('aria-busy', 'true'));
    const boxes = within(table).getAllByRole('checkbox', { name: /^Select the entry of/ });
    await user.click(boxes[0] as HTMLElement);
    await user.click(boxes[1] as HTMLElement);

    const bar = screen.getByRole('region', { name: 'Bill the selected time' });
    expect(bar).toHaveTextContent('2 selected');
    await user.click(within(bar).getByRole('button', { name: 'Create invoice' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/billing/prepare?client='),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('time=');
  });

  it('is not offered to someone who cannot create invoices', async () => {
    server.use(...timeHandlers(createBackend()));
    renderInOrg(<TimeEntriesPage />, {
      route: RANGE,
      context: contextWith(['organization.read', 'time.log']),
    });

    const table = await screen.findByRole('table', { name: 'Time entries' });
    await waitFor(() => expect(table).not.toHaveAttribute('aria-busy', 'true'));
    expect(within(table).queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('TimeEntriesPage: revoke approval', () => {
  const RANGE = '/acme/time/entries?from=2026-10-12&to=2026-10-18';
  const APPROVED = /^Actions for the entry of 12\/10\/2026/;

  function setup(permissions: string[]) {
    const backend = createBackend({
      entries: [
        entry({
          id: 'sam-1',
          user_id: SAM,
          entry_date: '2026-10-12',
          minutes: 60,
          status: 'approved',
        }),
      ],
    });
    server.use(...timeHandlers(backend));
    renderInOrg(<TimeEntriesPage />, { route: RANGE, context: contextWith(permissions) });
    return backend;
  }

  it('reopens the week of approved time so it can be deleted', async () => {
    const user = userEvent.setup();
    const backend = setup(['organization.read', 'time.read_all', 'timesheet.approve']);

    await user.click(await findRowAction(APPROVED, 'Revoke approval'));
    const dialog = await screen.findByRole('dialog', { name: 'Revoke approval of this week?' });
    await user.click(within(dialog).getByRole('button', { name: 'Revoke approval' }));

    await waitFor(() =>
      expect(
        callsTo(backend, 'POST', `/timesheets/${backend.sheets[0]?.id ?? ''}/reopen`),
      ).toHaveLength(1),
    );
    expect(await screen.findByText('Approval revoked')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Revoke approval' })).toBeNull(),
    );
  });

  it('is not offered without timesheet.approve', async () => {
    setup(['organization.read', 'time.read_all', 'time.manage_all']);

    await screen.findByRole('group', { name: APPROVED });
    expect(screen.queryByRole('button', { name: 'Revoke approval' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete entry' })).not.toBeInTheDocument();
  });
});
