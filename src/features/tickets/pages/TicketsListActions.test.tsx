import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { fail, ok, server } from '@/test/server';

import { accountsTag, apt1, apt16, apt2, bugTag, detailOf, testTags } from '../test/fixtures';
import { gate, orgApiPath, ticketHandlers } from '../test/handlers';
import { codes, LIST, renderList, rowOf, where } from '../test/listHelpers';
import type { TicketListItem } from '../types';

type User = ReturnType<typeof userEvent.setup>;

/** The list the handlers serve, copied so that a handler can change a ticket as the API would. */
const copies = (): TicketListItem[] => [apt2, apt1, apt16].map((ticket) => ({ ...ticket }));

const bulkOk = (action: string, count = 1, changed = count) =>
  ok({ action, affected: count, changed }, { message: `${String(changed)} tickets updated` });

async function openTags(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog', { name: /^Tags of APT/ });
}

async function tick(user: User, ...ticketCodes: string[]) {
  for (const code of ticketCodes) {
    await user.click(await screen.findByRole('checkbox', { name: `Select ${code}` }));
  }
  return screen.getByRole('region', { name: 'Bulk actions' });
}

async function chooseBulk(user: User, bar: HTMLElement, action: string, option: string) {
  await user.click(within(bar).getByRole('button', { name: action }));
  await user.click(
    within(screen.getByRole('listbox', { name: action })).getByRole('option', { name: option }),
  );
}

