import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, ownerContext, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import { archivedVat, exemptVat, reducedVat, standardVat, zeroVat } from '../test/billingFixtures';
import {
  billingHandlers,
  createBillingBackend,
  orgApiPath,
  type BillingBackend,
} from '../test/billingHandlers';
import VatCodesPage from './VatCodesPage';

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

async function chooseAction(user: User, name: string, action: string) {
  const menu = await openActions(user, name);
  await user.click(within(menu).getByRole('menuitem', { name: action }));
}

const closed = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

/** The text of the first cell of every row, top to bottom. */
const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((entry) => within(entry).getAllByRole('cell')[0]?.textContent ?? '');

let backend: BillingBackend;

beforeEach(() => {
  backend = createBillingBackend();
  server.use(...billingHandlers(backend));
});

describe('VatCodesPage: the list', () => {
  it('lists every VAT code, archived ones too, with code, rate, default and status', async () => {
    renderInOrg(<VatCodesPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'VAT Codes' })).toBeInTheDocument();
    const standard = within(await row(/^Standard 20%/));
    expect(standard.getByText('Standard', { selector: 'span' })).toBeInTheDocument();
    expect(standard.getByText('20%')).toBeInTheDocument();
    expect(standard.getByText('Default')).toBeInTheDocument();
    expect(standard.getByText('Active')).toBeInTheDocument();

    const reduced = within(await row(/^Reduced 5%/));
    expect(reduced.getByText('5%')).toBeInTheDocument();
    expect(reduced.getByText('—')).toBeInTheDocument();

    const zero = within(await row(/^Zero rated/));
    expect(zero.getAllByText('0%')).toHaveLength(1);
    expect(
      zero.getByText('Zero rated', { selector: 'span:not(.font-semibold)' }),
    ).toBeInTheDocument();

    const old = within(await row(/^Old 17.5%/));
    expect(old.getByText('17.5%')).toBeInTheDocument();
    expect(old.getByText('Archived', { selector: 'span' })).toBeInTheDocument();

    expect(await screen.findByRole('tab', { name: /^All VAT codes\s*6$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /^Active\s*5$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Archived\s*1$/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 6 of 6 VAT codes')).toBeInTheDocument();
    // One request, and it asks for the archived codes as well.
    expect(backend.calls.vatLists).toHaveLength(1);
    expect(backend.calls.vatLists[0]?.get('include_archived')).toBe('true');
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/vat-rates'), () => new Promise(() => undefined)));
    renderInOrg(<VatCodesPage />);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('filters by tab and by quick search', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await row(/^Standard 20%/);

    await user.click(screen.getByRole('tab', { name: /^Archived/ }));
    await waitFor(() => expect(names()).toEqual(['Old 17.5%']));
    await user.click(screen.getByRole('tab', { name: /^Active/ }));
    await waitFor(() => expect(names()).not.toContain('Old 17.5%'));
    expect(names()).toHaveLength(5);

    await user.click(screen.getByRole('tab', { name: /^All VAT codes/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search VAT codes' }), 'exempt');
    await waitFor(() => expect(names()).toEqual(['Exempt']));
  });

  it('sorts by a header, ascending then descending', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await row(/^Standard 20%/);
    // As the API sends them until a header is chosen.
    expect(names()[0]).toBe('Standard 20%');

    await user.click(screen.getByRole('button', { name: 'Rate' }));
    // Equal rates keep the order the API sent them in.
    expect(names()).toEqual([
      'Zero rated',
      'Exempt',
      'Outside the scope',
      'Reduced 5%',
      'Old 17.5%',
      'Standard 20%',
    ]);
    expect(screen.getByRole('columnheader', { name: /Rate/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: 'Rate' }));
    expect(names()[0]).toBe('Standard 20%');
    expect(names().at(-1)).toBe('Outside the scope');
  });

  it('hides and shows columns', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await row(/^Standard 20%/);

    expect(screen.getByRole('columnheader', { name: 'Default' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show/Hide Columns' }));
    await user.click(screen.getByRole('checkbox', { name: 'Default' }));
    expect(screen.queryByRole('columnheader', { name: 'Default' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Name' })).toBeDisabled();
  });

  it('shows the empty state, the no-match state and the error state with a retry', async () => {
    const user = userEvent.setup();
    backend.vatRates = [];
    const first = renderInOrg(<VatCodesPage />);
    expect(await screen.findByText('No VAT codes yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add VAT code' })).toHaveLength(2);
    await user.type(screen.getByRole('searchbox', { name: 'Search VAT codes' }), 'zzz');
    expect(await screen.findByText('No VAT codes match')).toBeInTheDocument();
    first.unmount();

    let failing = true;
    server.use(
      http.get(orgApiPath('/vat-rates'), () =>
        failing ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok([zeroVat]),
      ),
    );
    renderInOrg(<VatCodesPage />);
    expect(await screen.findByText('Could not load the VAT codes')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/^Zero rated/)).toBeInTheDocument();
  });

  it('reminds a practice that is not VAT registered that every line carries 0%', async () => {
    const context = {
      ...ownerContext,
      organization: { ...ownerContext.organization, vat_registered: false },
    };
    renderInOrg(<VatCodesPage />, { context });
    expect(await screen.findByText(/This practice is not VAT registered/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change this in Practice Settings' })).toHaveAttribute(
      'href',
      '/acme/settings/practice',
    );
  });

  it('does not show that reminder to a VAT registered practice', async () => {
    renderInOrg(<VatCodesPage />);
    await row(/^Standard 20%/);
    expect(screen.queryByText(/not VAT registered/)).not.toBeInTheDocument();
  });
});

describe('VatCodesPage: permissions', () => {
  it('lets any member read the list but offers no change without settings.manage', async () => {
    renderInOrg(<VatCodesPage />, { context: contextWith(STAFF_PERMISSIONS) });
    expect(await row(/^Standard 20%/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add VAT code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Changing VAT codes needs permission to manage settings/),
    ).toBeInTheDocument();
  });

  it('offers the actions each code allows to a manager', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);

    expect(menuItems(await openActions(user, 'Standard 20%'))).toEqual([
      'Edit',
      'Archive',
      'Delete',
    ]);
    await user.keyboard('{Escape}');
    expect(menuItems(await openActions(user, 'Reduced 5%'))).toEqual([
      'Edit',
      'Make default',
      'Archive',
      'Delete',
    ]);
    await user.keyboard('{Escape}');
    // An archived code is not edited or made the default: it is restored or deleted.
    expect(menuItems(await openActions(user, 'Old 17.5%'))).toEqual(['Restore', 'Delete']);
  });
});

describe('VatRateFormDialog: adding', () => {
  it('adds a VAT code and sends exactly the typed fields', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add VAT code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add VAT code' });

    // A new code starts as Standard, not the default, with the rate still to type.
    expect(within(dialog).getByRole('combobox', { name: 'Code' })).toHaveValue('standard');
    expect(within(dialog).getByRole('textbox', { name: 'Rate (%)' })).toHaveValue('');
    expect(within(dialog).getByRole('checkbox', { name: /default VAT code/ })).not.toBeChecked();
    expect(
      within(within(dialog).getByRole('combobox', { name: 'Code' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Standard', 'Reduced', 'Zero rated', 'Exempt', 'Outside scope']);

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), '  Flat rate 17.5%  ');
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate (%)' }), '17.5');
    await user.click(within(dialog).getByRole('button', { name: 'Add VAT code' }));

    expect(await screen.findByText('Flat rate 17.5% added')).toBeInTheDocument();
    expect(backend.calls.vatCreates).toEqual([
      { name: 'Flat rate 17.5%', code: 'standard', rate_bp: 1750 },
    ]);
    await closed('Add VAT code');
    expect(await row(/^Flat rate 17.5%/)).toBeInTheDocument();
    expect(screen.getByText('Showing 7 of 7 VAT codes')).toBeInTheDocument();
  });

  it('makes the new code the default when asked', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add VAT code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add VAT code' });

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Reduced 12.5%');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Code' }), 'Reduced');
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate (%)' }), '12.5');
    await user.click(within(dialog).getByRole('checkbox', { name: /default VAT code/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add VAT code' }));

    await screen.findByText('Reduced 12.5% added');
    expect(backend.calls.vatCreates).toEqual([
      { name: 'Reduced 12.5%', code: 'reduced', rate_bp: 1250, is_default: true },
    ]);
    // The old default lost its badge: exactly one code is the default.
    expect(within(await row(/^Reduced 12.5%/)).getByText('Default')).toBeInTheDocument();
    expect(within(await row(/^Standard 20%/)).queryByText('Default')).not.toBeInTheDocument();
  });

  it('fixes the rate at 0% for the codes that charge no VAT', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add VAT code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add VAT code' });

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Zero rated (export)');
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate (%)' }), '20');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Code' }), 'Zero rated');
    const rate = within(dialog).getByRole('textbox', { name: 'Rate (%)' });
    expect(rate).toHaveValue('0');
    expect(rate).toBeDisabled();
    expect(
      within(dialog).getByText('Zero rated, exempt and outside scope always charge 0%.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add VAT code' }));

    await screen.findByText('Zero rated (export) added');
    expect(backend.calls.vatCreates).toEqual([
      { name: 'Zero rated (export)', code: 'zero', rate_bp: 0 },
    ]);

    // Back to a taxed code: the rate can be typed again.
    await closed('Add VAT code');
    await user.click(screen.getByRole('button', { name: 'Add VAT code' }));
    const second = await screen.findByRole('dialog', { name: 'Add VAT code' });
    await user.selectOptions(within(second).getByRole('combobox', { name: 'Code' }), 'Exempt');
    expect(within(second).getByRole('textbox', { name: 'Rate (%)' })).toBeDisabled();
    await user.selectOptions(within(second).getByRole('combobox', { name: 'Code' }), 'Reduced');
    expect(within(second).getByRole('textbox', { name: 'Rate (%)' })).toBeEnabled();
  });

  it('validates the fields before sending anything', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add VAT code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add VAT code' });

    await user.click(within(dialog).getByRole('button', { name: 'Add VAT code' }));
    expect(await within(dialog).findByText('Enter a name for the VAT code')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Enter a rate from 0 to 100, with at most two decimals'),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Too high');
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate (%)' }), '100.5');
    await user.click(within(dialog).getByRole('button', { name: 'Add VAT code' }));
    await waitFor(() =>
      expect(within(dialog).queryByText('Enter a name for the VAT code')).not.toBeInTheDocument(),
    );
    expect(
      within(dialog).getByText('Enter a rate from 0 to 100, with at most two decimals'),
    ).toBeInTheDocument();
    expect(backend.calls.vatCreates).toHaveLength(0);

    const rate = within(dialog).getByRole('textbox', { name: 'Rate (%)' });
    await user.clear(rate);
    await user.type(rate, '12.345');
    await user.click(within(dialog).getByRole('button', { name: 'Add VAT code' }));
    expect(
      await within(dialog).findByText('Enter a rate from 0 to 100, with at most two decimals'),
    ).toBeInTheDocument();
    expect(backend.calls.vatCreates).toHaveLength(0);
  });

  it('shows a duplicate name on its field and keeps the dialog open', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add VAT code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add VAT code' });

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'reduced 5%');
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate (%)' }), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Add VAT code' }));

    expect(
      await within(dialog).findByText('A VAT rate with this name exists.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
      /A VAT rate with this name exists\./,
    );
    expect(screen.getByRole('dialog', { name: 'Add VAT code' })).toBeInTheDocument();
    expect(backend.calls.vatCreates).toHaveLength(1);
  });

  it('explains a refusal that belongs to no field', async () => {
    server.use(
      http.post(orgApiPath('/vat-rates'), () =>
        fail(403, 'PERMISSION_DENIED', 'You need settings.manage to add VAT codes.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add VAT code' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add VAT code' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Another');
    await user.type(within(dialog).getByRole('textbox', { name: 'Rate (%)' }), '8');
    await user.click(within(dialog).getByRole('button', { name: 'Add VAT code' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You need settings.manage to add VAT codes.',
    );
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Another');
  });
});

describe('VatRateFormDialog: editing', () => {
  it('opens with the saved values, saves only what changed and keeps the rest', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await chooseAction(user, 'Reduced 5%', 'Edit');
    const dialog = await screen.findByRole('dialog', { name: 'Edit VAT code' });

    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Reduced 5%');
    expect(within(dialog).getByRole('combobox', { name: 'Code' })).toHaveValue('reduced');
    expect(within(dialog).getByRole('textbox', { name: 'Rate (%)' })).toHaveValue('5');
    expect(
      within(dialog).getByText(/Issued invoices keep the rate they were issued with/),
    ).toBeInTheDocument();
    // The default is changed with the row action, not here.
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    // Nothing changed, nothing to save.
    expect(within(dialog).getByRole('button', { name: 'Save VAT code' })).toBeDisabled();

    const rate = within(dialog).getByRole('textbox', { name: 'Rate (%)' });
    await user.clear(rate);
    await user.type(rate, '5.5');
    await user.click(within(dialog).getByRole('button', { name: 'Save VAT code' }));

    expect(await screen.findByText('Reduced 5% saved')).toBeInTheDocument();
    expect(backend.calls.vatUpdates).toEqual([{ id: reducedVat.id, body: { rate_bp: 550 } }]);
    await closed('Edit VAT code');
    expect(within(await row(/^Reduced 5%/)).getByText('5.5%')).toBeInTheDocument();
  });

  it('renames a code and changes its treatment in one request', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await chooseAction(user, 'Standard 20%', 'Edit');
    const dialog = await screen.findByRole('dialog', { name: 'Edit VAT code' });

    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Exempt supplies');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Code' }), 'Exempt');
    // The rate follows the treatment.
    expect(within(dialog).getByRole('textbox', { name: 'Rate (%)' })).toHaveValue('0');
    await user.click(within(dialog).getByRole('button', { name: 'Save VAT code' }));

    await screen.findByText('Exempt supplies saved');
    expect(backend.calls.vatUpdates).toEqual([
      { id: standardVat.id, body: { name: 'Exempt supplies', code: 'exempt', rate_bp: 0 } },
    ]);
  });

  it('shows a duplicate name on the field when renaming', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await chooseAction(user, 'Reduced 5%', 'Edit');
    const dialog = await screen.findByRole('dialog', { name: 'Edit VAT code' });
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'EXEMPT');
    await user.click(within(dialog).getByRole('button', { name: 'Save VAT code' }));

    expect(
      await within(dialog).findByText('A VAT rate with this name exists.'),
    ).toBeInTheDocument();
    expect(backend.calls.vatUpdates).toEqual([{ id: reducedVat.id, body: { name: 'EXEMPT' } }]);
    expect(screen.getByRole('dialog', { name: 'Edit VAT code' })).toBeInTheDocument();
  });
});

