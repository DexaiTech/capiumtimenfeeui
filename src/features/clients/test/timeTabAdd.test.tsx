import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ACME, entry } from '@/features/time/test/fixtures';
import { callsTo, createBackend, timeHandlers } from '@/features/time/test/handlers';
import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { TimeTab } from '../workspace/tabs/TimeTab';

function setup(permissions: string[] = OWNER_PERMISSIONS) {
  const backend = createBackend({
    entries: [entry({ id: 'first', entry_date: '2026-10-12', minutes: 60, job: null })],
  });
  // The client of the first entry, so the tab lists it.
  backend.entries = backend.entries.map((item) => ({
    ...item,
    client_id: ACME.id,
    client_code: ACME.code,
    client_name: ACME.name,
  }));
  server.use(...timeHandlers(backend));
  renderInOrg(<TimeTab clientId={ACME.id} clientName={ACME.name} overview={undefined} />, {
    context: contextWith(permissions),
  });
  return backend;
}

describe('TimeTab: add time', () => {
  it('opens the time panel for the client and shows the new entry once it is saved', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await screen.findByRole('row', { name: /1:00/ });

    await user.click(screen.getByRole('button', { name: 'Add time' }));
    const form = await screen.findByRole('region', { name: 'Record time' });
    const client = within(form).getByRole('combobox', { name: 'Client' });
    await waitFor(() => expect((client as HTMLInputElement).value).toContain(ACME.name));

    await user.type(within(form).getByLabelText(/^Time/), '2:30');
    await user.click(within(form).getByRole('button', { name: 'Record time' }));

    await waitFor(() => expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(1));
    expect(callsTo(backend, 'POST', '/time-entries')[0]?.body).toMatchObject({
      client_id: ACME.id,
      minutes: 150,
    });
    // The tab asks for the list again, so the new time is there without a reload.
    expect(await screen.findByRole('row', { name: /2:30/ })).toBeInTheDocument();
    expect(callsTo(backend, 'GET', '/time-entries').length).toBeGreaterThan(1);
  });

  it('is not offered to someone who cannot record time', async () => {
    setup(['organization.read', 'client.read', 'time.read_all']);
    await screen.findByRole('row', { name: /1:00/ });
    expect(screen.queryByRole('button', { name: 'Add time' })).not.toBeInTheDocument();
  });
});
