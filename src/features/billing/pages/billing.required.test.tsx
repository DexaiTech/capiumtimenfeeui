import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { expectRequiredFields, isMarkedRequired } from '@/test/requiredFields';
import { apiPath, ok, server } from '@/test/server';

import { CreditNotePanel } from '../components/CreditNotePanel';
import { CreditNoteWipDialog } from '../components/CreditNoteWipDialog';
import { InvoiceHeaderPanel } from '../components/InvoiceHeaderPanel';
import { IssueDialog } from '../components/IssueDialog';
import { LinePanel } from '../components/LinePanel';
import { ReasonDialog } from '../components/ReasonDialog';
import { RecordPaymentPanel } from '../components/RecordPaymentPanel';
import { SendInvoiceDialog } from '../components/SendInvoiceDialog';
import { StartCreditNoteDialog } from '../components/creditNotes/CreditNoteLauncher';
import { EstimateFormPanel } from '../components/estimates/EstimateFormPanel';
import { LineEditDialog } from '../components/prepare/LineEditDialog';
import { DetailsStep } from '../components/prepare/DetailsStep';
import { ScheduleFormPanel } from '../components/recurring/ScheduleFormPanel';
import { SendStatementDialog } from '../components/statements/SendStatementDialog';
import type { InvoiceDetail, InvoiceLine } from '../types';
import { harbour } from '../test/fixtures';
import { renderBillingPage } from '../test/render';
import PrepareInvoicePage from './PrepareInvoicePage';

const noop = () => undefined;
// Either a dialog (confirmations, reasons) or the inline panel of a form.
const dialog = () =>
  waitFor(() => {
    const found = screen.queryByRole('dialog') ?? screen.queryAllByRole('region')[0];
    if (!found) throw new Error('No dialog or form panel is open');
    return found;
  });
/** A picker's label also names its list: the search box is the control that carries the star. */
const expectPickerRequired = (scope: HTMLElement, name: string) =>
  expect(isMarkedRequired(within(scope).getByRole('combobox', { name }))).toBe(true);

const invoice = {
  id: 'inv-1',
  number: 'INV-00001',
  client: harbour,
  issue_date: '2026-10-01',
  due_date: '2026-10-31',
  reference: null,
  notes: null,
  gross_total: 12000,
  balance: 12000,
  currency: 'GBP',
  lines: [
    {
      id: 'l-1',
      description: 'Bookkeeping',
      net_amount: 10000,
      vat_rate_bp: 2000,
      vat_rate_id: null,
    },
  ],
} as unknown as InvoiceDetail;

beforeEach(() => {
  // The pickers and the VAT codes ask the API for their lists: empty ones are enough here.
  server.use(http.get(apiPath('/organizations/:organizationId/*'), () => ok([])));
});

