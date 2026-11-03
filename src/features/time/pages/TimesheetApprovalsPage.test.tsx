import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import { entry, LEE, SAM, sheetId, WEEK } from '../test/fixtures';
import { callsTo, createBackend, timeHandlers, type Sheet } from '../test/handlers';
import TimesheetApprovalsPage from './TimesheetApprovalsPage';

const submitted = (userId: string): Sheet => ({
  id: sheetId(userId, WEEK),
  user_id: userId,
  week_start: WEEK,
  status: 'submitted',
  submitted_at: '2026-10-16T16:00:00Z',
  decided_at: null,
  decision_note: null,
});

/** Sam's week has 1h 30m of billable time with no charge-out rate; Lee's is all priced. */
function setup() {
  const backend = createBackend({
    entries: [
      entry({ entry_date: '2026-10-12', minutes: 120, user_id: SAM, status: 'submitted' }),
      {
        ...entry({ entry_date: '2026-10-13', minutes: 90, user_id: SAM, status: 'submitted' }),
        charge_rate: 0,
        charge_value: 0,
      },
      // Non-billable time at no rate is not flagged.
      {
        ...entry({
          entry_date: '2026-10-12',
          minutes: 60,
          user_id: LEE,
          status: 'submitted',
          is_billable: false,
        }),
        charge_rate: 0,
        charge_value: 0,
      },
      entry({ entry_date: '2026-10-13', minutes: 240, user_id: LEE, status: 'submitted' }),
    ],
    sheets: [submitted(SAM), submitted(LEE)],
  });
  server.use(...timeHandlers(backend));
  renderInOrg(<TimesheetApprovalsPage />, { route: '/acme/time/approvals' });
  return backend;
}

const SAM_WARNING =
  /^1h 30m of Sam Staff's time has no charge-out rate, so it will go to WIP at £0\. Check their rates \(Team & Rates → Sam Staff\) before approving\.$/;

const warningLine = (scope: HTMLElement, pattern: RegExp) =>
  within(scope).queryByText(
    (_, element) => element?.tagName === 'LI' && pattern.test(element.textContent ?? ''),
  );

describe('TimesheetApprovalsPage: time with no charge-out rate (APT17)', () => {
  it('flags the sheet with unpriced billable time with a "No rate" badge', async () => {
    setup();
    await screen.findByRole('button', { name: /Approve the timesheet of Sam Staff/ });
    const badges = screen.getAllByText('No rate');
    expect(badges).toHaveLength(1);
    expect(badges[0]?.parentElement).toHaveTextContent('Sam Staff');
  });

  it('warns before approving, and Approve anyway approves', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(
      await screen.findByRole('button', { name: /Approve the timesheet of Sam Staff/ }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Approve this timesheet?' });
    expect(warningLine(dialog, SAM_WARNING)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Team & Rates → Sam Staff' })).toHaveAttribute(
      'href',
      `/acme/team/staff/${SAM}`,
    );

    await user.click(within(dialog).getByRole('button', { name: 'Approve anyway' }));
    await waitFor(() =>
      expect(callsTo(backend, 'POST', `/timesheets/${sheetId(SAM, WEEK)}/approve`)).toHaveLength(1),
    );
    expect(await screen.findByText('Timesheet approved')).toBeInTheDocument();
  });

  it('approves nothing on Cancel', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(
      await screen.findByRole('button', { name: /Approve the timesheet of Sam Staff/ }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Approve this timesheet?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callsTo(backend, 'POST', `/timesheets/${sheetId(SAM, WEEK)}/approve`)).toHaveLength(0);
  });

  it('does not warn when every billable hour is priced', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(
      await screen.findByRole('button', { name: /Approve the timesheet of Lee Locum/ }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Approve this timesheet?' });
    expect(within(dialog).queryByText('Time with no charge-out rate')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Approve timesheet' })).toBeInTheDocument();
  });

  it('names the people with unpriced time when approving several', async () => {
    const user = userEvent.setup();
    const backend = setup();
    await user.click(await screen.findByRole('checkbox', { name: 'Select all (2)' }));
    await user.click(screen.getByRole('button', { name: 'Approve selected (2)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve 2 timesheets?' });
    expect(warningLine(dialog, SAM_WARNING)).toBeInTheDocument();
    expect(warningLine(dialog, /Lee Locum's time/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Approve anyway' }));
    await waitFor(() =>
      expect(callsTo(backend, 'POST', '/approvals/bulk-approve')).toHaveLength(1),
    );
    expect(callsTo(backend, 'POST', '/approvals/bulk-approve')[0]?.body).toEqual({
      timesheet_ids: [sheetId(SAM, WEEK), sheetId(LEE, WEEK)],
    });
  });
});