describe('VatCodesPage: default, archive, restore and delete', () => {
  it('makes a code the default', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await chooseAction(user, 'Reduced 5%', 'Make default');

    expect(await screen.findByText('Reduced 5% is now the default VAT code')).toBeInTheDocument();
    expect(backend.calls.vatUpdates).toEqual([{ id: reducedVat.id, body: { is_default: true } }]);
    await waitFor(() =>
      expect(
        within(screen.getByRole('row', { name: /^Reduced 5%/ })).getByText('Default'),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole('row', { name: /^Standard 20%/ })).queryByText('Default'),
    ).not.toBeInTheDocument();
  });

  it('asks before archiving, warns about the default, then archives', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await chooseAction(user, 'Standard 20%', 'Archive');

    const dialog = await screen.findByRole('dialog', { name: 'Archive VAT code?' });
    expect(dialog).toHaveTextContent('It is the default VAT code');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await closed('Archive VAT code?');
    expect(backend.calls.vatUpdates).toEqual([]);

    await chooseAction(user, 'Standard 20%', 'Archive');
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Archive VAT code?' })).getByRole('button', {
        name: 'Archive',
      }),
    );
    expect(await screen.findByText('Standard 20% archived')).toBeInTheDocument();
    expect(backend.calls.vatUpdates).toEqual([{ id: standardVat.id, body: { is_archived: true } }]);
    await waitFor(() =>
      expect(
        within(screen.getByRole('row', { name: /^Standard 20%/ })).getByText('Archived'),
      ).toBeInTheDocument(),
    );
    // Archiving cleared the default flag.
    expect(
      within(screen.getByRole('row', { name: /^Standard 20%/ })).queryByText('Default'),
    ).not.toBeInTheDocument();
  });

  it('restores an archived code without asking', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await chooseAction(user, 'Old 17.5%', 'Restore');

    expect(await screen.findByText('Old 17.5% restored')).toBeInTheDocument();
    expect(backend.calls.vatUpdates).toEqual([
      { id: archivedVat.id, body: { is_archived: false } },
    ]);
    await waitFor(() =>
      expect(
        within(screen.getByRole('row', { name: /^Old 17.5%/ })).getByText('Active'),
      ).toBeInTheDocument(),
    );
  });

  it('deletes an unused code after a confirmation', async () => {
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await chooseAction(user, 'Exempt', 'Delete');

    const dialog = await screen.findByRole('dialog', { name: 'Delete VAT code?' });
    expect(dialog).toHaveTextContent('is removed completely when nothing uses it');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await closed('Delete VAT code?');
    expect(backend.calls.vatDeletes).toEqual([]);

    await chooseAction(user, 'Exempt', 'Delete');
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete VAT code?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(await screen.findByText('Exempt deleted')).toBeInTheDocument();
    expect(backend.calls.vatDeletes).toEqual([exemptVat.id]);
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Exempt/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Showing 5 of 5 VAT codes')).toBeInTheDocument();
  });

  it('says a used code was archived instead of deleted', async () => {
    backend.usedVatRates.add(reducedVat.id);
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await chooseAction(user, 'Reduced 5%', 'Delete');
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete VAT code?' })).getByRole('button', {
        name: 'Delete',
      }),
    );

    expect(await screen.findByText('Reduced 5% archived instead')).toBeInTheDocument();
    expect(
      screen.getByText(
        'A service, activity type, client, expense or invoice line uses it, so it was kept.',
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByRole('row', { name: /^Reduced 5%/ })).getByText('Archived'),
      ).toBeInTheDocument(),
    );
  });

  it('keeps the dialog open and explains a refused delete', async () => {
    server.use(
      http.delete(orgApiPath(`/vat-rates/${zeroVat.id}`), () =>
        fail(403, 'PERMISSION_DENIED', 'You need settings.manage to delete VAT codes.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await chooseAction(user, 'Zero rated', 'Delete');
    const dialog = await screen.findByRole('dialog', { name: 'Delete VAT code?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You need settings.manage to delete VAT codes.',
    );
    expect(screen.getByRole('dialog', { name: 'Delete VAT code?' })).toBeInTheDocument();
  });

  it('tells the person when a quick action is refused', async () => {
    server.use(
      http.patch(orgApiPath(`/vat-rates/${reducedVat.id}`), () =>
        fail(403, 'PERMISSION_DENIED', 'You need settings.manage.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<VatCodesPage />);
    await chooseAction(user, 'Reduced 5%', 'Make default');
    expect(await screen.findByText("You don't have permission to do that")).toBeInTheDocument();
  });
});
