import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contextWith } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import {
  accounts,
  acme,
  acmeServiceRule,
  partnerGrade,
  rule,
  sam,
  samChargeRule,
} from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import ChargeOutRatesPage from './ChargeOutRatesPage';

type User = ReturnType<typeof userEvent.setup>;

const row = (name: RegExp) => screen.findByRole('row', { name });

async function openActions(subject: string) {
  return screen.findByRole('group', { name: `Actions for the rate of ${subject}` });
}

async function openAdd(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Add rate' }));
  return screen.findByRole('region', { name: 'Add charge-out rate' });
}

const setDate = (dialog: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });

const optionNames = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);

/** Shows where the page navigated to. */
function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

function renderPage(options: Parameters<typeof renderInOrg>[1] = {}) {
  return renderInOrg(
    <>
      <ChargeOutRatesPage />
      <Where />
    </>,
    options,
  );
}

const MANAGER = ['rate.read', 'rate.manage', 'member.read', 'client.read'];

beforeEach(() => {
  server.use(...teamHandlers());
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ChargeOutRatesPage', () => {
  it('explains the order the charge-out rate is chosen in, most specific first', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Charge-out Rates' })).toBeInTheDocument();
    expect(screen.getByText('How the charge-out rate is chosen')).toBeInTheDocument();

    const levels = within(screen.getByRole('list', { name: 'Charge-out rate levels' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(levels).toHaveLength(8);
    [
      'Client + service + staff',
      'Client + service',
      'Client + staff',
      'Job rate',
      'Service rate for the person',
      'Staff rate',
      'Grade rate',
      'Practice default',
    ].forEach((title, index) => {
      expect(levels[index]?.startsWith(`${index + 1}${title}`)).toBe(true);
    });
    // The practice default is the last resort, in words only.
    expect(levels[7]).toContain('when nothing above applies');
    await row(/£175\.00\/h/);
  });

  it('lists the charge-out rates with their level, who they apply to, the period and the status', async () => {
    const queries: URLSearchParams[] = [];
    server.use(...teamHandlers({ onRuleList: (params) => queries.push(params) }));
    renderPage();

    const client = within(await row(/£200\.00\/h/));
    expect(client.getByText('Client + service')).toBeInTheDocument();
    expect(client.getByText('Acme Ltd · Year-end accounts')).toBeInTheDocument();
    expect(client.getByText('01/06/2026')).toBeInTheDocument();
    expect(client.getByText('31/12/2026')).toBeInTheDocument();
    expect(client.getByText('Current')).toBeInTheDocument();
    expect(client.getByText('In use')).toBeInTheDocument();

    const grade = within(await row(/£130\.00\/h/));
    expect(grade.getByText('Senior grade')).toBeInTheDocument();
    expect(grade.getByText('Ended')).toBeInTheDocument();

    expect(within(await row(/£190\.00\/h/)).getByText('Future')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /^All rates\s*4$/ })).toBeInTheDocument();
    expect(queries[0]?.get('kind')).toBe('charge');
  });

  it('filters by level in the order of precedence, by client, service and staff member', async () => {
    const queries: URLSearchParams[] = [];
    server.use(...teamHandlers({ onRuleList: (params) => queries.push(params) }));
    const user = userEvent.setup();
    renderPage();
    await row(/£175\.00\/h/);

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = await screen.findByRole('dialog', { name: 'Filter charge-out rates' });
    expect(optionNames(within(panel).getByRole('combobox', { name: 'Applies to' }))).toEqual([
      'All levels',
      'Client + service + staff',
      'Client + service',
      'Client + staff',
      'Client (everyone)',
      'Staff + service',
      'Service + grade',
      'Staff',
      'Grade',
    ]);

    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Applies to' }),
      'Client + service',
    );
    await waitFor(() => expect(queries.at(-1)?.getAll('level')).toEqual(['client_service']));
    expect(await screen.findByRole('row', { name: /£200\.00\/h/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /£175\.00\/h/ })).not.toBeInTheDocument(),
    );

    await user.selectOptions(
      within(panel).getByRole('combobox', { name: 'Service' }),
      'Year-end accounts',
    );
    await waitFor(() => expect(queries.at(-1)?.get('service_id')).toBe(accounts.id));
    await user.click(within(panel).getByRole('combobox', { name: 'Client' }));
    await user.click(await within(panel).findByRole('option', { name: /Acme Ltd/ }));
    await waitFor(() => expect(queries.at(-1)?.get('client_id')).toBe(acme.id));
    await user.click(within(panel).getByRole('combobox', { name: 'Staff member' }));
    await user.click(await within(panel).findByRole('option', { name: /Sam Staff/ }));
    await waitFor(() => expect(queries.at(-1)?.get('user_id')).toBe(sam.id));
    expect(screen.getByRole('button', { name: /Filter, 4 filters applied/ })).toBeInTheDocument();
    expect(await screen.findByText('No rates match')).toBeInTheDocument();
  });

  it('offers the level of the filter as the starting choice of a new rate', async () => {
    const user = userEvent.setup();
    renderPage({ route: '/?scope=service_grade' });

    const dialog = await openAdd(user);
    expect(within(dialog).getByRole('combobox', { name: 'Applies to' })).toHaveValue(
      'service_grade',
    );
    expect(within(dialog).getByText('Everyone of a grade, on one service.')).toBeInTheDocument();
  });

  it('adds a rate for one person on one service of one client', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath('/rates'), async ({ request }) => {
        body = await request.json();
        return ok(rule('rule-new', 'client_service_staff'), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAdd(user);
    expect(optionNames(within(dialog).getByRole('combobox', { name: 'Applies to' }))).toEqual([
      'Client + service + staff',
      'Client + service',
      'Client + staff',
      'Client (everyone)',
      'Staff + service',
      'Service + grade',
      'Staff',
      'Grade',
    ]);
    // The most specific level is first and chosen.
    expect(within(dialog).getByRole('combobox', { name: 'Applies to' })).toHaveValue(
      'client_service_staff',
    );

    await user.click(within(dialog).getByRole('combobox', { name: 'Client' }));
    await user.click(await within(dialog).findByRole('option', { name: /Acme Ltd/ }));
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Service' }),
      'Year-end accounts',
    );
    await user.click(within(dialog).getByRole('combobox', { name: 'Staff member' }));
    await user.click(await within(dialog).findByRole('option', { name: /Sam Staff/ }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), '210');
    setDate(dialog, 'Effective from', '2026-11-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));

    expect(await screen.findByText('Charge-out rate added')).toBeInTheDocument();
    expect(body).toEqual({
      kind: 'charge',
      client_id: acme.id,
      service_id: accounts.id,
      user_id: sam.id,
      rate: 21000,
      effective_from: '2026-11-01',
    });
  });

  it('adds a service rate for a grade and drops the pickers the level does not use', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath('/rates'), async ({ request }) => {
        body = await request.json();
        return ok(rule('rule-new', 'service_grade'), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAdd(user);
    // Choose a client first; changing the level must not send it.
    await user.click(within(dialog).getByRole('combobox', { name: 'Client' }));
    await user.click(await within(dialog).findByRole('option', { name: /Acme Ltd/ }));
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Applies to' }),
      'Service + grade',
    );
    expect(within(dialog).queryByRole('combobox', { name: 'Client' })).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('combobox', { name: 'Staff member' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Service' }),
      'Tax advice',
    );
    const grades = within(await within(dialog).findByRole('combobox', { name: 'Grade' }));
    expect(grades.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose a grade',
      'Partner',
      'Senior',
    ]);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Grade' }), 'Partner');
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate per hour (£)' }), '250.5');
    setDate(dialog, 'Effective from', '2026-11-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));

    expect(await screen.findByText('Charge-out rate added')).toBeInTheDocument();
    expect(body).toEqual({
      kind: 'charge',
      service_id: 'service-tax',
      grade_id: partnerGrade.id,
      rate: 25050,
      effective_from: '2026-11-01',
    });
  });

  it('asks for what the level needs before sending anything', async () => {
    let posted = 0;
    server.use(
      http.post(orgApiPath('/rates'), () => {
        posted += 1;
        return ok(rule('rule-new', 'client_service'), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const dialog = await openAdd(user);
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Applies to' }),
      'Client + service',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add rate' }));

    expect(await within(dialog).findByText('Choose a client')).toBeInTheDocument();
    // The option of the select reads the same, so the error is checked through the field.
    expect(within(dialog).getByRole('combobox', { name: 'Service' })).toHaveAccessibleDescription(
      'Choose a service',
    );
    expect(
      within(dialog).getByText('Enter the rate in pounds per hour, for example 95.00'),
    ).toBeInTheDocument();
    expect(posted).toBe(0);
  });

  it('offers only the levels and filters the permissions allow', async () => {
    const user = userEvent.setup();
    // No client.read: no client levels, and no client filter.
    renderPage({ context: contextWith(['rate.read', 'rate.manage', 'member.read']) });
    await row(/£175\.00\/h/);

    const dialog = await openAdd(user);
    expect(optionNames(within(dialog).getByRole('combobox', { name: 'Applies to' }))).toEqual([
      'Staff + service',
      'Service + grade',
      'Staff',
      'Grade',
    ]);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = await screen.findByRole('dialog', { name: 'Filter charge-out rates' });
    expect(within(panel).queryByRole('combobox', { name: 'Client' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('combobox', { name: 'Staff member' })).toBeInTheDocument();
  });

  it('end-dates a used client rate, which cannot be deleted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/rates/${acmeServiceRule.id}`), async ({ request }) => {
        body = await request.json();
        return ok({ ...acmeServiceRule, effective_to: '2026-11-30' });
      }),
    );
    const user = userEvent.setup();
    renderPage({ context: contextWith(MANAGER) });

    const menu = await openActions('Acme Ltd · Year-end accounts');
    expect(within(menu).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await user.click(within(menu).getByRole('button', { name: 'End-date' }));
    const dialog = await screen.findByRole('dialog', { name: 'End-date rate' });
    // It already ends on 31/12/2026; the field starts from that and can be brought forward.
    expect(within(dialog).getByLabelText('Last day of the rate')).toHaveValue('2026-12-31');
    setDate(dialog, 'Last day of the rate', '2026-11-30');
    await user.click(within(dialog).getByRole('button', { name: 'End-date rate' }));

    expect(await screen.findByText('Rate ends on 30/11/2026')).toBeInTheDocument();
    expect(body).toEqual({ effective_to: '2026-11-30' });
  });

  it('opens the history of a client rate, narrowed to its client and service', async () => {
    const user = userEvent.setup();
    renderPage();
    const menu = await openActions('Acme Ltd · Year-end accounts');
    await user.click(within(menu).getByRole('button', { name: 'View history' }));
    expect(screen.getByTestId('where')).toHaveTextContent(
      `/acme/team/rate-history?kind=charge&client=${acme.id}&service=${accounts.id}`,
    );
  });

  it('keeps the explanation and the list from people without rate.read', () => {
    renderPage({ context: contextWith(['member.read', 'client.read']) });
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByText('How the charge-out rate is chosen')).not.toBeInTheDocument();
  });

  it('explains a failed list and offers a retry', async () => {
    let fails = true;
    server.use(
      http.get(orgApiPath('/rates'), () =>
        fails
          ? fail(500, 'INTERNAL_ERROR', 'Boom.')
          : ok([samChargeRule], { meta: { next_cursor: null, has_more: false } }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Could not load the charge-out rates')).toBeInTheDocument();
    // The explanation is still there to read.
    expect(screen.getByText('How the charge-out rate is chosen')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/£175\.00\/h/)).toBeInTheDocument();
  });
});
