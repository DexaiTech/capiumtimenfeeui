import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { ownerContext } from '@/test/orgFixtures';
import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { timesheetOf } from '../../test/fixtures';
import type { TimesheetDetail, WeekGrid } from '../../types';
import { TimesheetStatusBar } from './TimesheetStatusBar';

const MONDAY = '2026-10-12';
const FRIDAY = '2026-10-16';
const DAYS = [MONDAY, '2026-10-13', '2026-10-14', '2026-10-15', FRIDAY];

function grid(overrides: Partial<WeekGrid> = {}): WeekGrid {
  return {
    user_id: 'u-1',
    week_start: MONDAY,
    week_end: '2026-10-18',
    days: DAYS,
    timesheet_id: 'ts-1',
    timesheet_status: 'open',
    rows: [],
    day_totals: [450, 450, 450, 450, 450],
    total_minutes: 2250,
    chargeable_minutes: 2000,
    non_chargeable_minutes: 250,
    today: null,
    targets: null,
    working_days: DAYS,
    missing_days: [],
    day_variance: [0, 0, 0, 0, 0],
    ...overrides,
  };
}

function setup(
  week: WeekGrid,
  {
    approving = true,
    sheet,
    exempt = false,
  }: { approving?: boolean; sheet?: TimesheetDetail; exempt?: boolean } = {},
) {
  const calls: string[] = [];
  server.use(
    http.post(orgApiPath('/timesheets/:id/submit'), () => {
      calls.push('submit');
      // A person exempt from approval has the week approved at submit, whatever the practice does.
      return ok({ id: 'ts-1', status: approving && !exempt ? 'submitted' : 'approved' });
    }),
    http.post(orgApiPath('/timesheets/:id/recall'), () => {
      calls.push('recall');
      return ok({ id: 'ts-1', status: 'open' });
    }),
  );
  const context = {
    ...ownerContext,
    organization: { ...ownerContext.organization, require_timesheet_approval: approving },
  };
  renderInOrg(<TimesheetStatusBar grid={week} sheet={sheet} canRecord />, { context });
  return calls;
}

describe('TimesheetStatusBar: submitting', () => {
  it('submits a complete week with one click and offers Undo', async () => {
    const user = userEvent.setup();
    const calls = setup(grid());
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(await screen.findByText('Timesheet submitted')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toEqual(['submit']);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(calls).toEqual(['submit', 'recall']));
    expect(await screen.findByText('Timesheet recalled')).toBeInTheDocument();
  });

  it('still asks first when days have no time recorded', async () => {
    const user = userEvent.setup();
    const calls = setup(grid({ missing_days: [FRIDAY] }));
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit this timesheet?' });
    expect(calls).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Submit timesheet' }));
    await waitFor(() => expect(calls).toEqual(['submit']));
  });
});

describe('TimesheetStatusBar: time with no charge-out rate (APT17)', () => {
  it('asks before submitting a week with billable time at £0', async () => {
    const user = userEvent.setup();
    const sheet = {
      ...timesheetOf('u-1', MONDAY, 'open', { id: 'ts-1', zero_rate_minutes: 90 }),
      entries: [],
      day_totals: [],
    };
    const calls = setup(grid(), { sheet });
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit this timesheet?' });
    expect(within(dialog).getByText('Time with no charge-out rate')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/1h 30m of your billable time has no charge-out rate/),
    ).toBeInTheDocument();
    expect(calls).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Submit timesheet' }));
    await waitFor(() => expect(calls).toEqual(['submit']));
  });
});

