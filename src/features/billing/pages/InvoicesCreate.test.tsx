import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { ok, server } from '@/test/server';
import { orgApiPath } from '@/test/renderInOrg';

import { BILLING, renderBillingPage } from '../test/render';
import InvoicesPage from './InvoicesPage';

const END = { next_cursor: null, has_more: false };

describe('Create invoice on the invoice list', () => {
  it('opens the preparation in the same page, above the list, and closes again', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(orgApiPath('/invoices/summary'), () =>
        ok({ counts: { total: 0 }, outstanding: 0, overdue: 0, awaiting_approval_gross: 0 }),
      ),
      http.get(orgApiPath('/invoices'), () => ok([], { meta: END })),
    );
    renderBillingPage(<InvoicesPage />, {
      route: `${BILLING}/invoices`,
      path: `${BILLING}/invoices`,
    });

    const open = await screen.findByRole('button', { name: 'Create invoice' });
    expect(screen.queryByRole('region', { name: 'Create invoice' })).not.toBeInTheDocument();
    await user.click(open);

    const panel = screen.getByRole('region', { name: 'Create invoice' });
    expect(panel).toHaveTextContent('Choose a client');
    expect(screen.getByRole('table', { name: 'Invoices' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Create invoice' })).not.toBeInTheDocument(),
    );
  });
});
