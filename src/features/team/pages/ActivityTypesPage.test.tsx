import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { activity, bookkeeping, review, standardVat, training } from '../test/fixtures';
import { orgApiPath, teamHandlers } from '../test/handlers';
import ActivityTypesPage from './ActivityTypesPage';

type User = ReturnType<typeof userEvent.setup>;

const row = (name: RegExp) => screen.findByRole('row', { name });

async function openActions(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
  return screen.findByRole('menu', { name: `Actions for ${name}` });
}

const menuItems = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent);

async function openAdd(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Add activity type' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add activity type' });
  // The VAT codes the form offers are loaded with it.
  await within(dialog).findByRole('option', { name: /Standard 20%/ });
  return dialog;
}

async function openEdit(user: User, name: string) {
  const menu = await openActions(user, name);
  await user.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit activity type' });
  await within(dialog).findByRole('option', { name: /Standard 20%/ });
  return dialog;
}

const MEMBER = ['organization.read'];

beforeEach(() => {
  server.use(...teamHandlers());
});

describe('ActivityTypesPage list', () => {
  it('lists the activity types with their billable default, VAT, invoice wording, linked services and status', async () => {
    renderInOrg(<ActivityTypesPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Activity Types' })).toBeInTheDocument();
    const book = within(await row(/^Bookkeeping/));
    expect(book.getByText('BOOK')).toBeInTheDocument();
    expect(book.getByText('Billable')).toBeInTheDocument();
    expect(book.getByText('Standard 20%')).toBeInTheDocument();
    expect(book.getByText('Bookkeeping services')).toBeInTheDocument();
    // The services that limit their time to the type.
    expect(book.getByText('Year-end accounts')).toBeInTheDocument();
    expect(book.getByText('Active')).toBeInTheDocument();

    const train = within(await row(/^Training/));
    expect(train.getByText('Non-billable')).toBeInTheDocument();
    expect(train.getByText('Inactive')).toBeInTheDocument();
    // No VAT code, no invoice description and no service: three dashes.
    expect(train.getAllByText('—')).toHaveLength(3);

    expect(await screen.findByRole('tab', { name: /^All activity types\s*3$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /^Active\s*2$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Inactive\s*1$/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 activity types')).toBeInTheDocument();
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/activity-codes'), () => new Promise(() => undefined)));
    renderInOrg(<ActivityTypesPage />);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('filters by status and quick search, and sorts by a header', async () => {
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);
    await row(/^Bookkeeping/);

    await user.click(screen.getByRole('tab', { name: /^Inactive/ }));
    expect(await row(/^Training/)).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /^Bookkeeping/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^All activity types/ }));

    await user.type(screen.getByRole('searchbox', { name: 'Search activity types' }), 'rev');
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Bookkeeping/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('row', { name: /^Review/ })).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Search activity types' }));
    await row(/^Bookkeeping/);

    const order = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((entry) => within(entry).getAllByRole('cell')[0]?.textContent);
    expect(order()).toEqual(['Bookkeeping', 'Review', 'Training']);
    await user.click(screen.getByRole('button', { name: 'Code' }));
    expect(order()).toEqual(['Bookkeeping', 'Review', 'Training']);
    await user.click(screen.getByRole('button', { name: 'Code' }));
    expect(order()).toEqual(['Training', 'Review', 'Bookkeeping']);
    expect(screen.getByRole('columnheader', { name: /Code/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('shows the empty state, the no-match state and the error state with a retry', async () => {
    const user = userEvent.setup();
    server.use(...teamHandlers({ activities: [] }));
    const first = renderInOrg(<ActivityTypesPage />);
    expect(await screen.findByText('No activity types yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add activity type' })).toHaveLength(2);
    await user.type(screen.getByRole('searchbox', { name: 'Search activity types' }), 'zzz');
    expect(await screen.findByText('No activity types match')).toBeInTheDocument();
    first.unmount();

    let fails = true;
    server.use(
      http.get(orgApiPath('/activity-codes'), () =>
        fails ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok([review]),
      ),
    );
    renderInOrg(<ActivityTypesPage />);
    expect(await screen.findByText('Could not load the activity types')).toBeInTheDocument();
    fails = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/^Review/)).toBeInTheDocument();
  });

  it('lets any member read the list but offers no change without settings.manage', async () => {
    renderInOrg(<ActivityTypesPage />, { context: contextWith(MEMBER) });
    expect(await row(/^Bookkeeping/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add activity type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
  });

  it('activates and deactivates, and offers the matching action', async () => {
    server.use(
      http.post(orgApiPath(`/activity-codes/${review.id}/deactivate`), () =>
        ok({ ...review, is_active: false, status: 'inactive' }),
      ),
      http.post(orgApiPath(`/activity-codes/${training.id}/activate`), () =>
        ok({ ...training, is_active: true, status: 'active' }),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);

    const reviewMenu = await openActions(user, 'Review');
    expect(menuItems(reviewMenu)).toEqual(['Edit', 'Deactivate', 'Delete']);
    await user.click(within(reviewMenu).getByRole('menuitem', { name: 'Deactivate' }));
    expect(await screen.findByText('Review deactivated')).toBeInTheDocument();

    const trainingMenu = await openActions(user, 'Training');
    expect(menuItems(trainingMenu)).toEqual(['Edit', 'Activate', 'Delete']);
    await user.click(within(trainingMenu).getByRole('menuitem', { name: 'Activate' }));
    expect(await screen.findByText('Training activated')).toBeInTheDocument();
  });
});

describe('ActivityTypeFormDialog', () => {
  it('adds an activity type and sends exactly the filled fields', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath('/activity-codes'), async ({ request }) => {
        body = await request.json();
        return ok(activity('act-admin', 'ADM', 'Admin'), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);

    const dialog = await openAdd(user);
    // New types are billable by default, with no VAT code.
    expect(within(dialog).getByRole('checkbox', { name: /Billable by default/ })).toBeChecked();
    expect(within(dialog).getByRole('combobox', { name: 'VAT code' })).toHaveValue('');
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Admin');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'adm');
    await user.click(within(dialog).getByRole('checkbox', { name: /Billable by default/ }));
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'VAT code' }),
      'Standard 20% (20%)',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Invoice description' }),
      'Admin time',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add activity type' }));

    expect(await screen.findByText('Admin added')).toBeInTheDocument();
    expect(body).toEqual({
      code: 'ADM',
      name: 'Admin',
      is_chargeable: false,
      vat_rate_id: standardVat.id,
      invoice_description: 'Admin time',
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add activity type' })).not.toBeInTheDocument(),
    );
  });

  it('sends only the required fields when nothing else is filled', async () => {
    let body: unknown;
    server.use(
      http.post(orgApiPath('/activity-codes'), async ({ request }) => {
        body = await request.json();
        return ok(activity('act-admin', 'ADM', 'Admin'), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);

    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Admin');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'adm');
    await user.click(within(dialog).getByRole('button', { name: 'Add activity type' }));

    expect(await screen.findByText('Admin added')).toBeInTheDocument();
    expect(body).toEqual({ code: 'ADM', name: 'Admin', is_chargeable: true });
  });

  it('validates the fields before sending anything', async () => {
    let posted = 0;
    server.use(
      http.post(orgApiPath('/activity-codes'), () => {
        posted += 1;
        return ok(activity('act-admin', 'ADM', 'Admin'), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);

    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole('button', { name: 'Add activity type' }));
    expect(await within(dialog).findByText('Enter the activity type name')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a code for the activity type')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Admin');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'bad code!');
    await user.click(within(dialog).getByRole('button', { name: 'Add activity type' }));
    expect(
      await within(dialog).findByText("Use 1–12 letters, digits, '_' or '-'"),
    ).toBeInTheDocument();
    expect(posted).toBe(0);
  });

  it('shows a duplicate code or name on its field and keeps the dialog open', async () => {
    let attempt = 0;
    server.use(
      http.post(orgApiPath('/activity-codes'), () => {
        attempt += 1;
        return attempt === 1
          ? fail(409, 'ACTIVITY_CODE_TAKEN', 'An activity type with this code already exists.')
          : fail(409, 'ACTIVITY_NAME_TAKEN', 'An activity type with this name already exists.');
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);

    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Review');
    await user.type(within(dialog).getByRole('textbox', { name: 'Code' }), 'rev');
    await user.click(within(dialog).getByRole('button', { name: 'Add activity type' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: 'Code' })).toHaveAccessibleDescription(
        'An activity type with this code already exists.',
      ),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Add activity type' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
        'An activity type with this name already exists.',
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Add activity type' })).toBeInTheDocument();
  });

  it('edits an activity type, sends only what changed and clears a field with null', async () => {
    let body: unknown;
    server.use(
      http.patch(orgApiPath(`/activity-codes/${bookkeeping.id}`), async ({ request }) => {
        body = await request.json();
        return ok(bookkeeping);
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);

    const dialog = await openEdit(user, 'Bookkeeping');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Bookkeeping');
    expect(within(dialog).getByRole('combobox', { name: 'VAT code' })).toHaveValue(standardVat.id);
    // Where the type is limited to, and where to change it.
    expect(
      within(dialog).getByText(
        /Time on jobs of Year-end accounts may only use the activity types those services list/,
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save activity type' })).toBeDisabled();

    await user.click(within(dialog).getByRole('checkbox', { name: /Billable by default/ }));
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'VAT code' }),
      'No default VAT code',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save activity type' }));

    expect(await screen.findByText('Bookkeeping saved')).toBeInTheDocument();
    expect(body).toEqual({ is_chargeable: false, vat_rate_id: null });
  });

  it('says so when no service limits its time to the type', async () => {
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);
    const dialog = await openEdit(user, 'Training');
    expect(
      within(dialog).getByText(/No service limits its time to this activity type/),
    ).toBeInTheDocument();
  });
});

describe('ActivityTypesPage delete', () => {
  it('deletes an unused activity type after confirmation', async () => {
    let deleted = 0;
    server.use(
      http.delete(orgApiPath(`/activity-codes/${review.id}`), () => {
        deleted += 1;
        return ok({ outcome: 'deleted', id: review.id });
      }),
    );
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);

    // A service lists Review, but the flag from the API decides, and it says unused.
    await user.click(
      within(await openActions(user, 'Review')).getByRole('menuitem', { name: 'Delete' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Delete activity type?' });
    expect(
      within(dialog).getByText(/is not used by any time entry, timer or service/),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Review deleted')).toBeInTheDocument();
    expect(deleted).toBe(1);
  });

  it('explains that a used activity type is deactivated instead, and reports what happened', async () => {
    server.use(
      http.delete(orgApiPath(`/activity-codes/${bookkeeping.id}`), () =>
        ok({ outcome: 'deactivated', id: bookkeeping.id }),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);

    await user.click(
      within(await openActions(user, 'Bookkeeping')).getByRole('menuitem', { name: 'Delete' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate activity type?' });
    expect(within(dialog).getByText(/cannot be deleted/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Bookkeeping deactivated instead')).toBeInTheDocument();
  });

  it('keeps the dialog open with the refusal of the API', async () => {
    server.use(
      http.delete(orgApiPath(`/activity-codes/${review.id}`), () =>
        fail(403, 'PERMISSION_DENIED', 'You need the settings.manage permission.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<ActivityTypesPage />);

    await user.click(
      within(await openActions(user, 'Review')).getByRole('menuitem', { name: 'Delete' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Delete activity type?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(
      await within(dialog).findByText('You need the settings.manage permission.'),
    ).toBeInTheDocument();
  });
});
