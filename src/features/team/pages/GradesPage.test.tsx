import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { grade, juniorGrade, partnerGrade, seniorGrade } from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import GradesPage from './GradesPage';

type User = ReturnType<typeof userEvent.setup>;

const row = (name: RegExp) => screen.findByRole('row', { name });

async function openActions(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  return screen.findByRole('menu', { name: `Actions for ${name}` });
}

async function openAdd(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Add grade' }));
  return screen.findByRole('region', { name: 'Add grade' });
}

const READ_ONLY = ['member.read', 'rate.read'];
const MANAGER = ['member.read', 'rate.manage'];

beforeEach(() => {
  server.use(...teamHandlers());
});

describe('GradesPage list', () => {
  it('lists the grades with rates, target, staff count and status', async () => {
    renderInOrg(<GradesPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Grades' })).toBeInTheDocument();
    const partner = await row(/^Partner/);
    const cells = within(partner);
    expect(cells.getByText('PTR')).toBeInTheDocument();
    expect(cells.getByText('£90.00/h')).toBeInTheDocument();
    expect(cells.getByText('£250.00/h')).toBeInTheDocument();
    expect(cells.getByText('50%')).toBeInTheDocument();
    expect(cells.getByText('Active')).toBeInTheDocument();

    const senior = await row(/^Senior/);
    expect(within(senior).getByText('Runs engagements')).toBeInTheDocument();
    expect(within(senior).getByText('2')).toBeInTheDocument();

    const junior = await row(/^Junior/);
    expect(within(junior).getByText('Inactive')).toBeInTheDocument();
    // A grade without defaults shows a dash, not zero.
    expect(within(junior).getAllByText('—')).toHaveLength(2);

    // In the practice's order; the tab counts what is loaded.
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((entry) => within(entry).getAllByRole('cell')[0]?.textContent?.slice(0, 6));
    expect(names).toEqual(['Partne', 'Senior', 'Junior']);
    expect(await screen.findByRole('tab', { name: /^All grades\s*3$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Showing 3 grades · End of the list')).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/grades'), () => new Promise(() => undefined)));
    renderInOrg(<GradesPage />);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('filters by status and quick search and sorts on the server', async () => {
    const queries: URLSearchParams[] = [];
    server.use(...teamHandlers({ onGradeList: (params) => queries.push(params) }));
    const user = userEvent.setup();
    renderInOrg(<GradesPage />);
    await row(/^Partner/);

    await user.click(screen.getByRole('tab', { name: 'Inactive' }));
    await waitFor(() => expect(queries.at(-1)?.get('is_active')).toBe('false'));
    expect(await row(/^Junior/)).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^Partner/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'All grades' }));
    await row(/^Partner/);
    await user.type(screen.getByRole('searchbox', { name: 'Search grades' }), 'sen');
    await waitFor(() => expect(queries.at(-1)?.get('q')).toBe('sen'));
    expect(await row(/^Senior/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Name' }));
    await waitFor(() => expect(queries.at(-1)?.get('sort')).toBe('name'));
    expect(queries.at(-1)?.get('order')).toBe('asc');
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('hides the cost column and field without rate.read', async () => {
    const user = userEvent.setup();
    renderInOrg(<GradesPage />, { context: contextWith(MANAGER) });
    await row(/^Partner/);
    expect(
      screen.queryByRole('columnheader', { name: /Default cost rate/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('£90.00/h')).not.toBeInTheDocument();

    const dialog = await openAdd(user);
    expect(within(dialog).queryByRole('textbox', { name: /cost rate/i })).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole('textbox', { name: /Default charge-out rate/ }),
    ).toBeInTheDocument();
  });

  it('shows the empty state, the no-match state and the error state with a retry', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers({ grades: [] }));
    const first = renderInOrg(<GradesPage />);
    expect(await screen.findByText('No grades yet')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search grades' }), 'zzz');
    expect(await screen.findByText('No grades match')).toBeInTheDocument();
    first.unmount();

    let fails = true;
    server.use(
      http.get(orgApiPath('/grades'), () =>
        fails
          ? fail(500, 'INTERNAL_ERROR', 'Boom.')
          : ok([partnerGrade], { meta: { next_cursor: null, has_more: false } }),
      ),
    );
    renderInOrg(<GradesPage />);
    expect(await screen.findByText('Could not load the grades')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/^Partner/)).toBeInTheDocument();
  });

  it('explains missing access without member.read', () => {
    renderInOrg(<GradesPage />, { context: contextWith([]) });
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
  });

  it('hides Add grade and the row actions without rate.manage', async () => {
    renderInOrg(<GradesPage />, { context: contextWith(READ_ONLY) });
    await row(/^Partner/);
    expect(screen.queryByRole('button', { name: 'Add grade' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
  });
});

describe('GradesPage forms', () => {
  it('adds a grade and sends exactly the filled fields', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath('/grades'), async ({ request }) => {
        body = await request.json();
        return ok(grade('grade-new', 'DIR', 'Director'), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<GradesPage />);

    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Director');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'dir');
    await user.type(within(dialog).getByRole('textbox', { name: 'Description' }), 'Leads a team');
    await user.type(within(dialog).getByRole('textbox', { name: /Default cost rate/ }), '1,234.50');
    await user.type(
      within(dialog).getByRole('textbox', { name: /Default charge-out rate/ }),
      '300',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: /Default chargeable target/ }),
      '62.5',
    );
    const order = within(dialog).getByRole('textbox', { name: 'Sort order' });
    await user.clear(order);
    await user.type(order, '4');
    await user.click(within(dialog).getByRole('button', { name: 'Add grade' }));

    expect(await screen.findByText('Director added')).toBeInTheDocument();
    expect(body).toEqual({
      code: 'DIR',
      name: 'Director',
      description: 'Leads a team',
      default_cost_rate: 123450,
      default_charge_rate: 30000,
      default_chargeable_target_bp: 6250,
      sort_order: 4,
    });
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Add grade' })).not.toBeInTheDocument(),
    );
  });

  it('validates the fields before sending anything', async () => {
    let posted = 0;
    server.use(
      http.post(orgApiPath('/grades'), () => {
        posted += 1;
        return ok({}, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<GradesPage />);

    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'bad code!');
    await user.type(within(dialog).getByRole('textbox', { name: /Default cost rate/ }), 'abc');
    await user.type(
      within(dialog).getByRole('textbox', { name: /Default charge-out rate/ }),
      '1.234',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: /Default chargeable target/ }),
      '150',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add grade' }));

    expect(await within(dialog).findByText('Enter the grade name')).toBeInTheDocument();
    expect(within(dialog).getByText("Use 1–12 letters, digits, '_' or '-'")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Enter a rate in pounds per hour, for example 45.00/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/for example 120.00/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Enter a percentage from 0 to 100/)).toBeInTheDocument();
    expect(posted).toBe(0);
  });

  it('puts a duplicate code and a duplicate name on their fields', async () => {
    let attempt = 0;
    server.use(
      http.post(orgApiPath('/grades'), () => {
        attempt += 1;
        return attempt === 1
          ? fail(409, 'GRADE_CODE_TAKEN', 'Another grade already uses this code.', {
              details: [
                {
                  field: 'code',
                  code: 'duplicate',
                  message: 'Another grade already uses this code.',
                },
              ],
            })
          : fail(409, 'GRADE_NAME_TAKEN', 'Another grade already has this name.');
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<GradesPage />);

    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Partner');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'PTR');
    await user.click(within(dialog).getByRole('button', { name: 'Add grade' }));
    const code = within(dialog).getByRole('textbox', { name: 'Code' });
    await waitFor(() => expect(code).toHaveAttribute('aria-invalid', 'true'));
    expect(code).toHaveAccessibleDescription('Another grade already uses this code.');

    await user.click(within(dialog).getByRole('button', { name: 'Add grade' }));
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    expect(name).toHaveAccessibleDescription('Another grade already has this name.');
  });

  it('edits a grade and sends only what changed, clearing a default with null', async () => {
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/grades/${seniorGrade.id}`), async ({ request }) => {
        body = await request.json();
        return ok({ ...seniorGrade, name: 'Senior accountant' });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<GradesPage />);

    await openActions(user, 'Senior');
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('region', { name: 'Edit grade' });
    expect(within(dialog).getByRole('textbox', { name: /Default cost rate/ })).toHaveValue('30.00');
    expect(within(dialog).getByRole('textbox', { name: /Default charge-out rate/ })).toHaveValue(
      '120.00',
    );
    expect(within(dialog).getByRole('textbox', { name: /Default chargeable target/ })).toHaveValue(
      '75',
    );
    expect(within(dialog).getByRole('button', { name: 'Save grade' })).toBeDisabled();

    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Senior accountant');
    await user.clear(within(dialog).getByRole('textbox', { name: /Default charge-out rate/ }));
    await user.clear(within(dialog).getByRole('textbox', { name: 'Description' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save grade' }));

    expect(await screen.findByText('Senior accountant saved')).toBeInTheDocument();
    expect(body).toEqual({
      name: 'Senior accountant',
      description: null,
      default_charge_rate: null,
    });
  });

  it('never sends the cost default when the person cannot see it', async () => {
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/grades/${seniorGrade.id}`), async ({ request }) => {
        body = await request.json();
        return ok(seniorGrade);
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<GradesPage />, { context: contextWith(MANAGER) });

    await openActions(user, 'Senior');
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('region', { name: 'Edit grade' });
    const target = within(dialog).getByRole('textbox', { name: /Default chargeable target/ });
    await user.clear(target);
    await user.type(target, '70');
    await user.click(within(dialog).getByRole('button', { name: 'Save grade' }));

    await screen.findByText('Senior saved');
    expect(body).toEqual({ default_chargeable_target_bp: 7000 });
  });
});

describe('GradesPage row actions', () => {
  it('activates and deactivates a grade', async () => {
    const calls: string[] = [];
    server.use(
      http.post(orgApiPath(`/grades/${juniorGrade.id}/activate`), () => {
        calls.push('activate');
        return ok({ ...juniorGrade, is_active: true });
      }),
      http.post(orgApiPath(`/grades/${partnerGrade.id}/deactivate`), () => {
        calls.push('deactivate');
        return ok({ ...partnerGrade, is_active: false });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<GradesPage />);

    await openActions(user, 'Junior');
    await user.click(screen.getByRole('menuitem', { name: 'Activate' }));
    expect(await screen.findByText('Junior activated')).toBeInTheDocument();

    await openActions(user, 'Partner');
    await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    expect(await screen.findByText('Partner deactivated')).toBeInTheDocument();
    expect(calls).toEqual(['activate', 'deactivate']);
  });

  it('deletes an unused grade after a confirmation', async () => {
    let deleted = 0;
    server.use(
      http.delete(orgApiPath(`/grades/${juniorGrade.id}`), () => {
        deleted += 1;
        return ok({ outcome: 'deleted', id: juniorGrade.id });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<GradesPage />);

    await openActions(user, 'Junior');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete grade?' });
    expect(within(confirm).getByText(/not used by any staff member or rate/)).toBeInTheDocument();
    expect(deleted).toBe(0);
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Junior deleted')).toBeInTheDocument();
    expect(deleted).toBe(1);
  });

  it('explains that a used grade is deactivated instead of deleted', async () => {
    server.use(
      http.delete(orgApiPath(`/grades/${seniorGrade.id}`), () =>
        ok({ outcome: 'deactivated', id: seniorGrade.id }),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<GradesPage />);

    await openActions(user, 'Senior');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Deactivate grade?' });
    expect(within(confirm).getByText(/cannot be deleted/)).toBeInTheDocument();
    expect(within(confirm).getByText(/2 staff members/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Senior deactivated instead')).toBeInTheDocument();
  });

  it('shows a refused delete inside the dialog', async () => {
    server.use(
      http.delete(orgApiPath(`/grades/${juniorGrade.id}`), () =>
        fail(403, 'PERMISSION_DENIED', 'You need rate.manage to do that.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<GradesPage />);

    await openActions(user, 'Junior');
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete grade?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(
      await within(confirm).findByText('You need rate.manage to do that.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Delete grade?' })).toBeInTheDocument();
  });
});
