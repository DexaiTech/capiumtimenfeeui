import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { fail, ok, server } from '@/test/server';

import {
  grace,
  overtimeRate,
  partnerGrade,
  sam,
  samOvertime,
  seniorGrade,
  seniorOvertime,
} from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import OvertimeRatesPage from './OvertimeRatesPage';

type User = ReturnType<typeof userEvent.setup>;

const END = { meta: { next_cursor: null, has_more: false } };
const READ_ONLY = ['rate.read', 'member.read'];

const row = (name: RegExp) => screen.findByRole('row', { name });
const actions = (subject: string) =>
  screen.findByRole('group', { name: `Actions for the overtime rate of ${subject}` });
const setDate = (scope: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(scope).getByLabelText(label), { target: { value } });

async function openAdd(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Add overtime rate' }));
  return screen.findByRole('region', { name: 'Add overtime rate' });
}

function capturePost() {
  const bodies: unknown[] = [];
  server.use(
    http.post(orgApiPath('/overtime-rates'), async ({ request }) => {
      bodies.push(await request.json());
      return ok(overtimeRate('ot-new'), { status: 201 });
    }),
  );
  return bodies;
}

const renderPage = (permissions: string[] = OWNER_PERMISSIONS) =>
  renderInOrg(<OvertimeRatesPage />, { context: contextWith(permissions) });

beforeEach(() => {
  server.use(...teamHandlers());
});
afterEach(() => {
  vi.useRealTimers();
});