describe('the tags of a ticket in the list', () => {
  it('adds a tag at once, with one bulk call, and says so', async () => {
    const user = userEvent.setup();
    const tickets = copies();
    const pending = gate();
    const calls: unknown[] = [];
    server.use(
      http.post(orgApiPath('/tickets/bulk'), async ({ request }) => {
        calls.push(await request.json());
        await pending.promise;
        Object.assign(tickets[0] as TicketListItem, { tags: [bugTag] });
        return bulkOk('add_tag');
      }),
      ...ticketHandlers({ tickets }),
    );
    renderList();

    const popover = await openTags(user, 'Add tags to APT2');
    await user.click(within(popover).getByRole('checkbox', { name: 'Bug' }));

    // At once: the chip is in the row while the call is still on its way.
    expect(within(rowOf('APT2')).getByText('Bug')).toBeInTheDocument();
    await waitFor(() =>
      expect(calls).toEqual([{ ticket_ids: [apt2.id], action: 'add_tag', value: bugTag.id }]),
    );
    pending.open();
    expect(await screen.findByText('Tag Bug added to APT2')).toBeInTheDocument();
    expect(within(rowOf('APT2')).getByText('Bug')).toBeInTheDocument();
  });

  it('takes a tag off the ticket', async () => {
    const user = userEvent.setup();
    const tickets = copies();
    const calls: unknown[] = [];
    server.use(
      http.post(orgApiPath('/tickets/bulk'), async ({ request }) => {
        calls.push(await request.json());
        Object.assign(tickets[1] as TicketListItem, { tags: [bugTag] });
        return bulkOk('remove_tag');
      }),
      ...ticketHandlers({ tickets }),
    );
    renderList();

    const popover = await openTags(user, 'Edit tags of APT1');
    expect(within(popover).getByRole('checkbox', { name: 'Accounts' })).toBeChecked();
    expect(within(popover).getByRole('checkbox', { name: 'Bug' })).toBeChecked();
    expect(within(popover).getByRole('checkbox', { name: 'UI' })).not.toBeChecked();
    await user.click(within(popover).getByRole('checkbox', { name: 'Accounts' }));

    await waitFor(() =>
      expect(calls).toEqual([
        { ticket_ids: [apt1.id], action: 'remove_tag', value: accountsTag.id },
      ]),
    );
    expect(await screen.findByText('Tag Accounts taken off APT1')).toBeInTheDocument();
    await waitFor(() => expect(rowOf('APT1')).not.toHaveTextContent('Accounts'));
    expect(rowOf('APT1')).toHaveTextContent('Bug');
  });

  it('finds a tag by typing and offers to create one that does not exist', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers());
    renderList();
    const popover = await openTags(user, 'Add tags to APT2');

    const field = within(popover).getByRole('textbox', { name: 'Find or create a tag' });
    await user.type(field, 'rep');
    expect(within(popover).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(popover).getByRole('checkbox', { name: 'Reporting' })).toBeInTheDocument();
    // "rep" is not a tag yet: it can be created.
    expect(within(popover).getByRole('button', { name: 'Create “rep”' })).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, 'BUG');
    // A name that exists, in any case, is not offered for creation.
    expect(within(popover).getByRole('checkbox', { name: 'Bug' })).toBeInTheDocument();
    expect(within(popover).queryByRole('button', { name: /^Create/ })).not.toBeInTheDocument();
    await user.clear(field);
    await user.type(field, 'zzz');
    expect(within(popover).getByText('No tag matches.')).toBeInTheDocument();
  });

  it('creates a tag from the box and puts it on the ticket', async () => {
    const user = userEvent.setup();
    const tickets = copies();
    const created: unknown[] = [];
    const calls: unknown[] = [];
    const docs = {
      id: '3f0c9a52-6d1e-4b7a-8a41-0c5e9d2b7f13',
      name: 'Docs',
      color: 'grey' as const,
      ticket_count: 0,
      created_at: '2026-10-18T10:00:00Z',
      updated_at: '2026-10-18T10:00:00Z',
    };
    server.use(
      http.post(orgApiPath('/ticket-tags'), async ({ request }) => {
        created.push(await request.json());
        return ok(docs, { status: 201 });
      }),
      http.post(orgApiPath('/tickets/bulk'), async ({ request }) => {
        calls.push(await request.json());
        Object.assign(tickets[0] as TicketListItem, {
          tags: [{ id: docs.id, name: docs.name, color: docs.color }],
        });
        return bulkOk('add_tag');
      }),
      ...ticketHandlers({ tickets }),
    );
    renderList();
    const popover = await openTags(user, 'Add tags to APT2');

    await user.type(within(popover).getByRole('textbox', { name: 'Find or create a tag' }), 'Docs');
    await user.click(within(popover).getByRole('button', { name: 'Create “Docs”' }));

    await waitFor(() => expect(created).toEqual([{ name: 'Docs' }]));
    await waitFor(() =>
      expect(calls).toEqual([{ ticket_ids: [apt2.id], action: 'add_tag', value: docs.id }]),
    );
    expect(await screen.findByText('Tag Docs added to APT2')).toBeInTheDocument();
    await waitFor(() => expect(rowOf('APT2')).toHaveTextContent('Docs'));
  });

  it("shows the API's reason in the box when a tag name is taken", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/ticket-tags'), () =>
        fail(409, 'TAG_NAME_TAKEN', 'A tag named “Docs” already exists.'),
      ),
      ...ticketHandlers(),
    );
    renderList();
    const popover = await openTags(user, 'Add tags to APT2');

    await user.type(within(popover).getByRole('textbox', { name: 'Find or create a tag' }), 'Docs');
    await user.click(within(popover).getByRole('button', { name: 'Create “Docs”' }));

    expect(await within(popover).findByRole('alert')).toHaveTextContent(
      'A tag named “Docs” already exists.',
    );
  });

  it('puts the tag back and says why when the API refuses', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/tickets/bulk'), () => fail(422, 'VALIDATION_ERROR', 'Too many tags.')),
      ...ticketHandlers(),
    );
    renderList();
    const popover = await openTags(user, 'Add tags to APT2');

    await user.click(within(popover).getByRole('checkbox', { name: 'Bug' }));

    expect(await screen.findByText('Could not change the tags of APT2')).toBeInTheDocument();
    expect(screen.getByText('Too many tags.')).toBeInTheDocument();
    await waitFor(() => expect(rowOf('APT2')).not.toHaveTextContent('Bug'));
    expect(within(popover).getByRole('checkbox', { name: 'Bug' })).not.toBeChecked();
  });
});

