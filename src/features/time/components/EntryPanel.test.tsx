import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { createBackend, timeHandlers } from '../test/handlers';
import { entry, TODAY } from '../test/fixtures';
import { EntryPanel } from './EntryPanel';

describe('EntryPanel: save and add another', () => {
  it('records the entry, keeps the day and empties the time for the next one', async () => {
    const user = userEvent.setup();
    const backend = createBackend();
    server.use(...timeHandlers(backend));
    const before = backend.entries.length;
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />);
    const form = await screen.findByRole('region', { name: 'Record time' });

    await user.type(within(form).getByLabelText(/^Time/), '1:30');
    await user.type(within(form).getByLabelText('Description'), 'Year-end call');
    await user.click(within(form).getByRole('button', { name: 'Save and add another' }));

    await waitFor(() => expect(backend.entries).toHaveLength(before + 1));
    await waitFor(() => expect(within(form).getByLabelText(/^Time/)).toHaveValue(''));
    expect(within(form).getByLabelText('Description')).toHaveValue('');
    expect(within(form).getByLabelText(/^Date/)).toHaveValue(TODAY);
    expect(screen.getByRole('region', { name: 'Record time' })).toBeInTheDocument();
  });

  it('is not offered when an entry is being edited', async () => {
    server.use(...timeHandlers(createBackend()));
    renderInOrg(
      <EntryPanel
        open
        entry={entry({ entry_date: TODAY, minutes: 60 })}
        onClose={() => undefined}
      />,
    );
    await screen.findByRole('region', { name: /entry|Edit/i });
    expect(screen.queryByRole('button', { name: 'Save and add another' })).not.toBeInTheDocument();
  });
});
