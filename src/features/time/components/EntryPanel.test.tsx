import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, server } from '@/test/server';

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

  it.each([
    ['approved', 'Ask a manager to reopen the week'],
    ['submitted', 'Recall the timesheet to change it'],
  ])('says what to do when the week is %s', async (sheetStatus, advice) => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/time-entries'), () =>
        fail(
          409,
          'TIME_LOCKED',
          `The timesheet for the week of 2026-10-19 is ${sheetStatus}; its time cannot be changed.`,
          { details: { timesheet_id: 'ts-1', timesheet_status: sheetStatus } },
        ),
      ),
      ...timeHandlers(createBackend()).filter(
        (handler) =>
          !(handler.info.method === 'POST' && String(handler.info.path).endsWith('/time-entries')),
      ),
    );
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />);
    const form = await screen.findByRole('region', { name: 'Record time' });
    await user.type(within(form).getByLabelText(/^Time/), '1:30');
    await user.click(within(form).getByRole('button', { name: 'Record time' }));
    expect(await within(form).findByText(new RegExp(advice))).toBeInTheDocument();
    expect(within(form).getByText(/its time cannot be changed/)).toBeInTheDocument();
  });
});