describe('bulk actions', () => {
  it('shows how many rows are ticked, ticks them all and lets go', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers());
    renderList();
    await screen.findByRole('link', { name: 'APT1' });
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();

    const bar = await tick(user, 'APT2');
    expect(bar).toHaveTextContent('1 selected');
    expect(
      within(bar)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Set status', 'Set priority', 'Add tag', 'Remove tag', 'Delete', 'Clear selection']);

    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(bar).toHaveTextContent('3 selected');

    await user.click(within(bar).getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select APT2' })).not.toBeChecked();
  });

  it('sets the status of the ticked tickets with one call and reports how many changed', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    server.use(
      http.post(orgApiPath('/tickets/bulk'), async ({ request }) => {
        calls.push(await request.json());
        return bulkOk('set_status', 2);
      }),
      ...ticketHandlers(),
    );
    renderList();
    const bar = await tick(user, 'APT2', 'APT1');

    await chooseBulk(user, bar, 'Set status', 'Closed');

    await waitFor(() =>
      expect(calls).toEqual([
        { ticket_ids: [apt2.id, apt1.id], action: 'set_status', value: 'closed' },
      ]),
    );
    // The toast and the live region say it.
    expect(await screen.findAllByText('2 tickets updated')).toHaveLength(2);
  });

  it('says so when no ticket needed changing', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/tickets/bulk'), () => bulkOk('set_priority', 1, 0)),
      ...ticketHandlers(),
    );
    renderList();
    const bar = await tick(user, 'APT1');

    await chooseBulk(user, bar, 'Set priority', 'High');

    expect(await screen.findAllByText('No ticket needed changing')).toHaveLength(2);
  });

  it('adds and removes a tag of the ticked tickets', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    server.use(
      http.post(orgApiPath('/tickets/bulk'), async ({ request }) => {
        calls.push(await request.json());
        return bulkOk('add_tag', 2);
      }),
      ...ticketHandlers(),
    );
    renderList();
    const bar = await tick(user, 'APT2', 'APT16');

    await chooseBulk(user, bar, 'Add tag', 'Bug');
    await waitFor(() => expect(calls).toHaveLength(1));
    await chooseBulk(user, bar, 'Remove tag', 'Accounts');
    await waitFor(() => expect(calls).toHaveLength(2));

    expect(calls).toEqual([
      { ticket_ids: [apt2.id, apt16.id], action: 'add_tag', value: bugTag.id },
      { ticket_ids: [apt2.id, apt16.id], action: 'remove_tag', value: accountsTag.id },
    ]);
  });

  it('deletes the ticked tickets after a confirmation, and lets go of the selection', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    server.use(
      http.post(orgApiPath('/tickets/bulk'), async ({ request }) => {
        calls.push(await request.json());
        return ok({ action: 'delete', affected: 2, changed: 2 }, { message: '2 tickets deleted' });
      }),
      ...ticketHandlers(),
    );
    renderList();
    const bar = await tick(user, 'APT2', 'APT1');

    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete 2 tickets?' });
    expect(dialog).toHaveTextContent(
      'The selected tickets will be deleted together with their comments and files. This cannot be undone.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Delete tickets' }));

    // No `value` for a delete.
    await waitFor(() =>
      expect(calls).toEqual([{ ticket_ids: [apt2.id, apt1.id], action: 'delete' }]),
    );
    expect(await screen.findAllByText('2 tickets deleted')).toHaveLength(2);
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the dialog open with the reason when the API refuses the delete', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/tickets/bulk'), () =>
        fail(404, 'RESOURCE_NOT_FOUND', 'One of the tickets no longer exists.'),
      ),
      ...ticketHandlers(),
    );
    renderList();
    const bar = await tick(user, 'APT2');

    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete 1 ticket?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete tickets' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'One of the tickets no longer exists.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The selection is still there.
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toHaveTextContent('1 selected');
  });

  it('starts afresh when the filters change', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers());
    renderList();
    await tick(user, 'APT2', 'APT1');

    const toolbar = screen.getByRole('search', { name: 'Filter tickets' });
    await user.click(within(toolbar).getByRole('button', { name: 'Status' }));
    await user.click(
      within(screen.getByRole('listbox', { name: 'Status' })).getByRole('option', { name: 'Open' }),
    );

    await waitFor(() => expect(codes()).toEqual(['APT2']));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });
});

