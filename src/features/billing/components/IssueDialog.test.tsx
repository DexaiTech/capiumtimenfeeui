import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { orgApiPath } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import { renderBillingPage } from '../test/render';
import { bright } from '../test/fixtures';
import { IssueDialog } from './IssueDialog';

const invoice = {
  id: 'i-1',
  issue_date: '2026-10-20',
  due_date: null,
  gross_total: 12000,
  client: bright,
};

function setup(invoiceEmail: string | null) {
  const calls: string[] = [];
  server.use(
    http.get(orgApiPath('/clients/:clientId'), () =>
      ok({ id: bright.id, invoice_email: invoiceEmail }),
    ),
    http.get(orgApiPath('/organizations/:organizationId/*'), () => ok([])),
    http.post(orgApiPath('/invoices/:invoiceId/issue'), () => {
      calls.push('issue');
      return ok({
        ...invoice,
        number: 'INV-0001',
        currency: 'GBP',
        client: bright,
      });
    }),
    http.post(orgApiPath('/invoices/:invoiceId/send'), () => {
      calls.push('send');
      return ok({ invoice_id: invoice.id, to: ['accounts@brightside.example'], queued: true });
    }),
  );
  renderBillingPage(<IssueDialog open onClose={() => undefined} invoice={invoice} />);
  return calls;
}

describe('IssueDialog: issue and send', () => {
  it('emails the invoice in the same step when the client has an invoice email', async () => {
    const user = userEvent.setup();
    const calls = setup('accounts@brightside.example');
    const dialog = await screen.findByRole('dialog');
    const button = await within(dialog).findByRole('button', { name: 'Issue and send' });
    expect(within(dialog).getByRole('checkbox', { name: /Email it to the client/ })).toBeChecked();
    await user.click(button);
    await waitFor(() => expect(calls).toEqual(['issue', 'send']));
    expect(await screen.findByText('Invoice email queued')).toBeInTheDocument();
    // The next step is one click away on the confirmation.
    expect(await screen.findByRole('button', { name: 'Record payment' })).toBeInTheDocument();
  });

  it('only issues when the box is turned off', async () => {
    const user = userEvent.setup();
    const calls = setup('accounts@brightside.example');
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('button', { name: 'Issue and send' });
    await user.click(within(dialog).getByRole('checkbox', { name: /Email it to the client/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Issue invoice' }));
    await waitFor(() => expect(calls).toEqual(['issue']));
  });

  it('does not email by default for a client without an invoice email', async () => {
    const user = userEvent.setup();
    const calls = setup(null);
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('checkbox', { name: /Email it to the client/ }),
    ).not.toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Issue invoice' }));
    await waitFor(() => expect(calls).toEqual(['issue']));
  });
});
