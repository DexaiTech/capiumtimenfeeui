import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, ownerContext, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { findRowAction, rowAction, rowActionNames } from '@/test/rowActions';
import { fail, ok, server } from '@/test/server';

import { detailedTemplate, retiredTemplate, summaryTemplate } from '../test/billingFixtures';
import {
  billingHandlers,
  createBillingBackend,
  orgApiPath,
  type BillingBackend,
} from '../test/billingHandlers';
import InvoiceTemplatesPage from './InvoiceTemplatesPage';

type User = ReturnType<typeof userEvent.setup>;

const row = (name: RegExp) => screen.findByRole('row', { name });

/** The names of the actions of a row, once it is on screen. */
async function actionsOf(name: string) {
  await screen.findByRole('group', { name: `Actions for ${name}` });
  return rowActionNames(`Actions for ${name}`);
}

async function chooseAction(user: User, name: string, action: string) {
  await user.click(await findRowAction(`Actions for ${name}`, action));
}

const closed = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

/** The text of the first cell of every row, top to bottom. */
const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((entry) => within(entry).getAllByRole('cell')[0]?.textContent ?? '');

const MEMBER = ['organization.read'];

let backend: BillingBackend;

beforeEach(() => {
  backend = createBillingBackend();
  server.use(...billingHandlers(backend));
});

