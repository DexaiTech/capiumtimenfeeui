import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { fail, ok, server } from '@/test/server';

import { apt1, apt1Detail, apt2, apt2Detail, uiTag } from '../test/fixtures';
import { gate, orgApiPath, ticketHandlers } from '../test/handlers';
import {
  freshDetail,
  installObjectUrls,
  patchTicket,
  renderDetail,
  TICKETS,
} from '../test/detailHelpers';

let urls: ReturnType<typeof installObjectUrls>;
beforeEach(() => {
  urls = installObjectUrls();
});
afterEach(() => {
  urls.restore();
});

/** The description box is a rich text editor: it takes the focus once it is made, then keys. */
const typeInDescription = async (user: ReturnType<typeof userEvent.setup>, keys: string) => {
  const field = await screen.findByRole('textbox', { name: 'Description' });
  await waitFor(() => expect(field).toHaveFocus());
  await user.keyboard(keys);
};

describe('TicketDetailPage', () => {
  it('shows the code, the category, the four fields, the texts and the way back', async () => {
    server.use(...ticketHandlers());
    renderDetail();

    expect(await screen.findByRole('heading', { level: 1, name: 'APT1' })).toBeInTheDocument();
    expect(screen.getByText('Application')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Application Testing' })).toHaveAttribute(
      'href',
      TICKETS,
    );
    expect(screen.getByRole('button', { name: 'Status of APT1: In Progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Priority of APT1: High' })).toBeInTheDocument();
    expect(screen.getByText('18-Oct-2026')).toBeInTheDocument();
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit tags of APT1' })).toBeInTheDocument();
    expect(screen.getByText('Trial balance does not agree')).toBeInTheDocument();
    expect(
      screen.getByText(/The trial balance for year end shows a difference of GBP 12\.50\./),
    ).toHaveTextContent('See the attached screenshot.');
    expect(document.title).toBe('APT1 Trial balance does not agree · Capium Time & Fees');
  });

  it('says so when a ticket has no description and no tags', async () => {
    server.use(...ticketHandlers({ detail: apt2Detail, comments: [] }));
    renderDetail(OWNER_PERMISSIONS, apt2.id);

    expect(await screen.findByRole('heading', { level: 1, name: 'APT2' })).toBeInTheDocument();
    expect(screen.getByText('No description')).toBeInTheDocument();
    expect(screen.getByText('No attachments yet.')).toBeInTheDocument();
    expect(await screen.findByText('No comments yet.')).toBeInTheDocument();
  });

  describe('editing the texts in place', () => {
    it('saves a new subject with Enter, trimmed, and shows it', async () => {
      const user = userEvent.setup();
      const detail = freshDetail();
      const bodies: unknown[] = [];
      server.use(patchTicket(detail, bodies), ...ticketHandlers({ detail }));
      renderDetail();

      await user.click(await screen.findByRole('button', { name: 'Edit subject' }));
      const field = screen.getByRole('textbox', { name: 'Subject' });
      expect(field).toHaveValue('Trial balance does not agree');
      expect(field).toHaveFocus();
      await user.clear(field);
      await user.type(field, '  Trial balance is out by 12.50{Enter}');

      await waitFor(() => expect(bodies).toEqual([{ subject: 'Trial balance is out by 12.50' }]));
      // The toast and the live region.
      expect(await screen.findAllByText('Subject saved')).toHaveLength(2);
      expect(screen.getByText('Trial balance is out by 12.50')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Subject' })).not.toBeInTheDocument();
      expect(document.title).toBe('APT1 Trial balance is out by 12.50 · Capium Time & Fees');
    });

    it('shows a formatted description with its formatting', async () => {
      const detail = freshDetail();
      Object.assign(detail, {
        description: 'Totals\n\n- one\n- two',
        description_html: '<p><strong>Totals</strong></p><ul><li>one</li><li>two</li></ul>',
      });
      server.use(...ticketHandlers({ detail }));
      renderDetail();

      const heading = await screen.findByRole('heading', { name: 'Description' });
      const section = heading.closest('section');
      expect(section?.querySelector('strong')).toHaveTextContent('Totals');
      expect(section?.querySelectorAll('li')).toHaveLength(2);
    });

    it('saves a description with Ctrl+Enter, keeping its lines, and clears it to null', async () => {
      const user = userEvent.setup();
      const detail = freshDetail();
      const bodies: unknown[] = [];
      server.use(patchTicket(detail, bodies), ...ticketHandlers({ detail }));
      renderDetail();

      await user.click(await screen.findByRole('button', { name: 'Edit description' }));
      await typeInDescription(
        user,
        '{Control>}a{/Control}{Backspace}First line{Enter}Second line{Control>}{Enter}{/Control}',
      );
      await waitFor(() =>
        expect(bodies).toEqual([
          {
            description: 'First line\nSecond line',
            description_html: '<p>First line</p><p>Second line</p>',
          },
        ]),
      );
      expect(await screen.findAllByText('Description saved')).toHaveLength(2);

      await user.click(screen.getByRole('button', { name: 'Edit description' }));
      await typeInDescription(user, '{Control>}a{/Control}{Backspace}');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(bodies.at(-1)).toEqual({ description: null }));
      expect(await screen.findByText('No description')).toBeInTheDocument();
    });

    it('cancels with Escape and with Cancel, and sends nothing when the text did not change', async () => {
      const user = userEvent.setup();
      const bodies: unknown[] = [];
      server.use(patchTicket(freshDetail(), bodies), ...ticketHandlers());
      renderDetail();

      await user.click(await screen.findByRole('button', { name: 'Edit subject' }));
      await user.type(screen.getByRole('textbox', { name: 'Subject' }), ' and more{Escape}');
      expect(screen.queryByRole('textbox', { name: 'Subject' })).not.toBeInTheDocument();
      expect(screen.getByText('Trial balance does not agree')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Edit subject' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.queryByRole('textbox', { name: 'Subject' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Edit description' }));
      await user.type(screen.getByRole('textbox', { name: 'Description' }), 'x');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('textbox', { name: 'Description' })).not.toBeInTheDocument();
      expect(bodies).toEqual([]);
    });

    it('asks for a subject before it asks the API', async () => {
      const user = userEvent.setup();
      const bodies: unknown[] = [];
      server.use(patchTicket(freshDetail(), bodies), ...ticketHandlers());
      renderDetail();

      await user.click(await screen.findByRole('button', { name: 'Edit subject' }));
      await user.clear(screen.getByRole('textbox', { name: 'Subject' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Enter a subject')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Subject' })).toBeInTheDocument();
      expect(bodies).toEqual([]);
    });

    it("shows the API's refusal under the field and keeps the editor open", async () => {
      const user = userEvent.setup();
      server.use(
        http.patch(orgApiPath('/tickets/:ticketId'), () =>
          fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', {
            details: [
              {
                field: 'subject',
                code: 'invalid',
                message: 'The subject has a control character.',
              },
            ],
          }),
        ),
        ...ticketHandlers(),
      );
      renderDetail();

      await user.click(await screen.findByRole('button', { name: 'Edit subject' }));
      await user.type(screen.getByRole('textbox', { name: 'Subject' }), '!');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('The subject has a control character.')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(
        'Trial balance does not agree!',
      );
    });

    it('shows the message of a refusal that names no field', async () => {
      const user = userEvent.setup();
      server.use(
        http.patch(orgApiPath('/tickets/:ticketId'), () =>
          fail(403, 'PERMISSION_DENIED', 'You may not edit tickets.'),
        ),
        ...ticketHandlers(),
      );
      renderDetail();

      await user.click(await screen.findByRole('button', { name: 'Edit description' }));
      await typeInDescription(user, ' More.');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('You may not edit tickets.')).toBeInTheDocument();
    });
  });

  describe('status, priority and tags', () => {
    it('changes the status at once and keeps it when the API accepts it', async () => {
      const user = userEvent.setup();
      const detail = freshDetail();
      const pending = gate();
      const bodies: unknown[] = [];
      server.use(
        http.patch(orgApiPath('/tickets/:ticketId'), async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          bodies.push(body);
          await pending.promise;
          Object.assign(detail, body, { closed_at: '2026-10-18T10:00:00Z' });
          return ok(detail);
        }),
        ...ticketHandlers({ detail }),
      );
      renderDetail();

      await user.click(await screen.findByRole('button', { name: 'Status of APT1: In Progress' }));
      await user.click(screen.getByRole('option', { name: 'Closed' }));

      expect(
        await screen.findByRole('button', { name: 'Status of APT1: Closed' }),
      ).toBeInTheDocument();
      await waitFor(() => expect(bodies).toEqual([{ status: 'closed' }]));
      pending.open();
      expect(await screen.findByText('Status of APT1 set to Closed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Status of APT1: Closed' })).toBeInTheDocument();
    });

    it('puts a priority back and says why when the API refuses it', async () => {
      const user = userEvent.setup();
      server.use(
        http.patch(orgApiPath('/tickets/:ticketId'), () =>
          fail(422, 'VALIDATION_ERROR', 'That priority is not allowed.'),
        ),
        ...ticketHandlers(),
      );
      renderDetail();

      await user.click(await screen.findByRole('button', { name: 'Priority of APT1: High' }));
      await user.click(screen.getByRole('option', { name: 'Low' }));

      expect(await screen.findByText('Could not change APT1')).toBeInTheDocument();
      expect(screen.getByText('That priority is not allowed.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Priority of APT1: High' })).toBeInTheDocument();
    });

    it('adds a tag from the popover with one bulk call', async () => {
      const user = userEvent.setup();
      const detail = freshDetail();
      const calls: unknown[] = [];
      server.use(
        http.post(orgApiPath('/tickets/bulk'), async ({ request }) => {
          calls.push(await request.json());
          detail.tags = [...detail.tags, uiTag];
          return ok({ action: 'add_tag', affected: 1, changed: 1 });
        }),
        ...ticketHandlers({ detail }),
      );
      renderDetail();

      await user.click(await screen.findByRole('button', { name: 'Edit tags of APT1' }));
      const popover = screen.getByRole('dialog', { name: 'Tags of APT1' });
      await user.click(within(popover).getByRole('checkbox', { name: 'UI' }));

      await waitFor(() =>
        expect(calls).toEqual([{ ticket_ids: [apt1.id], action: 'add_tag', value: uiTag.id }]),
      );
      expect(await screen.findByText('Tag UI added to APT1')).toBeInTheDocument();
      expect(within(popover).getByRole('checkbox', { name: 'UI' })).toBeChecked();
    });
  });

  describe('states', () => {
    it('shows a skeleton while loading', () => {
      server.use(http.get(orgApiPath('/tickets/:ticketId'), () => new Promise(() => undefined)));
      renderDetail();
      expect(screen.getByRole('status', { name: 'Loading the ticket' })).toBeInTheDocument();
    });

    it('says the ticket was not found and leads back to the list', async () => {
      server.use(...ticketHandlers());
      renderDetail(OWNER_PERMISSIONS, '00000000-0000-4000-8000-000000000000');

      expect(await screen.findByText('Ticket not found')).toBeInTheDocument();
      expect(
        screen.getByText('It may have been deleted, or the link is not right.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to Application Testing' })).toHaveAttribute(
        'href',
        TICKETS,
      );
    });

    it('shows the error with a retry, and the ticket once the retry works', async () => {
      const user = userEvent.setup();
      let failing = true;
      server.use(
        http.get(orgApiPath('/tickets/:ticketId'), () =>
          failing ? fail(500, 'INTERNAL_ERROR', 'Boom.') : ok(apt1Detail),
        ),
        ...ticketHandlers(),
      );
      renderDetail();

      expect(await screen.findByText('Could not load the ticket')).toBeInTheDocument();
      failing = false;
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'APT1' })).toBeInTheDocument();
    });

    it('tells a role without ticket.read that the page is not included', () => {
      renderDetail(['client.read']);
      expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1, name: 'APT1' })).not.toBeInTheDocument();
    });
  });

  describe('by role', () => {
    it('shows a role that may only read the ticket without any way to change it', async () => {
      server.use(...ticketHandlers());
      renderDetail(['ticket.read']);

      expect(await screen.findByRole('heading', { level: 1, name: 'APT1' })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^Edit (subject|description)/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^(Status|Priority) of / }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Edit tags/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Comment' })).not.toBeInTheDocument();
      expect(
        screen.getByText('Your role can open the files of this ticket but not add new ones.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Choose a file' })).not.toBeInTheDocument();
      // What is there is still readable.
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Accounts')).toBeInTheDocument();
    });

    it('lets Staff edit the ticket', async () => {
      server.use(...ticketHandlers());
      renderDetail(STAFF_PERMISSIONS);

      expect(await screen.findByRole('button', { name: 'Edit subject' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Status of APT1: In Progress' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Comment' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose a file' })).toBeInTheDocument();
    });
  });
});
