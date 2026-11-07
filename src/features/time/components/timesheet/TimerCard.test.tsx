import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields, isMarkedRequired } from '@/test/requiredFields';
import { server } from '@/test/server';

import { ACCOUNTS_JOB, ACME, ME, NOW_ISO, TODAY } from '../../test/fixtures';
import { callsTo, createBackend, timeHandlers } from '../../test/handlers';
import { TimerCard } from './TimerCard';

describe('TimerCard: a timer needs a client and a job (APT64)', () => {
  it('does not start without a job, and starts on the job and its client', async () => {
    const user = userEvent.setup();
    const backend = createBackend();
    server.use(...timeHandlers(backend));
    renderInOrg(<TimerCard />);

    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Start the timer' });
    expectRequiredFields(dialog, { required: [], optional: ['Activity', 'Description'] });
    for (const name of ['Client', 'Job']) {
      expect(isMarkedRequired(within(dialog).getByRole('combobox', { name }))).toBe(true);
    }
    expect(dialog).not.toHaveTextContent('internal time)');

    await user.click(within(dialog).getByRole('button', { name: 'Start timer' }));
    expect(
      await within(dialog).findByText('Choose a client and a job for the timer.'),
    ).toBeInTheDocument();
    expect(callsTo(backend, 'POST', '/timer/start')).toHaveLength(0);

    await user.click(within(dialog).getByRole('combobox', { name: 'Job' }));
    await user.click(
      await screen.findByRole('option', { name: /J00001 · Year-end accounts 2026/ }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Start timer' }));

    await waitFor(() => expect(callsTo(backend, 'POST', '/timer/start')).toHaveLength(1));
    expect(callsTo(backend, 'POST', '/timer/start')[0]?.body).toMatchObject({
      client_id: ACME.id,
      job_id: ACCOUNTS_JOB.id,
    });
  });
});

describe('TimerCard: stopping a timer left running (TIME-09)', () => {
  it('estimates at most a day, as the API saves', async () => {
    const user = userEvent.setup();
    const backend = createBackend({
      timer: {
        id: 'timer-1',
        user_id: ME,
        client_id: ACME.id,
        job_id: ACCOUNTS_JOB.id,
        activity_code_id: null,
        description: null,
        is_billable: true,
        is_running: false,
        started_at: null,
        accumulated_seconds: 30 * 3600,
        elapsed_seconds: 30 * 3600,
        started_on: TODAY,
        created_at: NOW_ISO,
      },
    });
    server.use(...timeHandlers(backend));
    renderInOrg(<TimerCard />);

    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    const dialog = await screen.findByRole('dialog', { name: 'Stop the timer' });
    expect(dialog).toHaveTextContent('a time entry of about 24:00');
  });
});