describe('InvoiceTemplatesPage: the list', () => {
  it('lists the templates with layout, logo, bank details, footer, clients and status', async () => {
    renderInOrg(<InvoiceTemplatesPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Invoice Templates' }),
    ).toBeInTheDocument();
    const standard = within(await row(/^Standard/));
    expect(standard.getByText('Default')).toBeInTheDocument();
    expect(standard.getByText('4 clients')).toBeInTheDocument();
    expect(standard.getAllByText('Shown')).toHaveLength(2);
    expect(standard.getByText('Active')).toBeInTheDocument();

    const detailed = within(await row(/^Detailed time sheets/));
    expect(detailed.getByText('Detailed')).toBeInTheDocument();
    expect(detailed.getByText('Shown')).toBeInTheDocument();
    expect(detailed.getByText('Hidden')).toBeInTheDocument();
    expect(
      detailed.getByText('Registered in England and Wales, company number 01234567.'),
    ).toBeInTheDocument();
    expect(detailed.getByText('2 clients')).toBeInTheDocument();

    const summary = within(await row(/^Summary by job/));
    expect(summary.getByText('Summary')).toBeInTheDocument();
    expect(summary.getByText('No clients')).toBeInTheDocument();
    expect(summary.queryByText('Default')).not.toBeInTheDocument();

    expect(within(await row(/^Retired layout/)).getByText('Inactive')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /^All templates\s*4$/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /^Active\s*3$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Inactive\s*1$/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 4 of 4 templates')).toBeInTheDocument();
    // A manager also asks for the inactive templates.
    expect(backend.calls.templateLists).toHaveLength(1);
    expect(backend.calls.templateLists[0]?.get('include_inactive')).toBe('true');
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/invoice-templates'), () => new Promise(() => undefined)));
    renderInOrg(<InvoiceTemplatesPage />);
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('filters by tab and by quick search', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    await row(/^Standard/);

    await user.click(screen.getByRole('tab', { name: /^Inactive/ }));
    await waitFor(() => expect(names()).toEqual(['Retired layout']));
    await user.click(screen.getByRole('tab', { name: /^Active/ }));
    await waitFor(() => expect(names()).not.toContain('Retired layout'));
    expect(names()).toHaveLength(3);

    await user.click(screen.getByRole('tab', { name: /^All templates/ }));
    // The search also reads the footer text.
    await user.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'england');
    await waitFor(() => expect(names()).toEqual(['Detailed time sheets']));
  });

  it('sorts by the number of clients, most first on the second click', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    await row(/^Standard/);

    await user.click(screen.getByRole('button', { name: 'Used by' }));
    expect(names()[3]).toBe('StandardDefault');
    await user.click(screen.getByRole('button', { name: 'Used by' }));
    expect(names()[0]).toBe('StandardDefault');
    expect(screen.getByRole('columnheader', { name: /Used by/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('shows the no-match state and the error state with a retry', async () => {
    const user = userEvent.setup();
    const first = renderInOrg(<InvoiceTemplatesPage />);
    await row(/^Standard/);
    await user.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'zzz');
    expect(await screen.findByText('No templates match')).toBeInTheDocument();
    first.unmount();

    let failing = true;
    server.use(
      http.get(orgApiPath('/invoice-templates'), () =>
        failing ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok([summaryTemplate]),
      ),
    );
    renderInOrg(<InvoiceTemplatesPage />);
    expect(await screen.findByText('Could not load the invoice templates')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await row(/^Summary by job/)).toBeInTheDocument();
  });

  it('shows the empty state with a way to add the first template', async () => {
    backend.templates = [];
    renderInOrg(<InvoiceTemplatesPage />);
    expect(await screen.findByText('No invoice templates yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add template' })).toHaveLength(2);
  });

  it('explains which template an invoice uses', async () => {
    renderInOrg(<InvoiceTemplatesPage />);
    expect(await screen.findByText('Which template an invoice uses')).toBeInTheDocument();
    expect(
      screen.getByText(/The default template cannot be deactivated or deleted/),
    ).toBeInTheDocument();
  });
});

describe('InvoiceTemplatesPage: permissions', () => {
  it('shows only the active templates to a member and offers nothing but a preview', async () => {
    backend.manager = false;
    renderInOrg(<InvoiceTemplatesPage />, { context: contextWith(MEMBER) });

    expect(await row(/^Standard/)).toBeInTheDocument();
    expect(names()).toHaveLength(3);
    expect(screen.queryByRole('row', { name: /^Retired layout/ })).not.toBeInTheDocument();
    // The inactive templates are not requested: the API would refuse the request.
    expect(backend.calls.templateLists).toHaveLength(1);
    expect(backend.calls.templateLists[0]?.has('include_inactive')).toBe(false);
    // One tab, no way to add or change.
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: /^All templates\s*3$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add template' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Changing templates needs permission to manage settings/),
    ).toBeInTheDocument();
    expect(await actionsOf('Standard')).toEqual(['Preview']);
  });

  it('opens the preview of a template read only', async () => {
    backend.manager = false;
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />, { context: contextWith(STAFF_PERMISSIONS) });
    await chooseAction(user, 'Detailed time sheets', 'Preview');

    const dialog = await screen.findByRole('region', { name: 'Invoice template' });
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Detailed time sheets',
    );
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Layout' })).toBeDisabled();
    expect(within(dialog).getByRole('textbox', { name: 'Footer text' })).toBeDisabled();
    // The preview is there, drawn from the template; there is nothing to save.
    expect(within(dialog).getByRole('region', { name: 'Invoice preview' })).toHaveTextContent(
      'Time',
    );
    expect(within(dialog).queryByRole('button', { name: 'Save template' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await closed('Invoice template');
    expect(backend.calls.templateUpdates).toEqual([]);
  });

  it('offers a manager the actions each template allows', async () => {
    renderInOrg(<InvoiceTemplatesPage />);

    // The default template stays the default and stays active.
    expect(await actionsOf('Standard')).toEqual(['Edit', 'Deactivate', 'Delete']);
    expect(rowAction('Actions for Standard', 'Deactivate')).toBeDisabled();
    expect(rowAction('Actions for Standard', 'Delete')).toBeDisabled();

    expect(await actionsOf('Detailed time sheets')).toEqual([
      'Edit',
      'Make default',
      'Deactivate',
      'Delete',
    ]);
    // An inactive template cannot be made the default.
    expect(await actionsOf('Retired layout')).toEqual(['Edit', 'Activate', 'Delete']);
  });
});

describe('InvoiceTemplateFormPanel: adding', () => {
  async function openAdd(user: User) {
    await user.click(await screen.findByRole('button', { name: 'Add template' }));
    return screen.findByRole('region', { name: 'Add invoice template' });
  }

  it('adds a template with a colour and a watermark, and shows both in the preview', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const dialog = await openAdd(user);
    expect(within(dialog).getByRole('button', { name: 'No colour' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByTestId('preview-watermark')).not.toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Branded');
    await user.click(within(dialog).getByRole('button', { name: 'Blue' }));
    expect(within(dialog).getByRole('button', { name: 'Blue' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.type(within(dialog).getByRole('textbox', { name: 'Watermark' }), 'COPY');
    expect(screen.getByTestId('preview-watermark')).toHaveTextContent('COPY');
    const preview = within(dialog).getByRole('region', { name: 'Invoice preview' });
    expect(within(preview).getByText('Invoice')).toHaveStyle({ color: '#1F5CE6' });

    await user.click(within(dialog).getByRole('button', { name: 'Add template' }));
    expect(await screen.findByText('Branded added')).toBeInTheDocument();
    expect(backend.calls.templateCreates).toEqual([
      expect.objectContaining({ name: 'Branded', accent_color: '#1F5CE6', watermark_text: 'COPY' }),
    ]);
  });

  it('refuses a watermark with characters the PDF cannot print', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Odd');
    await user.type(within(dialog).getByRole('textbox', { name: 'Watermark' }), 'a<b>');
    await user.click(within(dialog).getByRole('button', { name: 'Add template' }));
    expect(
      await within(dialog).findByText('Use up to 24 letters, digits, spaces and hyphens'),
    ).toBeInTheDocument();
    expect(backend.calls.templateCreates).toEqual([]);
  });

  it('adds a template and sends the fields it was given', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const dialog = await openAdd(user);

    // A new template starts as Standard, with the logo and the bank details printed.
    expect(within(dialog).getByRole('combobox', { name: 'Layout' })).toHaveValue('standard');
    expect(within(dialog).getByRole('checkbox', { name: /Show the practice logo/ })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Show the bank details/ })).toBeChecked();
    expect(within(dialog).getByRole('textbox', { name: 'Footer text' })).toHaveValue('');
    expect(
      within(within(dialog).getByRole('combobox', { name: 'Layout' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Standard', 'Detailed (every time entry)', 'Summary (one line per job)']);

    await user.type(
      within(dialog).getByRole('textbox', { name: 'Name' }),
      '  Summary with terms  ',
    );
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Layout' }),
      'Summary (one line per job)',
    );
    await user.click(within(dialog).getByRole('checkbox', { name: /Show the practice logo/ }));
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Footer text' }),
      'Pay within 14 days.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add template' }));

    expect(await screen.findByText('Summary with terms added')).toBeInTheDocument();
    expect(backend.calls.templateCreates).toEqual([
      {
        name: 'Summary with terms',
        layout: 'summary',
        show_logo: false,
        show_bank_details: true,
        footer_text: 'Pay within 14 days.',
      },
    ]);
    await closed('Add invoice template');
    expect(await row(/^Summary with terms/)).toBeInTheDocument();
    expect(screen.getByText('Showing 5 of 5 templates')).toBeInTheDocument();
  });

  it('sends no footer when it is left blank', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Plain');
    await user.type(within(dialog).getByRole('textbox', { name: 'Footer text' }), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Add template' }));

    await screen.findByText('Plain added');
    expect(backend.calls.templateCreates).toEqual([
      { name: 'Plain', layout: 'standard', show_logo: true, show_bank_details: true },
    ]);
  });

  it('validates the name and the length of the footer before sending anything', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const dialog = await openAdd(user);

    await user.click(within(dialog).getByRole('button', { name: 'Add template' }));
    expect(await within(dialog).findByText('Enter a name for the template')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'n'.repeat(81) },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Footer text' }), {
      target: { value: 'f'.repeat(1001) },
    });
    expect(within(dialog).getByText(/1001\/1000 characters/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add template' }));
    expect(await within(dialog).findByText('Use at most 80 characters')).toBeInTheDocument();
    expect(within(dialog).getByText('Use at most 1000 characters')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toBeInvalid();
    expect(backend.calls.templateCreates).toHaveLength(0);
  });

  it('shows a duplicate name on its field and keeps the dialog open', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'standard');
    await user.click(within(dialog).getByRole('button', { name: 'Add template' }));

    expect(
      await within(dialog).findByText('A template with this name already exists.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toBeInvalid();
    expect(screen.getByRole('region', { name: 'Add invoice template' })).toBeInTheDocument();
  });

  it('explains a refusal that belongs to no field', async () => {
    server.use(
      http.post(orgApiPath('/invoice-templates'), () =>
        fail(403, 'PERMISSION_DENIED', 'You need settings.manage to add templates.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const dialog = await openAdd(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Another');
    await user.click(within(dialog).getByRole('button', { name: 'Add template' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You need settings.manage to add templates.',
    );
  });
});

describe('InvoiceTemplateFormPanel: the preview', () => {
  async function openAdd(user: User) {
    await user.click(await screen.findByRole('button', { name: 'Add template' }));
    const dialog = await screen.findByRole('region', { name: 'Add invoice template' });
    return { dialog, preview: within(dialog).getByRole('region', { name: 'Invoice preview' }) };
  }

  it('draws the practice, sample lines and totals, and says it is sample data', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const { preview } = await openAdd(user);
    const sample = within(preview);

    expect(sample.getByText('Sample data')).toBeInTheDocument();
    expect(sample.getByText('Acme Accountants')).toBeInTheDocument();
    expect(sample.getByText(/1 High Street/)).toBeInTheDocument();
    expect(sample.getByText('VAT no. GB123456789')).toBeInTheDocument();
    expect(sample.getByText('Sample Client Ltd')).toBeInTheDocument();
    expect(sample.getByText('INV-00042')).toBeInTheDocument();
    // Issued on 01/10/2026 with the practice's 30 days of payment terms.
    expect(sample.getByText('01/10/2026')).toBeInTheDocument();
    expect(sample.getByText('31/10/2026')).toBeInTheDocument();
    // Three standard lines: £1,200.00 + £150.00 + 3 × £80.00, plus 20% VAT.
    expect(sample.getByText('Year-end accounts 2026')).toBeInTheDocument();
    expect(sample.getByText('£1,590.00')).toBeInTheDocument();
    expect(sample.getByText('VAT (20%)')).toBeInTheDocument();
    expect(sample.getByText('£318.00')).toBeInTheDocument();
    expect(sample.getByText('£1,908.00')).toBeInTheDocument();
    // The hint about the PDF renderer.
    expect(sample.getByText(/drawn with the template of the client/)).toBeInTheDocument();
  });

  it('follows the layout', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const { dialog, preview } = await openAdd(user);
    const sample = within(preview);
    const layout = within(dialog).getByRole('combobox', { name: 'Layout' });

    expect(sample.getByRole('columnheader', { name: 'Qty' })).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'The invoice lines as they were prepared, one line for each service billed.',
      ),
    ).toBeInTheDocument();

    await user.selectOptions(layout, 'Detailed (every time entry)');
    expect(sample.getByRole('columnheader', { name: 'Time' })).toBeInTheDocument();
    expect(sample.queryByRole('columnheader', { name: 'Qty' })).not.toBeInTheDocument();
    expect(
      sample.getAllByText('A. Lovelace · Preparing the accounts', { selector: 'td' }),
    ).toHaveLength(2);
    expect(sample.getAllByRole('row')).toHaveLength(6);
    expect(sample.getByText('£905.00')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Every time entry is listed with its date, person, hours and rate.'),
    ).toBeInTheDocument();

    await user.selectOptions(layout, 'Summary (one line per job)');
    expect(sample.getByText('J00012 · Year-end accounts 2026')).toBeInTheDocument();
    expect(sample.queryByRole('columnheader', { name: 'Time' })).not.toBeInTheDocument();
    expect(sample.getAllByRole('row')).toHaveLength(4);
    expect(sample.getByText('£1,590.00')).toBeInTheDocument();
  });

  it('shows or hides the logo and the bank details as they are switched', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />, {
      context: {
        ...ownerContext,
        organization: {
          ...ownerContext.organization,
          bank_details: 'Capium Bank\nSort code 00-00-00 · Account 12345678',
        },
      },
    });
    const { dialog, preview } = await openAdd(user);
    const sample = within(preview);

    expect(sample.getByRole('img', { name: 'Practice logo' })).toBeInTheDocument();
    expect(sample.getByText('Bank details')).toBeInTheDocument();
    expect(sample.getByText(/Sort code 00-00-00 · Account 12345678/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('checkbox', { name: /Show the practice logo/ }));
    expect(sample.queryByRole('img', { name: 'Practice logo' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: /Show the bank details/ }));
    expect(sample.queryByText('Bank details')).not.toBeInTheDocument();
    expect(sample.queryByText(/Sort code/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('checkbox', { name: /Show the bank details/ }));
    expect(sample.getByText('Bank details')).toBeInTheDocument();
  });

  it('names where the bank details come from when the practice has none', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const { preview } = await openAdd(user);
    expect(
      within(preview).getByText('The bank details of the practice settings'),
    ).toBeInTheDocument();
  });

  it('prints the footer text as it is typed', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const { dialog, preview } = await openAdd(user);

    expect(within(preview).getByText('The footer text appears here')).toBeInTheDocument();
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Footer text' }),
      'Thank you for your business.',
    );
    expect(within(preview).getByText('Thank you for your business.')).toBeInTheDocument();
    expect(within(preview).queryByText('The footer text appears here')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/28\/1000 characters/)).toBeInTheDocument();
  });

  it('draws the saved template when one is edited, and no VAT for a practice that is not registered', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />, {
      context: {
        ...ownerContext,
        organization: { ...ownerContext.organization, vat_registered: false },
      },
    });
    await chooseAction(user, 'Detailed time sheets', 'Edit');
    const dialog = await screen.findByRole('region', { name: 'Edit invoice template' });
    const sample = within(within(dialog).getByRole('region', { name: 'Invoice preview' }));

    expect(sample.getByRole('columnheader', { name: 'Time' })).toBeInTheDocument();
    expect(
      sample.getByText('Registered in England and Wales, company number 01234567.'),
    ).toBeInTheDocument();
    expect(sample.queryByText('Bank details')).not.toBeInTheDocument();
    // Not VAT registered: no VAT number, and every line carries 0%.
    expect(sample.queryByText(/VAT no\./)).not.toBeInTheDocument();
    expect(sample.getByText('VAT (0%)')).toBeInTheDocument();
    expect(sample.getAllByText('£905.00')).toHaveLength(2);
  });
});

