import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { orgApiPath, renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import type { WeekGrid } from '../../types';
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

function setup(week: WeekGrid) {
  const calls: string[] = [];
  server.use(
    http.post(orgApiPath('/timesheets/:id/submit'), () => {
      calls.push('submit');
      return ok({ id: 'ts-1', status: 'submitted' });
    }),
    http.post(orgApiPath('/timesheets/:id/recall'), () => {
      calls.push('recall');
      return ok({ id: 'ts-1', status: 'open' });
    }),
  );
  renderInOrg(<TimesheetStatusBar grid={week} sheet={undefined} canRecord />);
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
