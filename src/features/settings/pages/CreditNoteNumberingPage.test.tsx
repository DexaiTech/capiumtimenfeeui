import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import {
  billingHandlers,
  createBillingBackend,
  type BillingBackend,
} from '../test/billingHandlers';
import CreditNoteNumberingPage from './CreditNoteNumberingPage';

const field = (name: string) => screen.getByRole('textbox', { name });

let backend: BillingBackend;

beforeEach(() => {
  backend = createBillingBackend();
  server.use(...billingHandlers(backend));
});

describe('CreditNoteNumberingPage', () => {
  it('shows the numbering of credit notes, not the one of invoices', async () => {
    renderInOrg(<CreditNoteNumberingPage />);
    await screen.findByRole('form', { name: 'Credit note numbering' });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Credit Note Numbering' }),
    ).toBeInTheDocument();
    expect(field('Prefix')).toHaveValue('CN-');
    expect(field('Next number')).toHaveValue('7');
    expect(screen.getByText('CN-00007')).toBeInTheDocument();
    expect(screen.getByText('Next credit note number')).toBeInTheDocument();
    expect(screen.getByText(/no credit note number is issued twice/)).toBeInTheDocument();
  });

  it('raises the next number of credit notes with PATCH /sequences/credit_note', async () => {
    const user = userEvent.setup();
    renderInOrg(<CreditNoteNumberingPage />);
    await screen.findByRole('form', { name: 'Credit note numbering' });

    await user.clear(field('Next number'));
    await user.type(field('Next number'), '10');
    expect(screen.getByText('CN-00010')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Credit note numbering saved')).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toEqual([
      { kind: 'credit_note', body: { next_number: 10 } },
    ]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled(),
    );
  });

  it('refuses to lower the next number', async () => {
    const user = userEvent.setup();
    renderInOrg(<CreditNoteNumberingPage />);
    await screen.findByRole('form', { name: 'Credit note numbering' });

    await user.clear(field('Next number'));
    await user.type(field('Next number'), '3');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'Numbers only move forward. The next number is already 7: enter 7 or higher.',
      ),
    ).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toHaveLength(0);
  });

  it('is read only without organization.update', async () => {
    renderInOrg(<CreditNoteNumberingPage />, { context: contextWith(STAFF_PERMISSIONS) });
    await screen.findByRole('form', { name: 'Credit note numbering' });
    expect(field('Prefix')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
});
