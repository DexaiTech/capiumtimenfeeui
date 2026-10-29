import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ownerContext } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { callsTo, createBackend, timeHandlers } from '../test/handlers';
import { entry, TODAY } from '../test/fixtures';
import { EntryPanel } from './EntryPanel';

const withOvertime = {
  ...ownerContext,
  organization: {
    ...ownerContext.organization,
    overtime_enabled: true,
    overtime_multiplier_bp: 15000,
  },
};

describe('EntryPanel: overtime', () => {
  it('is not offered while the practice has overtime off', async () => {
    server.use(...timeHandlers(createBackend()));
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />);
    const form = await screen.findByRole('region', { name: 'Record time' });

    expect(within(form).getByRole('checkbox', { name: /^Billable/ })).toBeInTheDocument();
    expect(within(form).queryByRole('checkbox', { name: /^Overtime/ })).not.toBeInTheDocument();
  });

  it('marks new time as overtime and says what that does to the rate', async () => {
    const user = userEvent.setup();
    const backend = createBackend();
    server.use(...timeHandlers(backend));
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />, {
      context: withOvertime,
    });
    const form = await screen.findByRole('region', { name: 'Record time' });

    const box = within(form).getByRole('checkbox', { name: /^Overtime/ });
    expect(box).not.toBeChecked();
    expect(form).toHaveTextContent('1.5× the normal rate');
    await user.type(within(form).getByLabelText(/^Time/), '2:00');
    await user.click(box);
    await user.click(within(form).getByRole('button', { name: 'Record time' }));

    await waitFor(() => expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(1));
    expect(callsTo(backend, 'POST', '/time-entries')[0]?.body).toMatchObject({
      minutes: 120,
      is_overtime: true,
    });
  });

  it('sends nothing about overtime for ordinary time', async () => {
    const user = userEvent.setup();
    const backend = createBackend();
    server.use(...timeHandlers(backend));
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />, {
      context: withOvertime,
    });
    const form = await screen.findByRole('region', { name: 'Record time' });

    await user.type(within(form).getByLabelText(/^Time/), '1:00');
    await user.click(within(form).getByRole('button', { name: 'Record time' }));

    await waitFor(() => expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(1));
    expect(callsTo(backend, 'POST', '/time-entries')[0]?.body).not.toHaveProperty('is_overtime');
  });

  it('shows the mark of an entry, and clears it', async () => {
    const user = userEvent.setup();
    const backend = createBackend();
    server.use(...timeHandlers(backend));
    const marked = { ...entry({ entry_date: TODAY, minutes: 60 }), is_overtime: true };
    backend.entries.push(marked);
    renderInOrg(<EntryPanel open entry={marked} onClose={() => undefined} />, {
      context: withOvertime,
    });
    const form = await screen.findByRole('region', { name: /entry|Edit/i });

    const box = within(form).getByRole('checkbox', { name: /^Overtime/ });
    expect(box).toBeChecked();
    const save = within(form).getByRole('button', { name: 'Save entry' });
    expect(save).toBeDisabled();
    await user.click(box);
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() =>
      expect(callsTo(backend, 'PATCH', `/time-entries/${marked.id}`)).toHaveLength(1),
    );
    expect(callsTo(backend, 'PATCH', `/time-entries/${marked.id}`)[0]?.body).toEqual({
      is_overtime: false,
    });
  });

  it('is left out of a correction of approved time', async () => {
    server.use(...timeHandlers(createBackend()));
    renderInOrg(
      <EntryPanel
        open
        correction
        entry={{ ...entry({ entry_date: TODAY, minutes: 60 }), is_overtime: true }}
        onClose={() => undefined}
      />,
      { context: withOvertime },
    );
    const form = await screen.findByRole('region', { name: 'Correct approved time' });

    expect(within(form).queryByRole('checkbox', { name: /^Overtime/ })).not.toBeInTheDocument();
  });
});
