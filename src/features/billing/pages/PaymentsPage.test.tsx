import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { ok, server } from '@/test/server';

import { BILLING, renderBillingPage } from '../test/render';
import PaymentsPage from './PaymentsPage';

const PAYMENTS = `${BILLING}/payments`;
const END = { next_cursor: null, has_more: false };

function setup(route: string, permissions = OWNER_PERMISSIONS) {
  server.use(
    http.get(orgApiPath('/payments'), () => ok([], { meta: END })),
    http.get(orgApiPath('/clients'), () => ok([], { meta: END })),
  );
  renderBillingPage(<PaymentsPage />, { permissions, route, path: PAYMENTS });
}

describe('PaymentsPage: the link of the "+" menu', () => {
  it('opens the payment form at once for ?new=1 and drops the parameter on close', async () => {
    const user = userEvent.setup();
    setup(`${PAYMENTS}?new=1`);
    const form = await screen.findByRole('region', { name: 'Record a payment' });
    expect(form).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close Record a payment' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Record a payment' })).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('location')).not.toHaveTextContent('new=1');
  });

  it('does not open it for someone who may not record payments', async () => {
    setup(`${PAYMENTS}?new=1`, ['payment.read']);
    await screen.findByRole('table', { name: 'Payments' });
    expect(screen.queryByRole('region', { name: 'Record a payment' })).not.toBeInTheDocument();
  });
});
