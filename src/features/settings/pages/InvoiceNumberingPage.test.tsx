import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { contextWith, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { fail, ok, server } from '@/test/server';

import {
  billingHandlers,
  createBillingBackend,
  orgApiPath,
  type BillingBackend,
} from '../test/billingHandlers';
import InvoiceNumberingPage from './InvoiceNumberingPage';

type User = ReturnType<typeof userEvent.setup>;

const field = (name: string) => screen.getByRole('textbox', { name });
const form = () => screen.getByRole('form', { name: 'Invoice numbering' });

async function replace(user: User, name: string, value: string) {
  const input = field(name);
  await user.clear(input);
  if (value) await user.type(input, value);
}

async function open() {
  renderInOrg(<InvoiceNumberingPage />);
  await screen.findByRole('form', { name: 'Invoice numbering' });
}

let backend: BillingBackend;

beforeEach(() => {
  backend = createBillingBackend();
  server.use(...billingHandlers(backend));
});

describe('InvoiceNumberingPage', () => {
  it('shows the numbering of invoices with a preview of the next number', async () => {
    await open();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Invoice Numbering' }),
    ).toBeInTheDocument();
    expect(field('Prefix')).toHaveValue('INV-');
    expect(field('Zero padding')).toHaveValue('5');
    expect(field('Next number')).toHaveValue('42');
    expect(screen.getByText('INV-00042')).toBeInTheDocument();
    expect(screen.getByText('Then INV-00043, INV-00044 and so on.')).toBeInTheDocument();
    // The forward-only rule and the rule about numbers already used are explained.
    expect(
      screen.getByText(/Numbers only move forward\. You can raise the next number/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A number that already exists cannot be used again/),
    ).toBeInTheDocument();
    expect(screen.getByText('Now 42. It can be raised, never lowered.')).toBeInTheDocument();
    // Nothing is changed yet: nothing to save, and only the invoice kind was read.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeDisabled();
    expect(backend.calls.sequenceLists).toBe(1);
  });

  it('shows a skeleton while loading', () => {
    server.use(http.get(orgApiPath('/sequences'), () => new Promise(() => undefined)));
    renderInOrg(<InvoiceNumberingPage />);
    expect(screen.getByRole('status', { name: 'Loading invoice numbering' })).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    server.use(
      http.get(orgApiPath('/sequences'), () =>
        failing ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok(backend.sequences),
      ),
    );
    renderInOrg(<InvoiceNumberingPage />);
    expect(await screen.findByText('Could not load the invoice numbering')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('textbox', { name: 'Prefix' })).toHaveValue('INV-');
  });

  it('updates the preview as the fields are typed', async () => {
    const user = userEvent.setup();
    await open();

    await replace(user, 'Prefix', 'ACME/');
    await replace(user, 'Zero padding', '6');
    await replace(user, 'Next number', '120');
    expect(screen.getByText('ACME/000120')).toBeInTheDocument();
    expect(screen.getByText(/Then ACME\/000121, ACME\/000122 and so on\./)).toHaveTextContent(
      'Saved now: INV-00042.',
    );
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();

    // An empty prefix is allowed: the number stands alone.
    await replace(user, 'Prefix', '');
    expect(screen.getByText('000120')).toBeInTheDocument();
  });

  it('shows a dash instead of a preview while a field is not valid', async () => {
    const user = userEvent.setup();
    await open();
    await replace(user, 'Zero padding', '0');
    expect(screen.queryByText('INV-00042')).not.toBeInTheDocument();
    expect(screen.getByText(/Correct the fields marked below/)).toBeInTheDocument();
  });

  it('saves only the fields that changed, then shows them as saved', async () => {
    const user = userEvent.setup();
    await open();

    await replace(user, 'Prefix', 'INVOICE-');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Invoice numbering saved')).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toEqual([
      { kind: 'invoice', body: { prefix: 'INVOICE-' } },
    ]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled(),
    );
    expect(screen.getByText('INVOICE-00042')).toBeInTheDocument();
    expect(field('Prefix')).toHaveValue('INVOICE-');
    expect(screen.queryByText('You have unsaved changes.')).not.toBeInTheDocument();
  });

  it('sends the prefix, the padding and the next number together, as numbers', async () => {
    const user = userEvent.setup();
    await open();

    await replace(user, 'Prefix', '  ACME/  ');
    await replace(user, 'Zero padding', '6');
    await replace(user, 'Next number', '120');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Invoice numbering saved')).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toEqual([
      { kind: 'invoice', body: { prefix: 'ACME/', padding: 6, next_number: 120 } },
    ]);
    await waitFor(() => expect(screen.getByText('ACME/000120')).toBeInTheDocument());
    expect(screen.getByText('Now 120. It can be raised, never lowered.')).toBeInTheDocument();
  });

  it('validates the fields before sending anything', async () => {
    const user = userEvent.setup();
    await open();

    await replace(user, 'Prefix', 'bad prefix');
    await replace(user, 'Zero padding', '11');
    await replace(user, 'Next number', '0');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Use letters, digits, "-", "_" or "/" only'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter a whole number from 1 to 10')).toBeInTheDocument();
    expect(screen.getByText('Enter a whole number from 1 to 2,000,000,000')).toBeInTheDocument();
    expect(field('Prefix')).toBeInvalid();
    expect(backend.calls.sequenceUpdates).toHaveLength(0);
  });

  it('refuses a lower next number as the API would, with the current number named', async () => {
    const user = userEvent.setup();
    await open();

    await replace(user, 'Next number', '41');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'Numbers only move forward. The next number is already 42: enter 42 or higher.',
      ),
    ).toBeInTheDocument();
    expect(field('Next number')).toBeInvalid();
    expect(backend.calls.sequenceUpdates).toHaveLength(0);

    // The current number, or a higher one, is fine.
    await replace(user, 'Next number', '42');
    await replace(user, 'Prefix', 'INV/');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Invoice numbering saved')).toBeInTheDocument();
  });

  it('maps the API refusal of a lower number to the field and shows the number it has now', async () => {
    const user = userEvent.setup();
    await open();
    // Another person issued invoices since the page was opened.
    const current = backend.sequences.find((entry) => entry.kind === 'invoice');
    if (current) Object.assign(current, { next_number: 50, preview: 'INV-00050' });

    await replace(user, 'Next number', '45');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'Numbers only move forward. The next number is already 50: enter 50 or higher.',
      ),
    ).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toEqual([{ kind: 'invoice', body: { next_number: 45 } }]);
    expect(field('Next number')).toBeInvalid();
    // The typed number stays; the sequence was refetched, so the tile names the number it has now.
    expect(field('Next number')).toHaveValue('45');
    expect(await screen.findByText(/Saved now: INV-00050\./)).toBeInTheDocument();
    // The refusal is still on the field after the refetch.
    expect(
      screen.getByText(
        'Numbers only move forward. The next number is already 50: enter 50 or higher.',
      ),
    ).toBeInTheDocument();
  });

  it('maps the refusal of a number that is already used to the field', async () => {
    backend.usedNumbers.invoice = ['INV-00050'];
    const user = userEvent.setup();
    await open();

    await replace(user, 'Next number', '50');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'INV-00050 is already used and a number is never issued twice. Enter a higher number.',
      ),
    ).toBeInTheDocument();
    expect(field('Next number')).toBeInvalid();
    expect(screen.getByRole('textbox', { name: 'Next number' })).toHaveAccessibleDescription(
      /INV-00050 is already used/,
    );
    // The sequence was not changed.
    expect(screen.getByText('Saved now: INV-00042.', { exact: false })).toBeInTheDocument();
  });

  it('shows the problems of a 422 on their fields', async () => {
    server.use(
      http.patch(orgApiPath('/sequences/invoice'), () =>
        fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
          details: [{ field: 'prefix', code: 'invalid', message: 'This prefix is not allowed.' }],
        }),
      ),
    );
    const user = userEvent.setup();
    await open();
    await replace(user, 'Prefix', 'NOPE-');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('This prefix is not allowed.')).toBeInTheDocument();
    expect(field('Prefix')).toBeInvalid();
  });

  it('tells the person when the save is not allowed', async () => {
    server.use(
      http.patch(orgApiPath('/sequences/invoice'), () =>
        fail(403, 'PERMISSION_DENIED', 'You need organization.update.'),
      ),
    );
    const user = userEvent.setup();
    await open();
    await replace(user, 'Prefix', 'X-');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('No permission')).toBeInTheDocument();
    expect(within(form()).getByRole('alert')).toHaveTextContent('You need organization.update.');
    expect(field('Prefix')).toHaveValue('X-');
  });

  it('discards the edits', async () => {
    const user = userEvent.setup();
    await open();
    await replace(user, 'Prefix', 'X-');
    await replace(user, 'Next number', '99');
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(field('Prefix')).toHaveValue('INV-');
    expect(field('Next number')).toHaveValue('42');
    expect(screen.getByText('INV-00042')).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates).toHaveLength(0);
  });

  it('shows the numbering to a role that cannot change it, without the means to save', async () => {
    renderInOrg(<InvoiceNumberingPage />, { context: contextWith(STAFF_PERMISSIONS) });
    await screen.findByRole('form', { name: 'Invoice numbering' });

    expect(field('Prefix')).toBeDisabled();
    expect(field('Zero padding')).toBeDisabled();
    expect(field('Next number')).toBeDisabled();
    expect(screen.getByText('INV-00042')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(
      screen.getByText(/needs permission to update the practice settings/),
    ).toBeInTheDocument();
  });

  it('is saved with organization.update alone', async () => {
    const user = userEvent.setup();
    renderInOrg(<InvoiceNumberingPage />, {
      context: contextWith(['organization.read', 'organization.update']),
    });
    await screen.findByRole('form', { name: 'Invoice numbering' });
    await replace(user, 'Prefix', 'Z-');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Invoice numbering saved')).toBeInTheDocument();
    expect(backend.calls.sequenceUpdates[0]?.body).toEqual({ prefix: 'Z-' });
  });
});
