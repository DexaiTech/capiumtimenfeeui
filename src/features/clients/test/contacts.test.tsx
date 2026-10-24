import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import { techwave, techwaveDetail } from './fixtures';
import {
  heading,
  renderWorkspace,
  SERVER_PROBLEM,
  type RenderWorkspaceOptions,
} from './renderWorkspace';

const NAME = 'Techwave Innovations Ltd';
const CAPTION = `Contacts of ${NAME}`;
const TARAK = techwaveDetail.contacts[1];

async function openContacts(options: RenderWorkspaceOptions = {}) {
  renderWorkspace(`/acme/clients/${techwave.id}/contacts`, options);
  await heading(NAME);
  return screen.findByRole('table', { name: CAPTION });
}

const rowOf = (name: RegExp) =>
  within(screen.getByRole('table', { name: CAPTION })).getByRole('row', { name });

describe('ContactsTab', () => {
  it('lists the contacts with their details and flags', async () => {
    await openContacts();

    const ramya = rowOf(/Ramya Menon/);
    expect(ramya).toHaveTextContent('Director');
    expect(within(ramya).getByRole('link', { name: 'ramya@techwave.example' })).toHaveAttribute(
      'href',
      'mailto:ramya@techwave.example',
    );
    expect(within(ramya).getByText('Primary')).toBeInTheDocument();
    expect(within(ramya).queryByText('Billing')).toBeNull();

    const tarak = rowOf(/Tarak Patel/);
    expect(within(tarak).getByText('Billing')).toBeInTheDocument();
    expect(within(tarak).queryByText('Primary')).toBeNull();
    expect(screen.getByRole('heading', { name: /Contacts\s*2/ })).toBeInTheDocument();
  });

  it('invites a client without contacts to add one, with the first as primary', async () => {
    const user = userEvent.setup();
    await openContacts({ clients: [{ ...techwaveDetail, contacts: [] }] });
    expect(await screen.findByText('No contacts yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('region', { name: 'Add contact' });
    expect(within(dialog).getByRole('checkbox', { name: /^Primary contact/ })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /^Billing contact/ })).not.toBeChecked();
  });

  it('adds a contact with the exact body', async () => {
    const posted: unknown[] = [];
    const user = userEvent.setup();
    await openContacts({
      handlers: [
        http.post(orgApiPath('/clients/:clientId/contacts'), async ({ request }) => {
          posted.push(await request.json());
          return ok(TARAK, { status: 201 });
        }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('region', { name: 'Add contact' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Sam Doe');
    await user.type(within(dialog).getByRole('textbox', { name: 'Position' }), 'Finance director');
    await user.type(within(dialog).getByRole('textbox', { name: 'Email' }), 'sam@techwave.example');
    await user.type(within(dialog).getByRole('textbox', { name: 'Phone' }), '020 7946 0001');
    // The client has contacts already: the new one is not primary unless asked.
    expect(within(dialog).getByRole('checkbox', { name: /^Primary contact/ })).not.toBeChecked();
    await user.click(within(dialog).getByRole('checkbox', { name: /^Billing contact/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add contact' }));

    await waitFor(() =>
      expect(posted).toEqual([
        {
          name: 'Sam Doe',
          position: 'Finance director',
          email: 'sam@techwave.example',
          phone: '020 7946 0001',
          is_primary: false,
          is_billing: true,
        },
      ]),
    );
    expect(await screen.findByText('Contact added')).toBeInTheDocument();
  });

  it('checks the name and the email before sending', async () => {
    const posted: unknown[] = [];
    const user = userEvent.setup();
    await openContacts({
      handlers: [
        http.post(orgApiPath('/clients/:clientId/contacts'), async ({ request }) => {
          posted.push(await request.json());
          return ok(TARAK, { status: 201 });
        }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('region', { name: 'Add contact' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Email' }), 'nope');
    await user.click(within(dialog).getByRole('button', { name: 'Add contact' }));

    expect(await within(dialog).findByText('Enter the contact name')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid email address')).toBeInTheDocument();
    expect(posted).toEqual([]);
  });

  it('maps a 422 onto the field it names', async () => {
    const user = userEvent.setup();
    await openContacts({
      handlers: [
        http.post(orgApiPath('/clients/:clientId/contacts'), () =>
          fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
            details: [{ field: 'phone', code: 'invalid', message: 'Enter a UK phone number.' }],
          }),
        ),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Add contact' }));
    const dialog = await screen.findByRole('region', { name: 'Add contact' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Sam Doe');
    await user.click(within(dialog).getByRole('button', { name: 'Add contact' }));

    expect(await within(dialog).findByText('Enter a UK phone number.')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Phone' })).toBeInvalid();
  });

  it('edits a contact', async () => {
    const patched: Array<[string, unknown]> = [];
    const user = userEvent.setup();
    await openContacts({
      handlers: [
        http.patch(
          orgApiPath('/clients/:clientId/contacts/:contactId'),
          async ({ params, request }) => {
            patched.push([String(params.contactId), await request.json()]);
            return ok(TARAK);
          },
        ),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Edit Tarak Patel' }));
    const dialog = await screen.findByRole('region', { name: 'Edit contact' });
    expect(within(dialog).getByRole('checkbox', { name: /^Billing contact/ })).toBeChecked();
    await user.type(within(dialog).getByRole('textbox', { name: 'Position' }), 'Accounts payable');
    await user.click(within(dialog).getByRole('button', { name: 'Save contact' }));

    await waitFor(() =>
      expect(patched).toEqual([
        [
          TARAK?.id,
          {
            name: 'Tarak Patel',
            position: 'Accounts payable',
            email: 'tarak@techwave.example',
            phone: null,
            is_primary: false,
            is_billing: true,
          },
        ],
      ]),
    );
    expect(await screen.findByText('Contact updated')).toBeInTheDocument();
  });

  it('makes a contact the primary one', async () => {
    const patched: Array<[string, unknown]> = [];
    const user = userEvent.setup();
    await openContacts({
      handlers: [
        http.patch(
          orgApiPath('/clients/:clientId/contacts/:contactId'),
          async ({ params, request }) => {
            patched.push([String(params.contactId), await request.json()]);
            return ok({ ...TARAK, is_primary: true });
          },
        ),
      ],
    });

    // The primary contact has nothing to make; the other one does.
    expect(within(rowOf(/Ramya Menon/)).queryByRole('button', { name: 'Make primary' })).toBeNull();
    await user.click(within(rowOf(/Tarak Patel/)).getByRole('button', { name: 'Make primary' }));

    await waitFor(() => expect(patched).toEqual([[TARAK?.id, { is_primary: true }]]));
    expect(await screen.findByText('Primary contact changed')).toBeInTheDocument();
  });

  it('reports a primary contact that could not be changed', async () => {
    const user = userEvent.setup();
    await openContacts({
      handlers: [
        http.patch(orgApiPath('/clients/:clientId/contacts/:contactId'), () =>
          fail(500, 'INTERNAL_ERROR', 'Boom.'),
        ),
      ],
    });

    await user.click(within(rowOf(/Tarak Patel/)).getByRole('button', { name: 'Make primary' }));
    expect(await screen.findByText('Could not change the primary contact')).toBeInTheDocument();
    expect(screen.getByText(SERVER_PROBLEM)).toBeInTheDocument();
  });

  it('deletes a contact after a confirmation', async () => {
    const removed: string[] = [];
    const user = userEvent.setup();
    await openContacts({
      handlers: [
        http.delete(orgApiPath('/clients/:clientId/contacts/:contactId'), ({ params }) => {
          removed.push(String(params.contactId));
          return ok(null);
        }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Delete Tarak Patel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete contact' });
    expect(dialog).toHaveTextContent('Delete Tarak Patel?');
    expect(dialog).not.toHaveTextContent('no primary contact');
    expect(removed).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(removed).toEqual([TARAK?.id]));
    expect(await screen.findByText('Contact deleted')).toBeInTheDocument();
  });

  it('warns that deleting the primary contact leaves none', async () => {
    const user = userEvent.setup();
    await openContacts();

    await user.click(screen.getByRole('button', { name: 'Delete Ramya Menon' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete contact' });
    expect(dialog).toHaveTextContent('The client will have no primary contact.');
  });

  it('keeps the contact when the deletion is cancelled', async () => {
    const removed: string[] = [];
    const user = userEvent.setup();
    await openContacts({
      handlers: [
        http.delete(orgApiPath('/clients/:clientId/contacts/:contactId'), ({ params }) => {
          removed.push(String(params.contactId));
          return ok(null);
        }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Delete Tarak Patel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete contact' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Delete contact' })).toBeNull(),
    );
    expect(removed).toEqual([]);
  });

  it('shows no edit actions to a read-only role', async () => {
    await openContacts({ permissions: STAFF_PERMISSIONS });
    expect(screen.queryByRole('button', { name: 'Add contact' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Tarak Patel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Tarak Patel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make primary' })).toBeNull();
    expect(rowOf(/Tarak Patel/)).toBeInTheDocument();
  });
});