describe('TimesheetStatusBar: a practice that does not approve timesheets', () => {
  it('submits the week without mentioning approval, and offers no Undo', async () => {
    const user = userEvent.setup();
    const calls = setup(grid(), { approving: false });
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit timesheet' }));
    expect(await screen.findByText(/timesheets need no approval here/i)).toBeInTheDocument();
    expect(calls).toEqual(['submit']);
    // An approved week cannot be recalled.
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('says in the question that the week is approved at once', async () => {
    const user = userEvent.setup();
    setup(grid({ missing_days: [FRIDAY] }), { approving: false });
    await user.click(screen.getByRole('button', { name: 'Submit timesheet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit this timesheet?' });
    expect(within(dialog).getByText(/is approved at once/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/goes to your manager/)).not.toBeInTheDocument();
  });
});

describe('TimesheetStatusBar: a person exempt from approval (TIME-02)', () => {
  it('says the week is approved and offers no Undo when the submit approves it', async () => {
    const user = userEvent.setup();
    const calls = setup(grid(), { exempt: true });
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(
      await screen.findByText(/the week is approved and its time is locked/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Your manager can now approve it.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(calls).toEqual(['submit']);
  });

  it('says the same after the question', async () => {
    const user = userEvent.setup();
    setup(grid({ missing_days: [FRIDAY] }), { exempt: true });
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit this timesheet?' });
    await user.click(within(dialog).getByRole('button', { name: 'Submit timesheet' }));
    expect(
      await screen.findByText(/the week is approved and its time is locked/),
    ).toBeInTheDocument();
  });
});

describe('TimesheetStatusBar: the wording before an exempt person submits (TIME-02)', () => {
  const sheetOf = (approvalExempt: boolean): TimesheetDetail => ({
    ...timesheetOf('u-1', MONDAY, 'open', { id: 'ts-1', approval_exempt: approvalExempt }),
    entries: [],
    day_totals: [],
  });

  it('says the week is approved at once, before and after the question', async () => {
    const user = userEvent.setup();
    const calls = setup(grid({ missing_days: [FRIDAY] }), { exempt: true, sheet: sheetOf(true) });
    expect(screen.queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit week' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit this timesheet?' });
    expect(
      within(dialog).getByText(/Your week is approved as soon as you submit it/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/goes to your manager/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Submit timesheet' }));
    expect(
      await screen.findByText(/the week is approved and its time is locked/),
    ).toBeInTheDocument();
    expect(calls).toEqual(['submit']);
  });

  it('keeps the approval wording for a person whose week needs approval', async () => {
    const user = userEvent.setup();
    setup(grid({ missing_days: [FRIDAY] }), { sheet: sheetOf(false) });
    expect(screen.queryByRole('button', { name: 'Submit week' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit for approval' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit this timesheet?' });
    expect(within(dialog).getByText(/goes to your manager/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/as soon as you submit it/)).not.toBeInTheDocument();
  });

  it('keeps the practice wording when the practice approves no timesheets', async () => {
    const user = userEvent.setup();
    setup(grid({ missing_days: [FRIDAY] }), { approving: false, sheet: sheetOf(true) });
    await user.click(screen.getByRole('button', { name: 'Submit timesheet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit this timesheet?' });
    expect(within(dialog).getByText(/timesheets need no\s+approval here/)).toBeInTheDocument();
  });
});

describe('TimesheetStatusBar: while the sheet loads (TIME-08)', () => {
  it('keeps Submit disabled until the time with no rate is known', () => {
    renderInOrg(<TimesheetStatusBar grid={grid()} sheet={undefined} sheetLoading canRecord />);
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
  });
});

describe('TimesheetStatusBar: deleting', () => {
  function setupDelete(week: WeekGrid, refuse = false) {
    const calls: string[] = [];
    server.use(
      http.delete(orgApiPath('/timesheets/:id'), () => {
        calls.push('delete');
        return refuse
          ? fail(409, 'TIMESHEET_HAS_BILLED_TIME', 'Some of this time has been billed.')
          : ok(null);
      }),
    );
    renderInOrg(<TimesheetStatusBar grid={week} sheet={undefined} canRecord />);
    return calls;
  }

  it('deletes an open week after asking', async () => {
    const user = userEvent.setup();
    const calls = setupDelete(grid());
    await user.click(screen.getByRole('button', { name: 'Delete timesheet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this timesheet?' });
    expect(calls).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Delete timesheet' }));
    await waitFor(() => expect(calls).toEqual(['delete']));
    expect(await screen.findByText('Timesheet deleted')).toBeInTheDocument();
  });

  it('is offered on a returned week too', () => {
    setupDelete(grid({ timesheet_status: 'rejected' }));
    expect(screen.getByRole('button', { name: 'Delete timesheet' })).toBeInTheDocument();
  });

  it('shows why the API refused, for example billed time', async () => {
    const user = userEvent.setup();
    setupDelete(grid(), true);
    await user.click(screen.getByRole('button', { name: 'Delete timesheet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this timesheet?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete timesheet' }));
    expect(
      await within(dialog).findByText('Some of this time has been billed.'),
    ).toBeInTheDocument();
  });

  it.each(['submitted', 'approved'] as const)('is not offered on a %s week', (status) => {
    setupDelete(grid({ timesheet_status: status }));
    expect(screen.queryByRole('button', { name: 'Delete timesheet' })).not.toBeInTheDocument();
  });

  it('says that approved time is locked and who can release it', () => {
    setupDelete(grid({ timesheet_status: 'approved' }));
    expect(screen.getByText(/cannot be edited or deleted/)).toBeInTheDocument();
    expect(screen.getByText(/revoke the approval/)).toBeInTheDocument();
  });

  it('is not offered without a timesheet yet', () => {
    setupDelete(grid({ timesheet_id: null }));
    expect(screen.queryByRole('button', { name: 'Delete timesheet' })).not.toBeInTheDocument();
  });
});
