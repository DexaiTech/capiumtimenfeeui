import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { ownerContext } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, server } from '@/test/server';

import { callsTo, createBackend, orgApiPath, timeHandlers } from '../test/handlers';
import { ACCOUNTS_JOB, entry, SAM, TODAY, WEEK } from '../test/fixtures';
import { EntryPanel } from './EntryPanel';

const withOvertime = {
  ...ownerContext,
  organization: { ...ownerContext.organization, overtime_enabled: true },
};

/** My week already holds 15 hours (`weekEntries`): with 15 standard hours, any more is overtime. */
const FULL_WEEK = 900;

function setup(standardMinutes: number | null = FULL_WEEK) {
  const backend = createBackend({ standardMinutes });
  server.use(...timeHandlers(backend));
  return backend;
}

async function recordTwoHours(onClose = vi.fn()) {
  const user = userEvent.setup();
  renderInOrg(<EntryPanel open onClose={onClose} defaults={{ date: TODAY, job: ACCOUNTS_JOB }} />, {
    context: withOvertime,
  });
  const form = await screen.findByRole('region', { name: 'Record time' });
  await user.type(within(form).getByLabelText(/^Time/), '2:00');
  await user.click(within(form).getByRole('button', { name: 'Record time' }));
  return { user, form, onClose };
}