describe('OvertimeRatesPage list', () => {
  it('lists the rates of grades and staff, and says they are a cost that is never charged out', async () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Overtime Rates' })).toBeInTheDocument();
    expect(screen.getByText(/internal cost only and never change charge-out/)).toBeInTheDocument();
    expect(screen.getByText(/replaces their grade's rate, never added to it/)).toBeInTheDocument();

    const senior = within(await row(/Senior grade/));
    expect(senior.getByText('Grade')).toBeInTheDocument();
    expect(senior.getByText('1.5× the cost rate')).toBeInTheDocument();
    expect(senior.getByText('01/01/2026')).toBeInTheDocument();
    expect(senior.getByText('Open-ended')).toBeInTheDocument();
    expect(senior.getByText('Current')).toBeInTheDocument();

    const own = within(await row(/Sam Staff/));
    expect(own.getByText('Staff')).toBeInTheDocument();
    expect(own.getByText('£45.00/h fixed')).toBeInTheDocument();
    expect(own.getByText('01/03/2026')).toBeInTheDocument();

    expect(await screen.findByRole('tab', { name: /^All rates\s*2$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/overtime-rates'), () => new Promise(() => undefined)));
    renderPage();
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('filters by status, level, grade and staff member, and clears the filters', async () => {
    const queries: URLSearchParams[] = [];
    server.use(...teamHandlers({ onOvertimeList: (params) => queries.push(params) }));
    const user = userEvent.setup();
    renderPage();
    await row(/Senior grade/);

    await user.click(screen.getByRole('tab', { name: 'Ended' }));
    await waitFor(() => expect(queries.at(-1)?.get('status')).toBe('ended'));
    await user.click(screen.getByRole('tab', { name: 'All rates' }));
    await waitFor(() => expect(queries.at(-1)?.has('status')).toBe(false));

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = await screen.findByRole('dialog', { name: 'Filter overtime rates' });
    expect(
      within(within(panel).getByRole('combobox', { name: 'Applies to' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All levels', 'Grade', 'Staff']);
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Applies to' }), 'Staff');
    await waitFor(() => expect(queries.at(-1)?.get('level')).toBe('staff'));
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Grade' }), 'Senior');
    await waitFor(() => expect(queries.at(-1)?.get('grade_id')).toBe(seniorGrade.id));
    await user.click(within(panel).getByRole('combobox', { name: 'Staff member' }));
    await user.click(await within(panel).findByRole('option', { name: /Sam Staff/ }));
    await waitFor(() => expect(queries.at(-1)?.get('user_id')).toBe(sam.id));
    expect(screen.getByRole('button', { name: /Filter, 3 filters applied/ })).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(queries.at(-1)?.has('level')).toBe(false));
    expect(queries.at(-1)?.has('grade_id')).toBe(false);
    expect(queries.at(-1)?.has('user_id')).toBe(false);
  });

  it('shows the empty state, the no-match state and the error state with a retry', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers({ overtimeRates: [] }));
    const first = renderPage();
    expect(await screen.findByText('No overtime rates yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add overtime rate' })).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: 'Future' }));
    expect(await screen.findByText('No overtime rates match')).toBeInTheDocument();
    first.unmount();

    let fails = true;
    server.use(
      http.get(orgApiPath('/overtime-rates'), () =>
        fails ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok([seniorOvertime], END),
      ),
    );
    renderPage();
    expect(await screen.findByText('Could not load the overtime rates')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/Senior grade/)).toBeInTheDocument();
  });
});

describe('OvertimeRatesPage add rate', () => {
  it('adds a multiplier of the cost rate for a grade', async () => {
    const bodies = capturePost();
    const user = userEvent.setup();
    renderPage();

    const panel = await openAdd(user);
    expect(within(panel).getByText(/never change what clients are charged/)).toBeInTheDocument();
    expect(within(panel).getByRole('combobox', { name: 'Applies to' })).toHaveValue('grade');
    expect(
      within(within(panel).getByRole('combobox', { name: 'Grade' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose a grade', 'Partner', 'Senior']);
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Grade' }), 'Partner');
    expect(within(panel).getByRole('radio', { name: /× the cost rate/ })).toBeChecked();
    await user.type(
      within(panel).getByRole('textbox', { name: 'Multiplier (× the cost rate)' }),
      '1.5',
    );
    setDate(panel, 'Effective from', '2026-11-01');
    await user.click(within(panel).getByRole('button', { name: 'Add overtime rate' }));

    expect(await screen.findByText('Overtime rate added')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        level: 'grade',
        grade_id: partnerGrade.id,
        mode: 'multiplier',
        multiplier_bp: 15000,
        effective_from: '2026-11-01',
      },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Add overtime rate' })).not.toBeInTheDocument(),
    );
  });

  it('adds a fixed rate per hour for a staff member with an end date', async () => {
    const bodies = capturePost();
    const user = userEvent.setup();
    renderPage();

    const panel = await openAdd(user);
    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Applies to' }),
      'Staff member',
    );
    expect(within(panel).getByText(/It replaces their grade's overtime rate/)).toBeInTheDocument();
    expect(within(panel).queryByRole('combobox', { name: 'Grade' })).not.toBeInTheDocument();
    await user.click(within(panel).getByRole('combobox', { name: 'Staff member' }));
    await user.click(await within(panel).findByRole('option', { name: /Grace Hopper/ }));
    await user.click(within(panel).getByRole('radio', { name: /Fixed £ per hour/ }));
    expect(
      within(panel).queryByRole('textbox', { name: 'Multiplier (× the cost rate)' }),
    ).not.toBeInTheDocument();
    await user.type(within(panel).getByRole('textbox', { name: 'Rate per hour (£)' }), '45.50');
    setDate(panel, 'Effective from', '2026-11-01');
    setDate(panel, 'Effective to', '2026-12-31');
    await user.click(within(panel).getByRole('button', { name: 'Add overtime rate' }));

    expect(await screen.findByText('Overtime rate added')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        level: 'staff',
        user_id: grace.id,
        mode: 'fixed',
        rate: 4550,
        effective_from: '2026-11-01',
        effective_to: '2026-12-31',
      },
    ]);
  });

  it('marks the mandatory fields and validates before sending anything', async () => {
    const bodies = capturePost();
    const user = userEvent.setup();
    renderPage();

    const panel = await openAdd(user);
    expectRequiredFields(panel, {
      required: ['Applies to', 'Grade', 'Multiplier (× the cost rate)', 'Effective from'],
      optional: ['Effective to'],
    });
    await user.click(within(panel).getByRole('button', { name: 'Add overtime rate' }));
    // "Choose a grade" is also the empty option of the list, so the error is read from the field.
    await waitFor(() =>
      expect(within(panel).getByRole('combobox', { name: 'Grade' })).toHaveAccessibleDescription(
        'Choose a grade',
      ),
    );
    expect(
      within(panel).getByText('Enter a multiple of the cost rate from 1 to 10, for example 1.5'),
    ).toBeInTheDocument();

    // Less than the cost rate is not overtime.
    await user.type(
      within(panel).getByRole('textbox', { name: 'Multiplier (× the cost rate)' }),
      '0.5',
    );
    await user.click(within(panel).getByRole('button', { name: 'Add overtime rate' }));
    expect(
      await within(panel).findByText(
        'Enter a multiple of the cost rate from 1 to 10, for example 1.5',
      ),
    ).toBeInTheDocument();

    await user.click(within(panel).getByRole('radio', { name: /Fixed £ per hour/ }));
    await user.type(within(panel).getByRole('textbox', { name: 'Rate per hour (£)' }), 'abc');
    setDate(panel, 'Effective from', '2026-11-01');
    setDate(panel, 'Effective to', '2026-10-01');
    await user.click(within(panel).getByRole('button', { name: 'Add overtime rate' }));
    expect(
      await within(panel).findByText('Enter the rate in pounds per hour, for example 45.00'),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText("The end date can't be before the start date"),
    ).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('shows the rates in the way when the period overlaps and keeps the panel open', async () => {
    server.use(
      http.post(orgApiPath('/overtime-rates'), () =>
        fail(409, 'RATE_OVERLAP', 'An overtime rate for this grade already covers that period.', {
          details: {
            conflicts: [
              { id: seniorOvertime.id, effective_from: '2026-01-01', effective_to: null },
            ],
          },
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const panel = await openAdd(user);
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Grade' }), 'Senior');
    await user.type(
      within(panel).getByRole('textbox', { name: 'Multiplier (× the cost rate)' }),
      '2',
    );
    await user.click(within(panel).getByRole('button', { name: 'Add overtime rate' }));

    expect(
      await within(panel).findByText('An overtime rate for this grade already covers that period.'),
    ).toBeInTheDocument();
    expect(
      within(within(panel).getByRole('list', { name: 'Rates in the way' })).getByText(
        '01/01/2026 – open-ended',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Add overtime rate' })).toBeInTheDocument();
  });

  it('cannot choose who a rate applies to without access to staff and grades', async () => {
    const user = userEvent.setup();
    renderPage(['rate.read', 'rate.manage']);
    const panel = await openAdd(user);
    expect(within(panel).getByText(/need permission to view staff and grades/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Add overtime rate' })).toBeDisabled();
  });
});

describe('OvertimeRatesPage end-date and delete', () => {
  it('end-dates a rate with the last day it applies; an ended rate offers no end-date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    const ended = overtimeRate('ot-ended', {
      grade: { id: partnerGrade.id, code: partnerGrade.code, name: partnerGrade.name },
      effective_from: '2025-01-01',
      effective_to: '2025-12-31',
      status: 'ended',
    });
    server.use(...teamHandlers({ overtimeRates: [seniorOvertime, ended] }));
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/overtime-rates/${seniorOvertime.id}`), async ({ request }) => {
        body = await request.json();
        return ok({ ...seniorOvertime, effective_to: '2026-10-20' });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const endedActions = await actions('Partner grade');
    expect(within(endedActions).queryByRole('button', { name: 'End-date' })).toBeNull();

    await user.click(
      within(await actions('Senior grade')).getByRole('button', { name: 'End-date' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'End-date rate' });
    expect(within(dialog).getByLabelText('Last day of the rate')).toHaveValue('2026-10-20');
    expectRequiredFields(dialog, { required: ['Last day of the rate'] });
    await user.click(within(dialog).getByRole('button', { name: 'End-date rate' }));

    expect(await screen.findByText('Overtime rate ends on 20/10/2026')).toBeInTheDocument();
    expect(body).toEqual({ effective_to: '2026-10-20' });
  });

  it('does not end a rate before it starts', async () => {
    let patched = 0;
    server.use(
      http.patch(orgApiPath(`/overtime-rates/${samOvertime.id}`), () => {
        patched += 1;
        return ok(samOvertime);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(within(await actions('Sam Staff')).getByRole('button', { name: 'End-date' }));
    const dialog = await screen.findByRole('dialog', { name: 'End-date rate' });
    setDate(dialog, 'Last day of the rate', '2026-02-01');
    await user.click(within(dialog).getByRole('button', { name: 'End-date rate' }));
    expect(
      await within(dialog).findByText("The rate starts on 01/03/2026; it can't end before that"),
    ).toBeInTheDocument();
    expect(patched).toBe(0);
  });

  it('deletes a rate after confirmation', async () => {
    let deleted = 0;
    server.use(
      http.delete(orgApiPath(`/overtime-rates/${samOvertime.id}`), () => {
        deleted += 1;
        return ok(null);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(within(await actions('Sam Staff')).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete overtime rate?' });
    expect(within(dialog).getByText(/£45\.00\/h fixed from 01\/03\/2026/)).toBeInTheDocument();
    expect(deleted).toBe(0);
    await user.click(within(dialog).getByRole('button', { name: 'Delete rate' }));

    expect(await screen.findByText('Overtime rate deleted')).toBeInTheDocument();
    expect(deleted).toBe(1);
  });

  it('keeps the dialog open with the reason when the API refuses the delete', async () => {
    server.use(
      http.delete(orgApiPath(`/overtime-rates/${samOvertime.id}`), () =>
        fail(409, 'RATE_IN_USE', 'This overtime rate has been used. End-date it instead.'),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(within(await actions('Sam Staff')).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete overtime rate?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete rate' }));
    expect(
      await within(dialog).findByText('This overtime rate has been used. End-date it instead.'),
    ).toBeInTheDocument();
  });
});

describe('OvertimeRatesPage permissions', () => {
  it('explains missing access without asking for the rates when there is no rate.read', () => {
    let asked = 0;
    server.use(
      http.get(orgApiPath('/overtime-rates'), () => {
        asked += 1;
        return ok([], END);
      }),
    );
    renderPage(['member.read', 'rate.manage']);
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add overtime rate' })).not.toBeInTheDocument();
    expect(asked).toBe(0);
  });

  it('is read-only without rate.manage: no add, no end-date, no delete', async () => {
    renderPage(READ_ONLY);
    await row(/Senior grade/);
    expect(screen.queryByRole('button', { name: 'Add overtime rate' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: /Actions for the overtime rate of/ }),
    ).not.toBeInTheDocument();
  });
});
