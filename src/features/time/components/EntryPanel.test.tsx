import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@/constants/permissions';
import { ClientPicker } from '@/features/team';
import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, server } from '@/test/server';

import { callsTo, createBackend, timeHandlers } from '../test/handlers';
import { ACCOUNTS_JOB, ACME, ADMIN_JOB, entry, INTERNAL, TODAY } from '../test/fixtures';
import { EntryPanel } from './EntryPanel';

describe('EntryPanel: save and add another', () => {
  it('records the entry, keeps the day and empties the time for the next one', async () => {
    const user = userEvent.setup();
    const backend = createBackend();
    server.use(...timeHandlers(backend));
    const before = backend.entries.length;
    renderInOrg(
      <EntryPanel open onClose={() => undefined} defaults={{ date: TODAY, job: ACCOUNTS_JOB }} />,
    );
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
    renderInOrg(
      <EntryPanel open onClose={() => undefined} defaults={{ date: TODAY, job: ACCOUNTS_JOB }} />,
    );
    const form = await screen.findByRole('region', { name: 'Record time' });
    await user.type(within(form).getByLabelText(/^Time/), '1:30');
    await user.click(within(form).getByRole('button', { name: 'Record time' }));
    expect(await within(form).findByText(new RegExp(advice))).toBeInTheDocument();
    expect(within(form).getByText(/its time cannot be changed/)).toBeInTheDocument();
  });
});

describe('EntryPanel: a client and a job are required (APT64)', () => {
  it('does not record time without a client and a job, billable or not', async () => {
    const user = userEvent.setup();
    const backend = createBackend();
    server.use(...timeHandlers(backend));
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />);
    const form = await screen.findByRole('region', { name: 'Record time' });
    expect(form).not.toHaveTextContent('internal time)');

    await user.type(within(form).getByLabelText(/^Time/), '10:00');
    await user.click(within(form).getByRole('checkbox', { name: /^Billable/ }));
    await user.click(within(form).getByRole('button', { name: 'Record time' }));

    expect(await within(form).findByText('Choose a client')).toBeInTheDocument();
    expect(within(form).getByText('Choose a job')).toBeInTheDocument();
    expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(0);
  });

  it('records the time once a job is chosen, with its client', async () => {
    const user = userEvent.setup();
    const backend = createBackend();
    server.use(...timeHandlers(backend));
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />);
    const form = await screen.findByRole('region', { name: 'Record time' });

    await user.type(within(form).getByLabelText(/^Time/), '1:00');
    await user.click(within(form).getByRole('combobox', { name: 'Job' }));
    await user.click(
      await screen.findByRole('option', { name: /J00001 · Year-end accounts 2026/ }),
    );
    await user.click(within(form).getByRole('button', { name: 'Record time' }));

    await waitFor(() => expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(1));
    expect(callsTo(backend, 'POST', '/time-entries')[0]?.body).toMatchObject({
      minutes: 60,
      client_id: ACME.id,
      job_id: ACCOUNTS_JOB.id,
    });
  });

  it('makes an older entry without a client or job get them before an edit is saved', async () => {
    const user = userEvent.setup();
    const backend = createBackend();
    server.use(...timeHandlers(backend));
    renderInOrg(
      <EntryPanel
        open
        onClose={() => undefined}
        entry={entry({
          id: 'old',
          entry_date: TODAY,
          minutes: 600,
          job: null,
          client: null,
          activity: null,
          is_billable: false,
        })}
      />,
    );
    const form = await screen.findByRole('region', { name: 'Edit time entry' });
    const time = within(form).getByLabelText(/^Time/);
    await user.clear(time);
    await user.type(time, '9:00');
    await user.click(within(form).getByRole('button', { name: 'Save entry' }));

    expect(await within(form).findByText('Choose a client')).toBeInTheDocument();
    expect(within(form).getByText('Choose a job')).toBeInTheDocument();
    expect(callsTo(backend, 'PATCH', '/time-entries/old')).toHaveLength(0);

    await user.click(within(form).getByRole('combobox', { name: 'Job' }));
    await user.click(
      await screen.findByRole('option', { name: /J00001 · Year-end accounts 2026/ }),
    );
    await user.click(within(form).getByRole('button', { name: 'Save entry' }));
    await waitFor(() =>
      expect(callsTo(backend, 'PATCH', '/time-entries/old')[0]?.body).toMatchObject({
        minutes: 540,
        client_id: ACME.id,
        job_id: ACCOUNTS_JOB.id,
      }),
    );
  });
});

describe('EntryPanel: the built-in Internal client (APT64)', () => {
  it('offers the Internal client and its jobs for internal time', async () => {
    const user = userEvent.setup();
    const backend = createBackend();
    server.use(...timeHandlers(backend));
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />);
    const form = await screen.findByRole('region', { name: 'Record time' });
    expect(form).toHaveTextContent('Internal time goes on the Internal client and its jobs.');

    await user.type(within(form).getByLabelText(/^Time/), '1:00');
    await user.click(within(form).getByRole('combobox', { name: 'Client' }));
    await user.click(await screen.findByRole('option', { name: /^Internal/ }));
    await user.click(within(form).getByRole('combobox', { name: 'Job' }));
    await user.click(
      await screen.findByRole('option', { name: /INT-ADM · Practice administration/ }),
    );
    await user.click(within(form).getByRole('button', { name: 'Record time' }));

    await waitFor(() => expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(1));
    expect(callsTo(backend, 'POST', '/time-entries')[0]?.body).toMatchObject({
      client_id: INTERNAL.id,
      job_id: ADMIN_JOB.id,
    });
  });

  it('is not offered by the client pickers outside time', async () => {
    const user = userEvent.setup();
    server.use(...timeHandlers(createBackend()));
    renderInOrg(<ClientPicker label="Client" value={null} onChange={() => undefined} />);
    await user.click(screen.getByRole('combobox', { name: 'Client' }));
    expect(await screen.findByRole('option', { name: /^Acme Ltd/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Internal/ })).not.toBeInTheDocument();
  });

  it('warns only a role that cannot choose a job: a job brings its client', async () => {
    server.use(...timeHandlers(createBackend()));
    const withoutClients = OWNER_PERMISSIONS.filter((code) => code !== PERMISSIONS.clientRead);
    const { unmount } = renderInOrg(
      <EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />,
      { context: contextWith(withoutClients) },
    );
    const form = await screen.findByRole('region', { name: 'Record time' });
    expect(within(form).getByRole('combobox', { name: 'Job' })).toBeInTheDocument();
    expect(form).not.toHaveTextContent('Time needs a client and a job');
    unmount();

    const withoutJobs = OWNER_PERMISSIONS.filter((code) => code !== PERMISSIONS.jobRead);
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />, {
      context: contextWith(withoutJobs),
    });
    expect(
      await screen.findByText('Time needs a client and a job', { exact: false }),
    ).toBeInTheDocument();
  });
});
