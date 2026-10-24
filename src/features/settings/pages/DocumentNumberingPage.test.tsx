import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { fail, server } from '@/test/server';

import { estimateSequence, testSequences } from '../test/billingFixtures';
import {
  billingHandlers,
  createBillingBackend,
  orgApiPath,
  type BillingBackend,
} from '../test/billingHandlers';
import DocumentNumberingPage from './DocumentNumberingPage';

type User = ReturnType<typeof userEvent.setup>;

const field = (name: string) => screen.getByRole('textbox', { name });

async function replace(user: User, name: string, value: string) {
  const input = field(name);
  await user.clear(input);
  if (value) await user.type(input, value);
}

async function openTab(user: User, label: string) {
  await user.click(screen.getByRole('tab', { name: label }));
}

let backend: BillingBackend;

beforeEach(() => {
  backend = createBillingBackend();
  server.use(...billingHandlers(backend));
});

describe('DocumentNumberingPage', () => {
  it('replaces the three numbering pages with one, tabbed by document type', async () => {
    renderInOrg(<DocumentNumberingPage />);
    await screen.findByRole('form', { name: 'Invoice numbering' });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Document Numbering' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Invoice' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Credit note' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Estimate' })).toBeInTheDocument();
    // Only the active tab's numbering is on the page.
    expect(screen.queryByRole('form', { name: 'Credit note numbering' })).not.toBeInTheDocument();
    expect(field('Prefix')).toHaveValue('INV-');
    expect(field('Next number')).toHaveValue('42');
  });

  it('shows the numbering of each document type on its own tab, keeping them apart', async () => {
    const user = userEvent.setup();
    renderInOrg(<DocumentNumberingPage />);
    await screen.findByRole('form', { name: 'Invoice numbering' });

    await openTab(user, 'Credit note');
    await screen.findByRole('form', { name: 'Credit note numbering' });
    expect(screen.queryByRole('form', { name: 'Invoice numbering' })).not.toBeInTheDocument();
    expect(field('Prefix')).toHaveValue('CN-');
    expect(field('Next number')).toHaveValue('7');

    await openTab(user, 'Invoice');
    await screen.findByRole('form', { name: 'Invoice numbering' });
    expect(field('Prefix')).toHaveValue('INV-');
  });

  it('explains that estimate numbering is not available until the API lists it', async () => {
    const user = userEvent.setup();
    renderInOrg(<DocumentNumberingPage />);
    await screen.findByRole('form', { name: 'Invoice numbering' });

    await openTab(user, 'Estimate');
    expect(
      await screen.findByRole('heading', { name: 'Estimate numbering is not available yet' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('shows and saves the estimate numbering once the API has the sequence', async () => {
    backend = createBillingBackend({ sequences: [...testSequences, { ...estimateSequence }] });
    server.use(...billingHandlers(backend));
    const user = userEvent.setup();
    renderInOrg(<DocumentNumberingPage />);
    await screen.findByRole('form', { name: 'Invoice numbering' });

    await openTab(user, 'Estimate');
    await screen.findByRole('form', { name: 'Estimate numbering' });
    expect(field('Prefix')).toHaveValue('EST-');

    await replace(user, 'Prefix', 'QUO-');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Estimate numbering saved')).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toEqual([{ kind: 'estimate', body: { prefix: 'QUO-' } }]);
  });

  it('saves only the fields that changed, on the active tab', async () => {
    const user = userEvent.setup();
    renderInOrg(<DocumentNumberingPage />);
    await screen.findByRole('form', { name: 'Invoice numbering' });

    await replace(user, 'Prefix', 'INVOICE-');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Invoice numbering saved')).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toEqual([
      { kind: 'invoice', body: { prefix: 'INVOICE-' } },
    ]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled(),
    );
  });

  it('saves the credit note tab against the credit note sequence, not the invoice one', async () => {
    const user = userEvent.setup();
    renderInOrg(<DocumentNumberingPage />);
    await screen.findByRole('form', { name: 'Invoice numbering' });
    await openTab(user, 'Credit note');
    await screen.findByRole('form', { name: 'Credit note numbering' });

    await replace(user, 'Next number', '8');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Credit note numbering saved')).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toEqual([
      { kind: 'credit_note', body: { next_number: 8 } },
    ]);
  });

  it('validates the active tab before sending anything', async () => {
    const user = userEvent.setup();
    renderInOrg(<DocumentNumberingPage />);
    await screen.findByRole('form', { name: 'Invoice numbering' });

    await replace(user, 'Prefix', 'bad prefix');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Use letters, digits, "-", "_" or "/" only'),
    ).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toHaveLength(0);
  });

  it('shows the error of the sequence list instead of a tab', async () => {
    server.use(http.get(orgApiPath('/sequences'), () => fail(500, 'INTERNAL_ERROR', 'Boom.')));
    renderInOrg(<DocumentNumberingPage />);
    expect(await screen.findByText('Could not load the invoice numbering')).toBeInTheDocument();
  });

  it('discards the edits of the active tab', async () => {
    const user = userEvent.setup();
    renderInOrg(<DocumentNumberingPage />);
    await screen.findByRole('form', { name: 'Invoice numbering' });

    await replace(user, 'Prefix', 'X-');
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(field('Prefix')).toHaveValue('INV-');
    expect(backend.calls.sequenceUpdates).toHaveLength(0);
  });

  it('shows the numbering to a role that cannot change it, without the means to save', async () => {
    renderInOrg(<DocumentNumberingPage />, { context: contextWith(STAFF_PERMISSIONS) });
    await screen.findByRole('form', { name: 'Invoice numbering' });

    expect(field('Prefix')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
  });

  it('tells the person when the save is not allowed', async () => {
    server.use(
      http.patch(orgApiPath('/sequences/invoice'), () =>
        fail(403, 'PERMISSION_DENIED', 'You need organization.update.'),
      ),
    );
    const user = userEvent.setup();
    renderInOrg(<DocumentNumberingPage />);
    await screen.findByRole('form', { name: 'Invoice numbering' });

    await replace(user, 'Prefix', 'X-');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('No permission')).toBeInTheDocument();
    expect(
      within(screen.getByRole('form', { name: 'Invoice numbering' })).getByRole('alert'),
    ).toHaveTextContent('You need organization.update.');
  });
});

describe('DocumentNumberingPage: mandatory fields', () => {
  it('stars the padding and the next number, not the prefix', async () => {
    renderInOrg(<DocumentNumberingPage />);
    const form = await screen.findByRole('form', { name: 'Invoice numbering' });
    expectRequiredFields(form, {
      required: ['Zero padding', 'Next number'],
      optional: ['Prefix'],
    });
  });
});