describe('InvoiceTemplateFormPanel: editing', () => {
  async function openEdit(user: User, name: string) {
    await chooseAction(user, name, 'Edit');
    return screen.findByRole('region', { name: 'Edit invoice template' });
  }

  it('opens with the saved values and saves only what changed', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const dialog = await openEdit(user, 'Detailed time sheets');

    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Detailed time sheets',
    );
    expect(within(dialog).getByRole('combobox', { name: 'Layout' })).toHaveValue('detailed');
    expect(within(dialog).getByRole('checkbox', { name: /Show the practice logo/ })).toBeChecked();
    expect(
      within(dialog).getByRole('checkbox', { name: /Show the bank details/ }),
    ).not.toBeChecked();
    expect(within(dialog).getByRole('textbox', { name: 'Footer text' })).toHaveValue(
      'Registered in England and Wales, company number 01234567.',
    );
    // Nothing changed, nothing to save.
    expect(within(dialog).getByRole('button', { name: 'Save template' })).toBeDisabled();

    await user.click(within(dialog).getByRole('checkbox', { name: /Show the bank details/ }));
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Layout' }), 'Standard');
    await user.click(within(dialog).getByRole('button', { name: 'Save template' }));

    expect(await screen.findByText('Detailed time sheets saved')).toBeInTheDocument();
    expect(backend.calls.templateUpdates).toEqual([
      { id: detailedTemplate.id, body: { layout: 'standard', show_bank_details: true } },
    ]);
    await closed('Edit invoice template');
    expect(within(await row(/^Detailed time sheets/)).getByText('Standard')).toBeInTheDocument();
  });

  it('clears the footer with null', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const dialog = await openEdit(user, 'Detailed time sheets');
    await user.clear(within(dialog).getByRole('textbox', { name: 'Footer text' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save template' }));

    await screen.findByText('Detailed time sheets saved');
    expect(backend.calls.templateUpdates).toEqual([
      { id: detailedTemplate.id, body: { footer_text: null } },
    ]);
  });

  it('renames a template and shows a duplicate name on the field', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    const dialog = await openEdit(user, 'Summary by job');
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'STANDARD');
    await user.click(within(dialog).getByRole('button', { name: 'Save template' }));

    expect(
      await within(dialog).findByText('A template with this name already exists.'),
    ).toBeInTheDocument();
    expect(backend.calls.templateUpdates).toEqual([
      { id: summaryTemplate.id, body: { name: 'STANDARD' } },
    ]);

    await user.clear(name);
    await user.type(name, 'Summary');
    await user.click(within(dialog).getByRole('button', { name: 'Save template' }));
    expect(await screen.findByText('Summary saved')).toBeInTheDocument();
  });
});

