import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contextWith } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { accounts, acme, job, resolution, sam } from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import RatePreviewPage from './RatePreviewPage';

const OWNER_QUERY = `/?staff=${sam.id}&date=2026-10-15&client=${acme.id}&service=${accounts.id}`;

function answer(onQuery?: (params: URLSearchParams) => void) {
  return http.get(orgApiPath('/rates/resolve'), ({ request }) => {
    onQuery?.(new URL(request.url).searchParams);
    return ok(resolution);
  });
}

/** The row of a ladder table by the exact name of its level. */
const level = (table: string, label: string) => {
  const rows = within(screen.getByRole('table', { name: table }))
    .getAllByRole('row')
    .slice(1);
  const found = rows.find((entry) =>
    within(entry)
      .getAllByRole('cell')
      .some((cell) => cell.textContent === label),
  );
  if (!found) throw new Error(`No level "${label}" in "${table}"`);
  return found;
};

beforeEach(() => {
  server.use(...teamHandlers());
});
afterEach(() => {
  vi.useRealTimers();
});

/** jsdom matches no media query (the card layout); this renders the md-and-up tables. */
function desktop() {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string): MediaQueryList => ({
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

describe('RatePreviewPage form', () => {
  it('asks for a person first and sends nothing until one is chosen', async () => {
    const queries: URLSearchParams[] = [];
    server.use(answer((params) => queries.push(params)));
    const user = userEvent.setup();
    renderInOrg(<RatePreviewPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Rate Preview' })).toBeInTheDocument();
    expect(screen.getByText('Choose who the rate is for')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check rate' }));
    expect(await screen.findByText('Choose a staff member')).toBeInTheDocument();
    expect(queries).toHaveLength(0);
  });

  it('starts today, in the practice zone', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T23:30:00Z'));
    renderInOrg(<RatePreviewPage />);
    // 23:30 UTC on 20 October is already 00:30 on the 21st in London (BST).
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-21');
  });

  it('works out the rate for the person, client, service and day chosen', async () => {
    const queries: URLSearchParams[] = [];
    server.use(answer((params) => queries.push(params)));
    const user = userEvent.setup();
    renderInOrg(<RatePreviewPage />);

    await user.click(screen.getByRole('combobox', { name: 'Staff member' }));
    await user.click(await screen.findByRole('option', { name: /Sam Staff/ }));
    await user.click(screen.getByRole('combobox', { name: 'Client' }));
    await user.click(await screen.findByRole('option', { name: /Acme Ltd/ }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Service' }),
      'Year-end accounts',
    );
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-15' } });
    await user.click(screen.getByRole('button', { name: 'Check rate' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Rate for Sam Staff (Senior) on 15/10/2026, for Acme Ltd · Year-end accounts',
      }),
    ).toBeInTheDocument();
    expect(queries).toHaveLength(1);
    expect(Object.fromEntries(queries[0] ?? [])).toEqual({
      user_id: sam.id,
      date: '2026-10-15',
      client_id: acme.id,
      service_id: accounts.id,
    });

    // The two answers, each with what it came from and the period of the rate behind it.
    const charge = screen.getByRole('heading', { level: 3, name: 'Charge-out rate' }).parentElement;
    expect(within(charge as HTMLElement).getByText('£200.00/h')).toBeInTheDocument();
    expect(
      within(charge as HTMLElement).getByText('Client + service', { exact: false }),
    ).toBeInTheDocument();
    expect(
      within(charge as HTMLElement).getByText(/from 01\/06\/2026 to 31\/12\/2026/),
    ).toBeInTheDocument();
    const cost = screen.getByRole('heading', { level: 3, name: 'Cost rate' }).parentElement;
    expect(within(cost as HTMLElement).getByText('£35.00/h')).toBeInTheDocument();
    expect(
      within(cost as HTMLElement).getByText('Staff cost rate', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing is saved/)).toBeInTheDocument();
  });

  it('brings the client of the chosen job, sends the job and drops it when the client changes', async () => {
    const queries: URLSearchParams[] = [];
    server.use(answer((params) => queries.push(params)));
    const user = userEvent.setup();
    renderInOrg(<RatePreviewPage />);

    await user.click(screen.getByRole('combobox', { name: 'Staff member' }));
    await user.click(await screen.findByRole('option', { name: /Sam Staff/ }));
    await user.click(screen.getByRole('combobox', { name: 'Job' }));
    await user.click(await screen.findByRole('option', { name: /J00002 · Year-end accounts/ }));
    // The job belongs to Acme: the client follows.
    expect(screen.getByRole('combobox', { name: 'Client' })).toHaveAttribute(
      'placeholder',
      'Acme Ltd',
    );
    await user.click(screen.getByRole('button', { name: 'Check rate' }));

    await screen.findByRole('heading', { level: 2, name: /^Rate for Sam Staff/ });
    expect(queries[0]?.get('job_id')).toBe(job.id);
    expect(queries[0]?.get('client_id')).toBe(acme.id);
    expect(queries[0]?.has('service_id')).toBe(false);

    // Another client means another job: the old one is let go.
    await user.click(screen.getByRole('button', { name: 'Clear client' }));
    expect(screen.getByRole('combobox', { name: 'Job' })).toHaveAttribute('placeholder', 'Any job');
  });

  it('only offers the pickers the permissions allow', () => {
    renderInOrg(<RatePreviewPage />, { context: contextWith(['rate.read', 'member.read']) });
    expect(screen.getByRole('combobox', { name: 'Staff member' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Client' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Job' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Service' })).toBeInTheDocument();
  });

  it('cannot choose a person without access to staff', () => {
    renderInOrg(<RatePreviewPage />, { context: contextWith(['rate.read']) });
    expect(screen.getByText(/You need permission to view staff/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check rate' })).toBeDisabled();
  });

  it('explains missing access without asking anything when there is no rate.read', () => {
    let asked = 0;
    server.use(
      http.get(orgApiPath('/rates/resolve'), () => {
        asked += 1;
        return ok(resolution);
      }),
    );
    renderInOrg(<RatePreviewPage />, { context: contextWith(['member.read', 'rate.manage']) });
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check rate' })).not.toBeInTheDocument();
    expect(asked).toBe(0);
  });
});

describe('RatePreviewPage result', () => {
  beforeEach(desktop);
  it('opens on the question in the link and shows the levels the charge-out rate was chosen from', async () => {
    const queries: URLSearchParams[] = [];
    server.use(answer((params) => queries.push(params)));
    renderInOrg(<RatePreviewPage />, { route: OWNER_QUERY });

    await screen.findByRole('table', { name: 'Charge-out rate levels' });
    expect(queries[0]?.get('user_id')).toBe(sam.id);
    // Announced to screen readers when it arrives.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Rate worked out: charge-out £200.00/h, cost £35.00/h.',
    );
    // The form is filled in from the link.
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-15');
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Staff member' })).toHaveAttribute(
        'placeholder',
        'Sam Staff',
      ),
    );

    const rows = within(screen.getByRole('table', { name: 'Charge-out rate levels' }))
      .getAllByRole('row')
      .slice(1);
    // Eight levels, most specific first, the practice default last.
    expect(rows).toHaveLength(8);
    expect(rows.map((entry) => within(entry).getAllByRole('cell')[1]?.textContent)).toEqual([
      'Client + service + staff',
      'Client + service',
      'Client + staff',
      'Job rate',
      'Service + grade',
      'Staff',
      'Grade',
      'Practice default rate',
    ]);

    // Nothing set at a level: say so. The winner is applied, with the dated rate behind it.
    expect(
      within(level('Charge-out rate levels', 'Client + service + staff')).getByText('No rate set'),
    ).toBeInTheDocument();
    const winner = within(level('Charge-out rate levels', 'Client + service'));
    expect(winner.getByText('Applied')).toBeInTheDocument();
    expect(winner.getByText('£200.00/h')).toBeInTheDocument();
    expect(winner.getByText('Dated rate · 01/06/2026 – 31/12/2026')).toBeInTheDocument();

    // A level the question cannot reach says why.
    const jobStep = within(level('Charge-out rate levels', 'Job rate'));
    expect(jobStep.getByText('Not applicable')).toBeInTheDocument();
    expect(jobStep.getByText('Choose a job to see its rate.')).toBeInTheDocument();

    // Rates that exist at less specific levels are overridden, with where they come from.
    const staffStep = within(level('Charge-out rate levels', 'Staff'));
    expect(staffStep.getByText('Overridden')).toBeInTheDocument();
    expect(staffStep.getByText('£175.00/h')).toBeInTheDocument();
    expect(staffStep.getByText('Dated rate · 01/03/2026 – open-ended')).toBeInTheDocument();
    const gradeStep = within(level('Charge-out rate levels', 'Grade'));
    expect(gradeStep.getByText('£120.00/h')).toBeInTheDocument();
    expect(gradeStep.getByText('Grade default')).toBeInTheDocument();
    const fallback = within(level('Charge-out rate levels', 'Practice default rate'));
    expect(fallback.getByText('£95.00/h')).toBeInTheDocument();
    expect(fallback.getByText('Practice default')).toBeInTheDocument();
  });

  it('shows the levels the cost rate was chosen from', async () => {
    server.use(answer());
    renderInOrg(<RatePreviewPage />, { route: OWNER_QUERY });

    await screen.findByRole('table', { name: 'Cost rate levels' });
    const own = within(level('Cost rate levels', 'Staff cost rate'));
    expect(own.getByText('Applied')).toBeInTheDocument();
    expect(own.getByText('£35.00/h')).toBeInTheDocument();
    const grade = within(level('Cost rate levels', 'Grade cost rate'));
    expect(grade.getByText('Overridden')).toBeInTheDocument();
    expect(grade.getByText('Grade default')).toBeInTheDocument();
    const none = within(level('Cost rate levels', 'No cost rate'));
    expect(none.getByText('£0.00/h')).toBeInTheDocument();
  });

  it('asks again when the same question is checked again', async () => {
    const queries: URLSearchParams[] = [];
    server.use(answer((params) => queries.push(params)));
    const user = userEvent.setup();
    renderInOrg(<RatePreviewPage />, { route: OWNER_QUERY });
    await screen.findByRole('table', { name: 'Charge-out rate levels' });
    expect(queries).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Check rate' }));
    await waitFor(() => expect(queries).toHaveLength(2));
  });

  it('explains a refusal and retries', async () => {
    let fails = true;
    server.use(
      http.get(orgApiPath('/rates/resolve'), () =>
        fails ? fail(404, 'RESOURCE_NOT_FOUND', 'The job does not exist.') : ok(resolution),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<RatePreviewPage />, { route: OWNER_QUERY });

    expect(await screen.findByText('Could not work out the rate')).toBeInTheDocument();
    expect(screen.getByText('The job does not exist.')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('table', { name: 'Charge-out rate levels' }),
    ).toBeInTheDocument();
  });

  it('shows a status while the rate is being worked out', () => {
    server.use(http.get(orgApiPath('/rates/resolve'), () => new Promise(() => undefined)));
    renderInOrg(<RatePreviewPage />, { route: OWNER_QUERY });
    expect(screen.getByRole('status', { name: 'Working out the rate' })).toBeInTheDocument();
  });

  it('clears the form and the answer', async () => {
    server.use(answer());
    const user = userEvent.setup();
    renderInOrg(<RatePreviewPage />, { route: OWNER_QUERY });
    await screen.findByRole('table', { name: 'Charge-out rate levels' });

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(await screen.findByText('Choose who the rate is for')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Charge-out rate levels' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Service' })).toHaveValue('');
  });
});
