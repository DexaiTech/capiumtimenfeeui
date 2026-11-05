import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/server';

import { harbour } from '../../test/fixtures';
import { createPrepareBackend, postsOf, prepareHandlers } from '../../test/prepare';
import { renderBillingPage } from '../../test/render';
import type { InvoiceDetail } from '../../types';
import { PrepareInvoicePanel } from './PrepareInvoicePanel';

const CLIENT_PAGE = '/acme/clients/harbour/invoices';

/** The panel as a client's own page opens it (APT61): the client is fixed, and nothing navigates. */
function setup() {
  const backend = createPrepareBackend();
  server.use(...prepareHandlers(backend));
  const created = vi.fn<(invoice: InvoiceDetail) => void>();
  const closed = vi.fn();
  renderBillingPage(
    <PrepareInvoicePanel clientId={harbour.id} onClose={closed} onCreated={created} />,
    { route: CLIENT_PAGE, path: CLIENT_PAGE },
  );
  return { backend, created, closed };
}

async function toDetails(user: ReturnType<typeof userEvent.setup>) {
  const table = await screen.findByRole('table', { name: 'Work in progress of Harbour & Co' });
  await waitFor(() => expect(table).not.toHaveAttribute('aria-busy', 'true'));
  const row = within(table).getByRole('row', { name: /Bank reconciliation/ });
  await user.click(within(row).getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Review the lines' }));
  await screen.findByRole('table', { name: 'Lines of the invoice' });
  await user.click(screen.getByRole('button', { name: 'Dates and notes' }));
  return screen.findByRole('form', { name: 'Invoice details' });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PrepareInvoicePanel for a fixed client', () => {
  it('offers no client picker: the work listed is the client’s', async () => {
    setup();
    const panel = screen.getByRole('region', { name: 'Create invoice' });
    expect(panel).toHaveTextContent('Choose the work to bill, then review and issue the invoice.');
    expect(
      await screen.findByRole('table', { name: 'Work in progress of Harbour & Co' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Client' })).not.toBeInTheDocument();
  });

  it('saves the draft for that client and hands it back instead of opening its page', async () => {
    const user = userEvent.setup();
    const { backend, created } = setup();
    await toDetails(user);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('Draft invoice saved')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices')[0]?.body).toMatchObject({ client_id: harbour.id });
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(created.mock.calls[0]?.[0]).toMatchObject({ id: 'inv-new-1' });
    expect(screen.getByTestId('location')).toHaveTextContent(CLIENT_PAGE);
  });

  it('issues the invoice and still stays where it is', async () => {
    const user = userEvent.setup();
    const { backend, created } = setup();
    await toDetails(user);
    await user.click(screen.getByRole('button', { name: 'Save and issue' }));

    expect(await screen.findByText('Invoice INV-00099 issued')).toBeInTheDocument();
    expect(postsOf(backend, '/invoices/inv-new-1/issue')).toHaveLength(1);
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('location')).toHaveTextContent(CLIENT_PAGE);
  });

  it('keeps the request’s refusal on the form and hands nothing back', async () => {
    const user = userEvent.setup();
    const backend = createPrepareBackend({
      refusals: {
        'POST /invoices': { status: 422, code: 'VALIDATION_ERROR', message: 'Nothing to bill.' },
      },
    });
    server.use(...prepareHandlers(backend));
    const created = vi.fn();
    renderBillingPage(<PrepareInvoicePanel clientId={harbour.id} onCreated={created} />, {
      route: CLIENT_PAGE,
      path: CLIENT_PAGE,
    });
    await toDetails(user);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('Nothing to bill.')).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent(CLIENT_PAGE);
  });
});