describe('InvoiceTemplatesPage: default, status and delete', () => {
  it('makes a template the default', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    await chooseAction(user, 'Summary by job', 'Make default');

    expect(
      await screen.findByText('Summary by job is now the default template'),
    ).toBeInTheDocument();
    expect(backend.calls.templateDefaults).toEqual([summaryTemplate.id]);
    await waitFor(() =>
      expect(
        within(screen.getByRole('row', { name: /^Summary by job/ })).getByText('Default'),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole('row', { name: /^Standard/ })).queryByText('Default'),
    ).not.toBeInTheDocument();
  });

  it('deactivates and activates a template', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);

    await chooseAction(user, 'Summary by job', 'Deactivate');
    expect(await screen.findByText('Summary by job deactivated')).toBeInTheDocument();
    expect(backend.calls.templateUpdates).toEqual([
      { id: summaryTemplate.id, body: { status: 'inactive' } },
    ]);
    await waitFor(() =>
      expect(
        within(screen.getByRole('row', { name: /^Summary by job/ })).getByText('Inactive'),
      ).toBeInTheDocument(),
    );

    await chooseAction(user, 'Retired layout', 'Activate');
    expect(await screen.findByText('Retired layout activated')).toBeInTheDocument();
    expect(backend.calls.templateUpdates.at(-1)).toEqual({
      id: retiredTemplate.id,
      body: { status: 'active' },
    });
  });

  it('tells the person when a quick action is refused', async () => {
    server.use(
      http.post(orgApiPath(`/invoice-templates/${summaryTemplate.id}/make-default`), () =>
        fail(409, 'TEMPLATE_INACTIVE', 'An inactive template cannot be the default.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    await chooseAction(user, 'Summary by job', 'Make default');
    expect(await screen.findByText('Could not change the default template')).toBeInTheDocument();
    expect(screen.getByText(/An inactive template cannot be the default\./)).toBeInTheDocument();
  });

  it('asks before deleting an unused template, then deletes it', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    await chooseAction(user, 'Summary by job', 'Delete');

    const dialog = await screen.findByRole('dialog', { name: 'Delete template?' });
    expect(dialog).toHaveTextContent('is not used by any client, so it will be removed');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await closed('Delete template?');
    expect(backend.calls.templateDeletes).toEqual([]);

    await chooseAction(user, 'Summary by job', 'Delete');
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete template?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(await screen.findByText('Summary by job deleted')).toBeInTheDocument();
    expect(backend.calls.templateDeletes).toEqual([summaryTemplate.id]);
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /^Summary by job/ })).not.toBeInTheDocument(),
    );
  });

  it('deactivates instead of deleting a template that clients use', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    await chooseAction(user, 'Detailed time sheets', 'Delete');

    const dialog = await screen.findByRole('dialog', { name: 'Deactivate template?' });
    expect(dialog).toHaveTextContent('is used by 2 clients, so it cannot be deleted');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Detailed time sheets deactivated')).toBeInTheDocument();
    expect(backend.calls.templateDeletes).toEqual([]);
    expect(backend.calls.templateUpdates).toEqual([
      { id: detailedTemplate.id, body: { status: 'inactive' } },
    ]);
    await closed('Deactivate template?');
  });

  it('handles TEMPLATE_IN_USE when a client chose the template after the list was loaded', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    await row(/^Summary by job/);
    // Three clients picked it since: the page still shows "No clients".
    const found = backend.templates.find((entry) => entry.id === summaryTemplate.id);
    if (found) found.client_count = 3;

    await chooseAction(user, 'Summary by job', 'Delete');
    const dialog = await screen.findByRole('dialog', { name: 'Delete template?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    // The refusal is explained in the dialog, which now offers the way out.
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '3 clients use this template, so it cannot be deleted. Deactivate it instead: clients keep an inactive template.',
    );
    expect(backend.calls.templateDeletes).toEqual([summaryTemplate.id]);
    const deactivate = await screen.findByRole('dialog', { name: 'Deactivate template?' });
    await user.click(within(deactivate).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Summary by job deactivated')).toBeInTheDocument();
    expect(backend.calls.templateUpdates).toEqual([
      { id: summaryTemplate.id, body: { status: 'inactive' } },
    ]);
  });

  it('keeps the dialog open and explains a refused delete', async () => {
    server.use(
      http.delete(orgApiPath(`/invoice-templates/${summaryTemplate.id}`), () =>
        fail(403, 'PERMISSION_DENIED', 'You need settings.manage to delete templates.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    await chooseAction(user, 'Summary by job', 'Delete');
    const dialog = await screen.findByRole('dialog', { name: 'Delete template?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You need settings.manage to delete templates.',
    );
  });
});

describe('InvoiceTemplateFormPanel: mandatory fields', () => {
  it('stars the name, not the layout choice, the options or the footer', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceTemplatesPage />);
    await user.click(await screen.findByRole('button', { name: 'Add template' }));
    const dialog = await screen.findByRole('region', { name: 'Add invoice template' });
    expectRequiredFields(dialog, {
      required: ['Name'],
      optional: ['Footer text', /Show the practice logo/, /Show the bank details/],
    });
  });
});