describe('the menu of a row', () => {
  it('offers Open, Copy link and, to a role that may delete, Delete', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers());
    renderList(OWNER_PERMISSIONS);

    await user.click(await screen.findByRole('button', { name: 'Actions for APT1' }));
    const menu = screen.getByRole('menu', { name: 'Actions for APT1' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Open', 'Copy link', 'Delete']);
    expect(within(menu).getByRole('separator')).toBeInTheDocument();
  });

  it('copies the link of the ticket', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers());
    renderList();

    await user.click(await screen.findByRole('button', { name: 'Actions for APT1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Copy link' }));

    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/acme/application-testing/tickets/${apt1.id}`,
    );
  });

  it('deletes a ticket after a confirmation that names it', async () => {
    const user = userEvent.setup();
    const deleted: unknown[] = [];
    server.use(
      http.delete(orgApiPath('/tickets/:ticketId'), ({ params }) => {
        deleted.push(params.ticketId);
        return ok(null, { message: 'Ticket deleted' });
      }),
      ...ticketHandlers(),
    );
    renderList();

    await user.click(await screen.findByRole('button', { name: 'Actions for APT1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete ticket?' });
    expect(dialog).toHaveTextContent(
      'APT1 “Trial balance does not agree” will be deleted with its comments and files. This cannot be undone.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Delete ticket' }));

    await waitFor(() => expect(deleted).toEqual([apt1.id]));
    expect(await screen.findAllByText('APT1 deleted')).toHaveLength(2);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the dialog open with the reason when the API refuses', async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(orgApiPath('/tickets/:ticketId'), () =>
        fail(403, 'PERMISSION_DENIED', 'You may not delete tickets.'),
      ),
      ...ticketHandlers(),
    );
    renderList();

    await user.click(await screen.findByRole('button', { name: 'Actions for APT1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete ticket?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete ticket' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You may not delete tickets.',
    );
  });
});

describe('the new ticket dialog', () => {
  it('opens from the toolbar and raises a ticket with what was entered', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.post(orgApiPath('/tickets'), async ({ request }) => {
        bodies.push(await request.json());
        return ok(detailOf({ ...apt2, id: 'new-id', code: 'APT3', number: 3 }), { status: 201 });
      }),
      ...ticketHandlers({ tags: testTags }),
    );
    renderList();

    await user.click(
      await screen.findByRole('button', { name: 'Application Testing: new ticket' }),
    );
    expect(where()).toBe(`${LIST}?new=1`);
    const dialog = await screen.findByRole('dialog', { name: 'Application Testing' });
    expect(within(dialog).getByLabelText(/Subject/)).toHaveFocus();
    // The defaults of the API.
    expect(within(dialog).getByLabelText('Status')).toHaveValue('open');
    expect(within(dialog).getByLabelText('Priority')).toHaveValue('low');

    await user.type(within(dialog).getByLabelText(/Subject/), '  Report totals disagree  ');
    await user.type(within(dialog).getByLabelText(/Description/), 'Seen on the VAT report.');
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'hold');
    await user.selectOptions(within(dialog).getByLabelText('Priority'), 'high');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(bodies).toEqual([
        {
          subject: 'Report totals disagree',
          description: 'Seen on the VAT report.',
          status: 'hold',
          priority: 'high',
        },
      ]),
    );
    expect(await screen.findByText('Ticket APT3 created')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Application Testing' })).not.toBeInTheDocument(),
    );
    expect(where()).toBe(LIST);
  });

  it('opens from ?new=1 and sends the defaults with a subject and description', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.post(orgApiPath('/tickets'), async ({ request }) => {
        bodies.push(await request.json());
        return ok(detailOf({ ...apt2, id: 'new-id', code: 'APT3', number: 3 }), { status: 201 });
      }),
      ...ticketHandlers(),
    );
    renderList(OWNER_PERMISSIONS, `${LIST}?new=1`);

    const dialog = await screen.findByRole('dialog', { name: 'Application Testing' });
    await user.type(within(dialog).getByLabelText(/Subject/), 'Title only');
    await user.type(within(dialog).getByLabelText(/Description/), 'Some detail');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(bodies).toEqual([
        { subject: 'Title only', description: 'Some detail', status: 'open', priority: 'low' },
      ]),
    );
  });

  it('asks for a subject before it asks the API, and keeps the dialog on Cancel until told', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.post(orgApiPath('/tickets'), async ({ request }) => {
        bodies.push(await request.json());
        return ok(detailOf(apt2), { status: 201 });
      }),
      ...ticketHandlers(),
    );
    renderList(OWNER_PERMISSIONS, `${LIST}?new=1`);

    const dialog = await screen.findByRole('dialog', { name: 'Application Testing' });
    await user.type(within(dialog).getByLabelText(/Subject/), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a subject')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a description')).toBeInTheDocument();
    expect(bodies).toEqual([]);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Application Testing' })).not.toBeInTheDocument(),
    );
    expect(where()).toBe(LIST);
  });

  it("shows the API's refusal under the field it names and keeps what was typed", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/tickets'), () =>
        fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', {
          details: [{ field: 'subject', code: 'too_long', message: 'Use at most 200 characters.' }],
        }),
      ),
      ...ticketHandlers(),
    );
    renderList(OWNER_PERMISSIONS, `${LIST}?new=1`);

    const dialog = await screen.findByRole('dialog', { name: 'Application Testing' });
    await user.type(within(dialog).getByLabelText(/Subject/), 'A long one');
    await user.type(within(dialog).getByLabelText(/Description/), 'Detail');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));

    expect(await within(dialog).findByText('Use at most 200 characters.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Subject/)).toHaveValue('A long one');
    expect(screen.getByRole('dialog', { name: 'Application Testing' })).toBeInTheDocument();
  });

  it('shows a refusal that names no field above the buttons', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(orgApiPath('/tickets'), () =>
        fail(403, 'PERMISSION_DENIED', 'You may not raise tickets.'),
      ),
      ...ticketHandlers(),
    );
    renderList(OWNER_PERMISSIONS, `${LIST}?new=1`);

    const dialog = await screen.findByRole('dialog', { name: 'Application Testing' });
    await user.type(within(dialog).getByLabelText(/Subject/), 'Anything');
    await user.type(within(dialog).getByLabelText(/Description/), 'Detail');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You may not raise tickets.',
    );
  });
});
