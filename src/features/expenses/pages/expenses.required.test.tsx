import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/server';
import { expectRequiredFields, isMarkedRequired } from '@/test/requiredFields';

import { ReturnDialog } from '../components/DecisionDialogs';
import { DisbursementFormPanel } from '../components/DisbursementFormPanel';
import { ExpenseTypeFormPanel } from '../components/ExpenseTypeFormPanel';
import { LineFormPanel } from '../components/LineFormPanel';
import { ClaimTitlePanel, NewClaimPanel } from '../components/NewClaimPanel';
import { claim as makeClaim, IDS } from '../test/fixtures';
import { createBackend, expenseHandlers } from '../test/handlers';
import { renderExpensePage } from '../test/render';

const noop = () => undefined;
// Either a dialog (confirmations, reasons) or the inline panel of a form.
const dialog = () =>
  waitFor(() => {
    const found = screen.queryByRole('dialog') ?? screen.queryAllByRole('region')[0];
    if (!found) throw new Error('No dialog or form panel is open');
    return found;
  });

function open(page: Parameters<typeof renderExpensePage>[0]) {
  server.use(...expenseHandlers(createBackend()));
  return renderExpensePage(page);
}

/** A picker's label also names its list: the search box is the control that carries the star. */
const pickerRequired = (scope: HTMLElement, name: string) =>
  isMarkedRequired(within(scope).getByRole('combobox', { name }));

describe('the expense dialogs mark their mandatory fields', () => {
  it('new claim: nothing is mandatory', async () => {
    open(<NewClaimPanel open onClose={noop} onCreated={noop} />);
    expectRequiredFields(await dialog(), { required: [], optional: ['Title (optional)'] });
  });

  it('claim title: the title may be emptied', async () => {
    open(<ClaimTitlePanel open onClose={noop} claimId="c-1" title="Trip" />);
    expectRequiredFields(await dialog(), { required: [], optional: ['Title'] });
  });

  it('expense type: name and code, not the default VAT code', async () => {
    open(<ExpenseTypeFormPanel open onClose={noop} type={null} />);
    expectRequiredFields(await dialog(), {
      required: ['Name', 'Code'],
      optional: ['Default VAT code'],
    });
  });

  it('add an expense: type, date and description, not the supplier or the amounts', async () => {
    open(<LineFormPanel open onClose={noop} claimId="c-1" line={null} />);
    const scope = await dialog();
    expectRequiredFields(scope, {
      required: ['Expense type', 'Date', 'Description'],
      optional: ['Supplier', 'Paid by', 'VAT code'],
    });
    // The client is only mandatory once the expense is billable.
    expect(pickerRequired(scope, 'Client')).toBe(false);
  });

  it('a mileage expense also needs the miles', async () => {
    open(<LineFormPanel open onClose={noop} claimId="c-1" line={null} />);
    const scope = await dialog();
    await userEvent.selectOptions(await within(scope).findByLabelText('Expense type'), IDS.mileage);
    expectRequiredFields(scope, { required: ['Miles'], optional: ['VAT code'] });
  });

  it('correct an expense of an approved claim: the reason is mandatory', async () => {
    open(<LineFormPanel open onClose={noop} claimId="c-1" line={null} correcting />);
    expectRequiredFields(await dialog(), { required: ['Reason for the correction'] });
  });

  it('record a disbursement: client, date, description and amount', async () => {
    open(<DisbursementFormPanel open onClose={noop} disbursement={null} />);
    const scope = await dialog();
    expect(pickerRequired(scope, 'Client')).toBe(true);
    expectRequiredFields(scope, {
      required: ['Date', 'Description', 'Amount before VAT (£)'],
      optional: ['Supplier', 'VAT code'],
    });
  });

  it('return a claim: the reason is mandatory', async () => {
    open(<ReturnDialog open onClose={noop} claim={makeClaim()} />);
    expectRequiredFields(await dialog(), { required: ['Reason'] });
  });
});