describe('EntryPanel: overtime (APT81)', () => {
  it('has no Overtime tick any more, with overtime on or off: the API finds overtime', async () => {
    setup();
    renderInOrg(<EntryPanel open onClose={() => undefined} defaults={{ date: TODAY }} />, {
      context: withOvertime,
    });
    const form = await screen.findByRole('region', { name: 'Record time' });

    expect(within(form).getByRole('checkbox', { name: /^Billable/ })).toBeInTheDocument();
    expect(within(form).queryByRole('checkbox', { name: /^Overtime/ })).not.toBeInTheDocument();
  });

  it('asks before saving new time that is overtime, and saves it with confirm_overtime', async () => {
    const backend = setup();
    const { user, onClose } = await recordTwoHours();

    const dialog = await screen.findByRole('dialog', { name: 'Add overtime hours?' });
    expect(dialog).toHaveTextContent('You are adding overtime hours. Are you sure?');
    expect(dialog).toHaveTextContent('2h of these are overtime (standard hours: 15h per week).');
    expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(1);
    expect(backend.entries).toHaveLength(3);

    await user.click(within(dialog).getByRole('button', { name: 'Add overtime' }));

    await waitFor(() => expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(2));
    const [first, second] = callsTo(backend, 'POST', '/time-entries');
    expect(first?.body).not.toHaveProperty('confirm_overtime');
    expect(second?.body).toMatchObject({ minutes: 120, confirm_overtime: true });
    expect(await screen.findByText('Time recorded')).toBeInTheDocument();
    expect(backend.entries).toHaveLength(4);
    expect(onClose).toHaveBeenCalled();
  });

  it('saves nothing on Cancel and keeps the form open', async () => {
    const backend = setup();
    const { user, form, onClose } = await recordTwoHours();

    const dialog = await screen.findByRole('dialog', { name: 'Add overtime hours?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(1);
    expect(backend.entries).toHaveLength(3);
    expect(onClose).not.toHaveBeenCalled();
    expect(form).toBeInTheDocument();
    expect(screen.queryByText('Time recorded')).not.toBeInTheDocument();
  });

  it('saves time within the standard hours at once, without asking', async () => {
    const backend = setup(2250);
    await recordTwoHours();

    expect(await screen.findByText('Time recorded')).toBeInTheDocument();
    expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(1);
    expect(screen.queryByRole('dialog', { name: 'Add overtime hours?' })).not.toBeInTheDocument();
    expect(callsTo(backend, 'POST', '/time-entries')[0]?.body).not.toHaveProperty(
      'confirm_overtime',
    );
  });

  it('asks when an edit adds overtime, and sends the change with confirm_overtime', async () => {
    const user = userEvent.setup();
    const backend = setup();
    const monday = backend.entries.find((item) => item.id === 'e-mon-1');
    if (!monday) throw new Error('The week has no Monday entry.');
    renderInOrg(<EntryPanel open entry={monday} onClose={() => undefined} />, {
      context: withOvertime,
    });
    const form = await screen.findByRole('region', { name: 'Edit time entry' });
    const time = within(form).getByLabelText(/^Time/);
    await user.clear(time);
    await user.type(time, '5:00');
    await user.click(within(form).getByRole('button', { name: 'Save entry' }));

    const dialog = await screen.findByRole('dialog', { name: 'Add overtime hours?' });
    expect(dialog).toHaveTextContent('1h of these are overtime');
    await user.click(within(dialog).getByRole('button', { name: 'Add overtime' }));

    await waitFor(() => expect(callsTo(backend, 'PATCH', '/time-entries/e-mon-1')).toHaveLength(2));
    expect(callsTo(backend, 'PATCH', '/time-entries/e-mon-1')[1]?.body).toEqual({
      minutes: 300,
      confirm_overtime: true,
    });
    expect(await screen.findByText('Time entry saved')).toBeInTheDocument();
  });

  it('asks when a correction of approved time adds overtime', async () => {
    const user = userEvent.setup();
    const approved = entry({ entry_date: TODAY, minutes: 60, status: 'approved' });
    const backend = createBackend({ entries: [approved], standardMinutes: 60 });
    server.use(...timeHandlers(backend));
    renderInOrg(<EntryPanel open correction entry={approved} onClose={() => undefined} />, {
      context: withOvertime,
    });
    const form = await screen.findByRole('region', { name: 'Correct approved time' });
    await user.type(within(form).getByLabelText(/^Reason/), 'Forgot the review');
    const time = within(form).getByLabelText(/^Time/);
    await user.clear(time);
    await user.type(time, '1:30');
    await user.click(within(form).getByRole('button', { name: 'Correct time' }));

    const dialog = await screen.findByRole('dialog', { name: 'Add overtime hours?' });
    expect(dialog).toHaveTextContent('30m of these are overtime (standard hours: 1h per week).');
    await user.click(within(dialog).getByRole('button', { name: 'Add overtime' }));

    const path = `/time-entries/${approved.id}/correct`;
    await waitFor(() => expect(callsTo(backend, 'POST', path)).toHaveLength(2));
    expect(callsTo(backend, 'POST', path)[1]?.body).toMatchObject({
      reason: 'Forgot the review',
      minutes: 90,
      confirm_overtime: true,
    });
    expect(await screen.findByText('Time corrected')).toBeInTheDocument();
  });

  it('asks on behalf of someone too, and keeps whose time it is', async () => {
    const user = userEvent.setup();
    const backend = setup(0);
    renderInOrg(
      <EntryPanel
        open
        onClose={() => undefined}
        onBehalfOf={{ id: SAM, name: 'Sam Staff' }}
        defaults={{ date: TODAY, job: ACCOUNTS_JOB }}
      />,
      { context: withOvertime },
    );
    const form = await screen.findByRole('region', { name: 'Record time for Sam Staff' });
    await user.type(within(form).getByLabelText(/^Time/), '1:00');
    await user.click(within(form).getByRole('button', { name: 'Record time' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add overtime hours?' });
    await user.click(within(dialog).getByRole('button', { name: 'Add overtime' }));

    await waitFor(() => expect(callsTo(backend, 'POST', '/time-entries')).toHaveLength(2));
    expect(callsTo(backend, 'POST', '/time-entries')[1]?.body).toMatchObject({
      user_id: SAM,
      confirm_overtime: true,
    });
  });

  it('says "per month" for a person whose standard hours are monthly', async () => {
    setup();
    server.use(
      http.post(orgApiPath('/time-entries'), () =>
        fail(409, 'OVERTIME_CONFIRMATION_REQUIRED', 'This adds overtime hours.', {
          details: {
            overtime_minutes: 90,
            standard_minutes: 9750,
            period_start: '2026-10-01',
            period_end: '2026-10-31',
          },
        }),
      ),
    );
    await recordTwoHours();

    const dialog = await screen.findByRole('dialog', { name: 'Add overtime hours?' });
    expect(dialog).toHaveTextContent(
      '1h 30m of these are overtime (standard hours: 162h 30m per month).',
    );
  });

  it('shows any other refusal on the form, without asking about overtime', async () => {
    const backend = setup();
    backend.lockedThrough = WEEK;
    const user = userEvent.setup();
    renderInOrg(
      <EntryPanel open onClose={() => undefined} defaults={{ date: WEEK, job: ACCOUNTS_JOB }} />,
      { context: withOvertime },
    );
    const form = await screen.findByRole('region', { name: 'Record time' });
    await user.type(within(form).getByLabelText(/^Time/), '1:00');
    await user.click(within(form).getByRole('button', { name: 'Record time' }));

    expect(await within(form).findByText(/the period is locked/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Add overtime hours?' })).not.toBeInTheDocument();
  });
});