describe('the billing dialogs mark their mandatory fields', () => {
  it('issue: the issue date, not the due date', async () => {
    renderBillingPage(<IssueDialog open onClose={noop} invoice={invoice} />);
    expectRequiredFields(await dialog(), { required: ['Issue date'], optional: ['Due date'] });
  });

  it('invoice details: both dates, not the reference or the notes', async () => {
    renderBillingPage(<InvoiceHeaderPanel open onClose={noop} invoice={invoice} />);
    expectRequiredFields(await dialog(), {
      required: ['Issue date', 'Due date'],
      optional: ['Reference', 'Notes'],
    });
  });

  it('send invoice: the addresses may be left empty', async () => {
    renderBillingPage(<SendInvoiceDialog open onClose={noop} invoice={invoice} />);
    await screen.findByLabelText('To');
    expectRequiredFields(await dialog(), { required: [], optional: ['To'] });
  });

  it('a reason dialog stars the reason only when the action needs one', async () => {
    const view = renderBillingPage(
      <ReasonDialog
        open
        onClose={noop}
        title="Void"
        label="Reason"
        confirmLabel="Void"
        onSubmit={vi.fn()}
      />,
    );
    expectRequiredFields(await dialog(), { required: ['Reason'] });
    view.unmount();
    renderBillingPage(
      <ReasonDialog
        open
        onClose={noop}
        title="Void"
        label="Reason"
        required={false}
        confirmLabel="Void"
        onSubmit={vi.fn()}
      />,
    );
    expectRequiredFields(await dialog(), { required: [], optional: ['Reason'] });
  });

  it('record a payment: client, amount, date and method, not the reference or notes', async () => {
    renderBillingPage(<RecordPaymentPanel open onClose={noop} />);
    expectPickerRequired(await dialog(), 'Client');
    expectRequiredFields(await dialog(), {
      required: ['Amount received (£)', 'Date received', 'Method'],
      optional: ['Reference', 'Notes'],
    });
  });

  it('add a line: description, quantity and unit price, not the VAT code', async () => {
    renderBillingPage(<LinePanel open onClose={noop} invoiceId="inv-1" line={null} />);
    expectRequiredFields(await dialog(), {
      required: ['Description', 'Quantity', 'Unit price (£)'],
      optional: ['VAT code'],
    });
  });

  it('edit a line that bills work: description and the amount to bill', async () => {
    const line = {
      id: 'l-2',
      kind: 'time',
      description: 'Time',
      net_amount: 5000,
      vat_rate_id: null,
      vat_rate_bp: 2000,
      wip: null,
    } as unknown as InvoiceLine;
    renderBillingPage(<LinePanel open onClose={noop} invoiceId="inv-1" line={line} />);
    expectRequiredFields(await dialog(), {
      required: ['Description', 'Amount to bill (£)'],
      optional: ['VAT code'],
    });
  });

  it('credit note: reason and date', async () => {
    renderBillingPage(<CreditNotePanel open onClose={noop} invoice={invoice} />);
    expectRequiredFields(await dialog(), { required: ['Reason', 'Credit note date'] });
  });

  it('what happens to the credit note work: the reason', async () => {
    renderBillingPage(
      <CreditNoteWipDialog open onClose={noop} creditNote={{ id: 'cn-1', number: 'CN-00001' }} />,
    );
    expectRequiredFields(await dialog(), { required: ['Reason'] });
  });

  it('start a credit note: the client', async () => {
    renderBillingPage(<StartCreditNoteDialog open onClose={noop} onChoose={noop} />);
    expectPickerRequired(await dialog(), 'Client');
  });

  it('email a statement: the end date, and the address only when the client has none', async () => {
    const view = renderBillingPage(
      <SendStatementDialog
        target={{ clients: [{ id: 'c-1', name: 'Harbour & Co', hasRecipient: true }] }}
        onClose={noop}
      />,
    );
    expectRequiredFields(await dialog(), { required: ['To'], optional: ['From', 'Send to'] });
    view.unmount();
    renderBillingPage(
      <SendStatementDialog
        target={{ clients: [{ id: 'c-1', name: 'Harbour & Co', hasRecipient: false }] }}
        onClose={noop}
      />,
    );
    expectRequiredFields(await dialog(), { required: ['To', 'Send to'], optional: ['From'] });
  });

  it('new estimate: the client and the first line, not the reference, expiry or notes', async () => {
    renderBillingPage(<EstimateFormPanel open onClose={noop} estimate={null} onSaved={noop} />);
    expectPickerRequired(await dialog(), 'Client');
    expectRequiredFields(await dialog(), {
      required: ['Description', 'Quantity', 'Unit price (£)'],
      optional: ['Reference (optional)', 'Expires on (optional)', 'Notes (optional)', 'VAT code'],
    });
  });

  it('new schedule: client, name, frequency, start date and the first line', async () => {
    renderBillingPage(<ScheduleFormPanel open onClose={noop} schedule={null} onSaved={noop} />);
    expectPickerRequired(await dialog(), 'Client');
    expectRequiredFields(await dialog(), {
      required: ['Name', 'Frequency', 'Start date', 'Description', 'Quantity'],
      optional: ['End date (optional)', 'Reference (optional)', 'Notes (optional)'],
    });
  });

  it('edit a line of the draft being prepared: the wording, not the amount or VAT code', async () => {
    renderBillingPage(
      <LineEditDialog
        line={
          {
            key: 'k1',
            text: 'Bookkeeping',
            description: 'Bookkeeping',
            billed: null,
            net: null,
            wip: 5000,
            vatRateId: null,
          } as never
        }
        vatOptions={[]}
        currency="GBP"
        onClose={noop}
        onSave={noop}
      />,
    );
    expectRequiredFields(await dialog(), {
      required: ['Description'],
      optional: [/^Amount to bill/, 'VAT code'],
    });
  });

  it('prepare an invoice: the client, then the issue date of the draft', async () => {
    const view = renderBillingPage(<PrepareInvoicePage />);
    expectPickerRequired(document.body, 'Client');
    view.unmount();
    renderBillingPage(
      <DetailsStep
        clientName="Harbour & Co"
        termsDays={30}
        itemCount={1}
        totals={{ net: 100, vat: 20, gross: 120 } as never}
        buildRequest={() => ({ client_id: 'c-1' }) as never}
        onBack={noop}
      />,
    );
    expectRequiredFields(await screen.findByRole('form', { name: 'Invoice details' }), {
      required: ['Issue date'],
      optional: ['Due date', 'Reference', 'Notes'],
    });
  });
});
