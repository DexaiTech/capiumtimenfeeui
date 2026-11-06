import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contextWith } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { fail, ok, server } from '@/test/server';

import { hoursOf, sam } from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import StaffDetailPage from './StaffDetailPage';

const STAFF = '/acme/team/staff';

// Only what the card needs, so the other cards of the page ask nothing.
function renderDetail(permissions: string[] = ['member.read', 'member.update']) {
  return renderInOrg(
    <Routes>
      <Route path={`${STAFF}/:staffId`} element={<StaffDetailPage />} />
    </Routes>,
    { context: contextWith(permissions), route: `${STAFF}/${sam.id}` },
  );
}

const card = () => screen.findByRole('region', { name: 'Working hours' });

/** Sam: 40 hours a week until the end of June, then 28 a week, then monthly hours from 2027. */
const history = [
  hoursOf(sam, {
    id: 'hours-now',
    standard_minutes: 1680,
    effective_from: '2026-07-01',
  }),
  hoursOf(sam, {
    id: 'hours-next',
    basis: 'monthly',
    standard_minutes: 9750,
    effective_from: '2027-01-01',
  }),
  hoursOf(sam, {
    id: 'hours-old',
    standard_minutes: 2400,
    effective_from: '2026-01-05',
    effective_to: '2026-06-30',
  }),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
  server.use(
    ...teamHandlers(),
    http.get(orgApiPath('/audit-logs/history'), () =>
      ok([], { meta: { next_cursor: null, has_more: false } }),
    ),
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe('StaffDetailPage working hours', () => {
  it('shows the standard hours in force today and every dated period', async () => {
    // The open-ended period runs to the end of the year once the monthly one is added.
    const rows = history.map((period) =>
      period.id === 'hours-now' ? { ...period, effective_to: '2026-12-31' } : period,
    );
    server.use(http.get(orgApiPath(`/staff/${sam.id}/hours`), () => ok(rows)));
    renderDetail();

    const hours = within(await card());
    // Today's hours, and the same period in the history.
    expect(await hours.findAllByText('28:00 per week')).toHaveLength(2);
    expect(hours.getByText('Weekly basis, 01/07/2026 – 31/12/2026')).toBeInTheDocument();
    const table = hours.getByRole('table', { name: 'Working hours of this person, by period' });
    const lines = within(table).getAllByRole('row').slice(1);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toHaveTextContent('Weekly28:00 per week01/07/2026 – 31/12/2026Current');
    expect(lines[1]).toHaveTextContent('Monthly162:30 per month01/01/2027 – open-endedFuture');
    expect(lines[2]).toHaveTextContent('Weekly40:00 per week05/01/2026 – 30/06/2026Ended');
  });

  it('says so when no hours are in force today, and when they cannot be loaded', async () => {
    server.use(http.get(orgApiPath(`/staff/${sam.id}/hours`), () => ok([])));
    const first = renderDetail();
    expect(
      await within(await card()).findByText('No standard hours are in force today.'),
    ).toBeInTheDocument();
    first.unmount();

    server.use(
      http.get(orgApiPath(`/staff/${sam.id}/hours`), () => fail(500, 'INTERNAL_ERROR', 'Boom.')),
    );
    renderDetail();
    expect(
      await within(await card()).findByText("Could not load this person's working hours."),
    ).toBeInTheDocument();
  });

  it('changes the working hours from a date, typed as h:mm', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(orgApiPath(`/staff/${sam.id}/hours`), async ({ request }) => {
        bodies.push(await request.json());
        return ok(hoursOf(sam, { id: 'hours-new' }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderDetail();

    const hours = within(await card());
    // Today's hours, and the same period in the history.
    expect(await hours.findAllByText('28:00 per week')).toHaveLength(2);
    await user.click(hours.getByRole('button', { name: 'Change working hours' }));
    const panel = await screen.findByRole('region', { name: 'Change working hours' });
    expectRequiredFields(panel, { required: ['Standard hours', 'Effective from'] });
    // The basis starts as the one in force.
    expect(within(panel).getByRole('radio', { name: /Weekly/ })).toBeChecked();
    await user.click(within(panel).getByRole('radio', { name: /Monthly/ }));
    await user.type(within(panel).getByRole('textbox', { name: 'Standard hours' }), '162:30');
    fireEvent.change(within(panel).getByLabelText('Effective from'), {
      target: { value: '2026-11-01' },
    });
    await user.click(within(panel).getByRole('button', { name: 'Save working hours' }));

    expect(await screen.findByText('Sam Staff: working hours saved')).toBeInTheDocument();
    expect(bodies).toEqual([
      { basis: 'monthly', standard_minutes: 9750, effective_from: '2026-11-01' },
    ]);
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Change working hours' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('validates the standard hours before sending anything', async () => {
    let posted = 0;
    server.use(
      http.post(orgApiPath(`/staff/${sam.id}/hours`), () => {
        posted += 1;
        return ok(hoursOf(sam), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderDetail();

    await user.click(
      await within(await card()).findByRole('button', { name: 'Change working hours' }),
    );
    const panel = await screen.findByRole('region', { name: 'Change working hours' });
    const message =
      'Enter the standard hours of the period, more than 0, for example 37:30 or 37.5';
    await user.click(within(panel).getByRole('button', { name: 'Save working hours' }));
    expect(await within(panel).findByText(message)).toBeInTheDocument();
    // A week has 168 hours.
    await user.type(within(panel).getByRole('textbox', { name: 'Standard hours' }), '170');
    await user.click(within(panel).getByRole('button', { name: 'Save working hours' }));
    expect(await within(panel).findByText(message)).toBeInTheDocument();
    expect(posted).toBe(0);
  });

  it('explains an overlap the API refuses and keeps the panel open', async () => {
    server.use(
      http.post(orgApiPath(`/staff/${sam.id}/hours`), () =>
        fail(409, 'HOURS_OVERLAP', 'Working hours already start on or after that date.'),
      ),
    );
    const user = userEvent.setup();
    renderDetail();

    await user.click(
      await within(await card()).findByRole('button', { name: 'Change working hours' }),
    );
    const panel = await screen.findByRole('region', { name: 'Change working hours' });
    await user.type(within(panel).getByRole('textbox', { name: 'Standard hours' }), '37.5');
    await user.click(within(panel).getByRole('button', { name: 'Save working hours' }));

    expect(
      await within(panel).findByText('Working hours already start on or after that date.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Change working hours' })).toBeInTheDocument();
  });

  it('shows the hours with member.read, and offers the change only with member.update', async () => {
    const first = renderDetail(['member.read']);
    const hours = within(await card());
    // Today's hours, and the same period in the history.
    expect(await hours.findAllByText('28:00 per week')).toHaveLength(2);
    expect(hours.queryByRole('button', { name: 'Change working hours' })).not.toBeInTheDocument();
    first.unmount();

    renderDetail(['member.read', 'member.update']);
    expect(
      await within(await card()).findByRole('button', { name: 'Change working hours' }),
    ).toBeInTheDocument();
  });
});
