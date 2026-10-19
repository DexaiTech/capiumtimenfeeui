import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import {
  grace,
  partnerGrade,
  rule,
  sam,
  samCostRule,
  seniorCostRule,
  seniorGrade,
  testCostRules,
} from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import CostRatesPage from './CostRatesPage';

type User = ReturnType<typeof userEvent.setup>;

/** A rate row by what it shows (every row's name also carries its actions button). */
const row = (name: RegExp) => screen.findByRole('row', { name });

async function openActions(user: User, subject: string) {
  const name = `Actions for the rate of ${subject}`;
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('menu', { name });
}

const menuItems = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent);

async function openAdd(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Add rate' }));
  return screen.findByRole('dialog', { name: 'Add cost rate' });
}

const setDate = (dialog: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });

/** Shows where the page navigated to. */
function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

function renderPage(options: Parameters<typeof renderInOrg>[1] = {}) {
  return renderInOrg(
    <>
      <CostRatesPage />
      <Where />
    </>,
    options,
  );
}

const READ_ONLY = ['rate.read'];
/** What an administrator of rates has: the rates, and staff and grades to choose from. */
const MANAGER = ['rate.read', 'rate.manage', 'member.read'];

beforeEach(() => {
  server.use(...teamHandlers({ rules: testCostRules }));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('CostRatesPage list', () => {
  it('lists the cost rates with who they apply to, the rate, the period, the status and use', async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      ...teamHandlers({ rules: testCostRules, onRuleList: (params) => queries.push(params) }),
    );
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Cost Rates' })).toBeInTheDocument();
    const samRow = within(await row(/£35\.00\/h/));
    expect(samRow.getByText('Staff')).toBeInTheDocument();
    expect(samRow.getByText('Sam Staff')).toBeInTheDocument();
    expect(samRow.getByText('01/03/2026')).toBeInTheDocument();
    expect(samRow.getByText('Open-ended')).toBeInTheDocument();
    expect(samRow.getByText('Current')).toBeInTheDocument();
    expect(samRow.queryByText('In use')).not.toBeInTheDocument();

    const seniorRow = within(await row(/£32\.00\/h/));
    expect(seniorRow.getByText('Grade')).toBeInTheDocument();
    expect(seniorRow.getByText('Senior grade')).toBeInTheDocument();
    expect(seniorRow.getByText('In use')).toBeInTheDocument();

    expect(await screen.findByRole('tab', { name: /^All rates\s*2$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Showing 2 rates · End of the list')).toBeInTheDocument();
    // Cost rates only: the list is asked for that kind, newest first.
    expect(queries[0]?.get('kind')).toBe('cost');
    expect(queries[0]?.get('sort')).toBe('effective_from');
    expect(queries[0]?.get('order')).toBe('desc');
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/rates'), () => new Promise(() => undefined)));
    renderPage();
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('filters by status, level, date, staff member, grade and quick search, and clears the filters', async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      ...teamHandlers({ rules: testCostRules, onRuleList: (params) => queries.push(params) }),
    );
    const user = userEvent.setup();
    renderPage();
    await row(/£35\.00\/h/);

    await user.click(screen.getByRole('tab', { name: 'Current' }));
    await waitFor(() => expect(queries.at(-1)?.get('status')).toBe('current'));
    expect(await screen.findByRole('row', { name: /£35\.00\/h/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Current/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'All rates' }));

    await user.type(screen.getByRole('searchbox', { name: 'Search cost rates' }), 'sam');
    await waitFor(() => expect(queries.at(-1)?.get('q')).toBe('sam'));
    await user.clear(screen.getByRole('searchbox', { name: 'Search cost rates' }));
    await waitFor(() => expect(queries.at(-1)?.has('q')).toBe(false));

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = await screen.findByRole('dialog', { name: 'Filter cost rates' });
    // Cost rates exist for people and grades only.
    expect(
      within(within(panel).getByRole('combobox', { name: 'Applies to' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All levels', 'Staff', 'Grade']);
    // The client and service filters belong to the charge-out rates.
    expect(within(panel).queryByRole('combobox', { name: 'Service' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('combobox', { name: 'Client' })).not.toBeInTheDocument();

    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Applies to' }), 'Grade');
    await waitFor(() => expect(queries.at(-1)?.getAll('level')).toEqual(['grade']));
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Grade' }), 'Senior');
    await waitFor(() => expect(queries.at(-1)?.get('grade_id')).toBe(seniorGrade.id));
    fireEvent.change(within(panel).getByLabelText('In force on'), {
      target: { value: '2026-06-01' },
    });
    await waitFor(() => expect(queries.at(-1)?.get('on_date')).toBe('2026-06-01'));
    await user.click(within(panel).getByRole('combobox', { name: 'Staff member' }));
    await user.click(await within(panel).findByRole('option', { name: /Sam Staff/ }));
    await waitFor(() => expect(queries.at(-1)?.get('user_id')).toBe(sam.id));
    expect(screen.getByRole('button', { name: /Filter, 4 filters applied/ })).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(queries.at(-1)?.has('grade_id')).toBe(false));
    expect(queries.at(-1)?.has('level')).toBe(false);
    expect(queries.at(-1)?.has('on_date')).toBe(false);
    expect(queries.at(-1)?.has('user_id')).toBe(false);
  });

  it('sorts on the server by the rate or the start date and reports aria-sort', async () => {
    const sorts: string[] = [];
    server.use(
      ...teamHandlers({
        rules: testCostRules,
        onRuleList: (params) => sorts.push(`${params.get('sort')}:${params.get('order')}`),
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await row(/£35\.00\/h/);
    expect(screen.getByRole('columnheader', { name: /Effective from/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await user.click(screen.getByRole('button', { name: 'Rate' }));
    await waitFor(() => expect(sorts.at(-1)).toBe('rate:asc'));
    expect(screen.getByRole('columnheader', { name: /^Rate/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: 'Rate' }));
    await waitFor(() => expect(sorts.at(-1)).toBe('rate:desc'));
    // The end date and status are not sortable on the server.
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
  });

  it('shows the empty state, the no-match state and the error state with a retry', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers({ rules: [] }));
    const first = renderPage();
    expect(await screen.findByText('No cost rates yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add rate' })).toHaveLength(2);
    await user.type(screen.getByRole('searchbox', { name: 'Search cost rates' }), 'zzz');
    expect(await screen.findByText('No rates match')).toBeInTheDocument();
    first.unmount();

    let fails = true;
    server.use(
      http.get(orgApiPath('/rates'), () =>
        fails
          ? fail(500, 'INTERNAL_ERROR', 'Boom.')
          : ok([samCostRule], { meta: { next_cursor: null, has_more: false } }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Could not load the cost rates')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/£35\.00\/h/)).toBeInTheDocument();
  });

  it('explains missing access without asking for the rates when there is no rate.read', () => {
    let asked = 0;
    server.use(
      http.get(orgApiPath('/rates'), () => {
        asked += 1;
        return ok([], { meta: { next_cursor: null, has_more: false } });
      }),
    );
    renderPage({ context: contextWith(['member.read', 'rate.manage']) });
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add rate' })).not.toBeInTheDocument();
    expect(asked).toBe(0);
  });

  it('hides Add rate and every change without rate.manage, keeping the history link', async () => {
    const user = userEvent.setup();
    renderPage({ context: contextWith(READ_ONLY) });
    await row(/£35\.00\/h/);

    expect(screen.queryByRole('button', { name: 'Add rate' })).not.toBeInTheDocument();
    expect(menuItems(await openActions(user, 'Sam Staff'))).toEqual(['View history']);
  });

  it('offers the actions a rate allows: a used rate can be end-dated, never deleted', async () => {
    const ended = rule('rule-ended', 'staff', {
      kind: 'cost',
      staff: { id: grace.id, code: grace.code, full_name: grace.full_name },
      rate: 2800,
      effective_from: '2025-01-01',
      effective_to: '2025-12-31',
      status: 'ended',
      can_delete: true,
    });
    server.use(...teamHandlers({ rules: [...testCostRules, ended] }));
    const user = userEvent.setup();
    renderPage();

    // Not used yet: everything.
    expect(menuItems(await openActions(user, 'Sam Staff'))).toEqual(
      expect.arrayContaining(['Edit', 'End-date', 'View history', 'Delete']),
    );
    await user.keyboard('{Escape}');
    // Used: it keeps its history, so no Delete.
    expect(menuItems(await openActions(user, 'Senior grade'))).toEqual([
      'Edit',
      'End-date',
      'View history',
    ]);
    await user.keyboard('{Escape}');
    // Already ended: there is nothing left to end.
    expect(menuItems(await openActions(user, 'Grace Hopper'))).toEqual([
      'Edit',
      'View history',
      'Delete',
    ]);
  });

  it('opens the history of the rate it is about', async () => {
    const user = userEvent.setup();
    renderPage();
    await row(/£32\.00\/h/);

    await user.click(
      await screen.findByRole('button', { name: 'Actions for the rate of Senior grade' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'View history' }));
    expect(screen.getByTestId('where')).toHaveTextContent(
      `/acme/team/rate-history?kind=cost&grade=${seniorGrade.id}`,
    );
  });
});

describe('CostRatesPage add rate', () => {
  it('adds a rate for a staff member and sends exactly the filled fields', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath('/rates'), async ({ request }) => {
        body = await request.json();
        return ok(rule('rule-new', 'staff', { kind: 'cost' }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAdd(user);
    expect(within(dialog).getByRole('combobox', { name: 'Applies to' })).toHaveValue('staff');
    expect(
      within(within(dialog).getByRole('combobox', { name: 'Applies to' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Staff', 'Grade']);
    expect(
      within(dialog).getByText('One person, whatever the client or service.'),
    ).toBeInTheDocument();
    // Staff: a person to choose, no grade.
    expect(within(dialog).queryByRole('combobox', { name: 'Grade' })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('combobox', { name: 'Staff member' }));
    await user.click(await within(dialog).findByRole('option', { name: /Grace Hopper/ }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), '36.50');
    setDate(dialog, 'Effective from', '2026-11-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));

    expect(await screen.findByText('Cost rate added')).toBeInTheDocument();
    expect(body).toEqual({
      kind: 'cost',
      user_id: grace.id,
      rate: 3650,
      effective_from: '2026-11-01',
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add cost rate' })).not.toBeInTheDocument(),
    );
  });

  it('adds a rate for a grade with an end date and closes the earlier open-ended rate', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath('/rates'), async ({ request }) => {
        body = await request.json();
        return ok(rule('rule-new', 'grade', { kind: 'cost' }), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAdd(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Applies to' }), 'Grade');
    // The pickers follow the level.
    expect(
      within(dialog).queryByRole('combobox', { name: 'Staff member' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      await within(dialog).findByRole('combobox', { name: 'Grade' }),
      'Partner',
    );
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), '95');
    setDate(dialog, 'Effective from', '2026-11-01');
    setDate(dialog, 'Effective to', '2026-12-31');
    await user.click(
      within(dialog).getByRole('checkbox', { name: /End the earlier open-ended rate/ }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));

    expect(await screen.findByText('Cost rate added')).toBeInTheDocument();
    expect(body).toEqual({
      kind: 'cost',
      grade_id: partnerGrade.id,
      rate: 9500,
      effective_from: '2026-11-01',
      effective_to: '2026-12-31',
      close_previous: true,
    });
  });

  it('offers the grade that is in use by name but not the inactive ones', async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openAdd(user);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Applies to' }), 'Grade');
    const grades = within(await within(dialog).findByRole('combobox', { name: 'Grade' }))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(grades).toEqual(['Choose a grade', 'Partner', 'Senior']);
  });

  it('validates the scope, the rate and the period before sending anything', async () => {
    let posted = 0;
    server.use(
      http.post(orgApiPath('/rates'), () => {
        posted += 1;
        return ok(rule('rule-new', 'staff'), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));
    expect(await within(dialog).findByText('Choose a staff member')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Enter the rate in pounds per hour, for example 95.00'),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), 'abc');
    setDate(dialog, 'Effective from', '2026-11-01');
    setDate(dialog, 'Effective to', '2026-10-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));
    expect(
      await within(dialog).findByText("The end date can't be before the start date"),
    ).toBeInTheDocument();
    expect(posted).toBe(0);
  });

  it('shows the rates in the way when the period overlaps and keeps the dialog open', async () => {
    server.use(
      http.post(orgApiPath('/rates'), () =>
        fail(409, 'RATE_OVERLAP', 'A rate for this scope already covers part of that period.', {
          details: {
            conflicts: [
              { id: 'rule-a', effective_from: '2026-01-01', effective_to: null },
              { id: 'rule-b', effective_from: '2025-06-01', effective_to: '2025-12-31' },
            ],
          },
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole('combobox', { name: 'Staff member' }));
    await user.click(await within(dialog).findByRole('option', { name: /Sam Staff/ }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), '36');
    setDate(dialog, 'Effective from', '2026-11-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));

    expect(
      await within(dialog).findByText('A rate for this scope already covers part of that period.'),
    ).toBeInTheDocument();
    const conflicts = within(within(dialog).getByRole('list', { name: 'Rates in the way' }));
    expect(conflicts.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '01/01/2026 – open-ended',
      '01/06/2025 – 31/12/2025',
    ]);
    expect(screen.getByRole('dialog', { name: 'Add cost rate' })).toBeInTheDocument();
  });

  it('explains a refusal that names a field, on that field', async () => {
    server.use(
      http.post(orgApiPath('/rates'), () =>
        fail(422, 'VALIDATION_ERROR', 'The request is invalid.', {
          details: [
            {
              field: 'user_id',
              code: 'not_found',
              message: 'That person is not in this practice.',
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole('combobox', { name: 'Staff member' }));
    await user.click(await within(dialog).findByRole('option', { name: /Sam Staff/ }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), '36');
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));

    expect(
      await within(dialog).findByText('That person is not in this practice.'),
    ).toBeInTheDocument();
  });

  it('cannot add a rate without access to staff and grades', async () => {
    const user = userEvent.setup();
    renderPage({ context: contextWith(['rate.read', 'rate.manage']) });
    await user.click(await screen.findByRole('button', { name: 'Add rate' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add cost rate' });
    expect(
      within(dialog).getByText(/need permission to view staff and grades/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add rate' })).toBeDisabled();
  });
});

describe('CostRatesPage edit, end-date and delete', () => {
  it('edits the amount and sends only what changed', async () => {
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/rates/${samCostRule.id}`), async ({ request }) => {
        body = await request.json();
        return ok({ ...samCostRule, rate: 3700 });
      }),
    );
    const user = userEvent.setup();
    renderPage({ context: contextWith(MANAGER) });

    const menu = await openActions(user, 'Sam Staff');
    await user.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit rate' });
    expect(within(dialog).getByText('Sam Staff')).toBeInTheDocument();
    const amount = within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' });
    expect(amount).toHaveValue('35.00');
    expect(within(dialog).getByLabelText('Effective from')).toHaveValue('2026-03-01');
    expect(within(dialog).getByLabelText('Effective from')).toBeEnabled();
    // Nothing changed yet, nothing to save.
    expect(within(dialog).getByRole('button', { name: 'Save rate' })).toBeDisabled();

    await user.clear(amount);
    await user.type(amount, '37');
    await user.click(within(dialog).getByRole('button', { name: 'Save rate' }));

    expect(await screen.findByText('Cost rate saved')).toBeInTheDocument();
    expect(body).toEqual({ rate: 3700 });
  });

  it('makes a rate open-ended again by clearing its end date', async () => {
    const closing = rule('rule-closing', 'staff', {
      kind: 'cost',
      staff: { id: sam.id, code: sam.code, full_name: sam.full_name },
      rate: 3400,
      effective_to: '2026-12-31',
    });
    server.use(...teamHandlers({ rules: [closing] }));
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/rates/${closing.id}`), async ({ request }) => {
        body = await request.json();
        return ok({ ...closing, effective_to: null });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const menu = await openActions(user, 'Sam Staff');
    await user.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit rate' });
    expect(within(dialog).getByLabelText('Effective to')).toHaveValue('2026-12-31');
    setDate(dialog, 'Effective to', '');
    await user.click(within(dialog).getByRole('button', { name: 'Save rate' }));

    expect(await screen.findByText('Cost rate saved')).toBeInTheDocument();
    expect(body).toEqual({ effective_to: null });
  });

  it('keeps the start date of a used rate and still lets the amount change', async () => {
    const user = userEvent.setup();
    renderPage();

    const menu = await openActions(user, 'Senior grade');
    await user.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit rate' });
    expect(within(dialog).getByLabelText('Effective from')).toBeDisabled();
    expect(
      within(dialog).getByText(
        /Time has been recorded under this rate, so its start date cannot change/,
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' })).toBeEnabled();
  });

  it('shows the rule the API refuses an edit with', async () => {
    server.use(
      http.patch(orgApiPath(`/rates/${samCostRule.id}`), () =>
        fail(409, 'RATE_OVERLAP', 'The new period meets another rate of this scope.', {
          details: {
            conflicts: [{ id: 'rule-z', effective_from: '2026-06-01', effective_to: null }],
          },
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const menu = await openActions(user, 'Sam Staff');
    await user.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit rate' });
    setDate(dialog, 'Effective to', '2026-12-31');
    await user.click(within(dialog).getByRole('button', { name: 'Save rate' }));

    expect(
      await within(dialog).findByText('The new period meets another rate of this scope.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('01/06/2026 – open-ended')).toBeInTheDocument();
  });

  it('end-dates a used rate with the last day it applies', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/rates/${seniorCostRule.id}`), async ({ request }) => {
        body = await request.json();
        return ok({ ...seniorCostRule, effective_to: '2026-10-20', status: 'ended' });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const menu = await openActions(user, 'Senior grade');
    await user.click(within(menu).getByRole('menuitem', { name: 'End-date' }));
    const dialog = await screen.findByRole('dialog', { name: 'End-date rate' });
    // The last day defaults to today, and the rate cannot end before it starts.
    expect(within(dialog).getByLabelText('Last day of the rate')).toHaveValue('2026-10-20');
    expect(within(dialog).getByLabelText('Last day of the rate')).toHaveAttribute(
      'min',
      '2026-01-01',
    );
    expect(
      within(dialog).getByText(/Time already recorded keeps the rate it was given/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'End-date rate' }));

    expect(await screen.findByText('Rate ends on 20/10/2026')).toBeInTheDocument();
    expect(body).toEqual({ effective_to: '2026-10-20' });
  });

  it('does not end a rate before it starts', async () => {
    let patched = 0;
    server.use(
      http.patch(orgApiPath(`/rates/${seniorCostRule.id}`), () => {
        patched += 1;
        return ok(seniorCostRule);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const menu = await openActions(user, 'Senior grade');
    await user.click(within(menu).getByRole('menuitem', { name: 'End-date' }));
    const dialog = await screen.findByRole('dialog', { name: 'End-date rate' });
    setDate(dialog, 'Last day of the rate', '2025-12-31');
    await user.click(within(dialog).getByRole('button', { name: 'End-date rate' }));

    expect(
      await within(dialog).findByText("The rate starts on 01/01/2026; it can't end before that"),
    ).toBeInTheDocument();
    expect(patched).toBe(0);
  });

  it('deletes an unused rate after confirmation', async () => {
    let deleted = 0;
    server.use(
      http.delete(orgApiPath(`/rates/${samCostRule.id}`), () => {
        deleted += 1;
        return ok(null);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const menu = await openActions(user, 'Sam Staff');
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete rate?' });
    expect(within(dialog).getByText(/£35\.00\/h from 01\/03\/2026/)).toBeInTheDocument();
    expect(deleted).toBe(0);
    await user.click(within(dialog).getByRole('button', { name: 'Delete rate' }));

    expect(await screen.findByText('Rate deleted')).toBeInTheDocument();
    expect(deleted).toBe(1);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Delete rate?' })).not.toBeInTheDocument(),
    );
  });

  it('keeps the dialog open and explains it when the rate turns out to be in use', async () => {
    server.use(
      http.delete(orgApiPath(`/rates/${samCostRule.id}`), () =>
        fail(
          409,
          'RATE_IN_USE',
          'Time has been recorded under this rate, so it cannot be deleted. End-date it instead.',
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    const menu = await openActions(user, 'Sam Staff');
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete rate?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete rate' }));

    expect(
      await within(dialog).findByText(
        /Time has been recorded under this rate, so it cannot be deleted/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Delete rate?' })).toBeInTheDocument();
  });
});

describe('CostRatesPage permissions', () => {
  it('needs only rate.read to see the list', async () => {
    renderPage({ context: contextWith(READ_ONLY) });
    expect(await row(/£35\.00\/h/)).toBeInTheDocument();
    // The people and grade filters read staff and grades, which have their own permission.
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = await screen.findByRole('dialog', { name: 'Filter cost rates' });
    expect(within(panel).queryByRole('combobox', { name: 'Staff member' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('combobox', { name: 'Grade' })).not.toBeInTheDocument();
    expect(within(panel).getByLabelText('In force on')).toBeInTheDocument();
  });

  it('is available to the owner with every action', async () => {
    renderPage({ context: contextWith(OWNER_PERMISSIONS) });
    expect(await screen.findByRole('button', { name: 'Add rate' })).toBeInTheDocument();
  });
});
