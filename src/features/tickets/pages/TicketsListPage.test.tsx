import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { fail, ok, server } from '@/test/server';

import { apt1, apt2, apt16, bugTag, detailOf } from '../test/fixtures';
import { gate, orgApiPath, ticketHandlers } from '../test/handlers';
import { codes, LIST, renderList, rowOf, where } from '../test/listHelpers';

/** One of the toolbar's filters (the table's headers have buttons of the same names). */
async function chooseFrom(
  user: ReturnType<typeof userEvent.setup>,
  filter: string,
  option: string,
) {
  const toolbar = screen.getByRole('search', { name: 'Filter tickets' });
  await user.click(within(toolbar).getByRole('button', { name: filter }));
  await user.click(
    within(screen.getByRole('listbox', { name: filter })).getByRole('option', { name: option }),
  );
}

describe('TicketsListPage', () => {
  it('lists the tickets newest first with code, subject, tags, day, status and priority', async () => {
    server.use(...ticketHandlers());
    renderList();

    expect(screen.getByRole('heading', { level: 1, name: 'All Tickets' })).toBeInTheDocument();
    await screen.findByRole('link', { name: 'APT1' });
    expect(codes()).toEqual(['APT2', 'APT1', 'APT16']);

    const second = rowOf('APT1');
    expect(within(second).getByRole('link', { name: 'APT1' })).toHaveAttribute(
      'href',
      `/acme/application-testing/tickets/${apt1.id}`,
    );
    expect(
      within(second).getByRole('link', { name: 'Trial balance does not agree' }),
    ).toBeInTheDocument();
    expect(second).toHaveTextContent('AccountsBug');
    expect(second).toHaveTextContent('18-Oct-2026');
    expect(
      within(second).getByRole('button', { name: 'Status of APT1: In Progress' }),
    ).toBeInTheDocument();
    expect(
      within(second).getByRole('button', { name: 'Priority of APT1: High' }),
    ).toBeInTheDocument();

    // No tag yet: the way to add one is in the row.
    expect(
      within(rowOf('APT2')).getByRole('button', { name: 'Add tags to APT2' }),
    ).toHaveTextContent('Add tags');
    expect(within(second).getByRole('button', { name: 'Edit tags of APT1' })).toBeInTheDocument();
    expect(screen.getByText('Showing 3 tickets · End of the list')).toBeInTheDocument();
  });

  it('marks the sort of the list and leaves the tags unsortable', async () => {
    server.use(...ticketHandlers());
    renderList();
    await screen.findByRole('link', { name: 'APT1' });

    expect(screen.getByRole('columnheader', { name: /Created on/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: /Ticket No\./ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
    expect(screen.getByRole('columnheader', { name: 'Tags' })).not.toHaveAttribute('aria-sort');
    expect(screen.queryByRole('button', { name: 'Tags' })).not.toBeInTheDocument();
  });

  it('shows skeleton rows while loading', () => {
    server.use(
      http.get(orgApiPath('/tickets'), () => new Promise(() => undefined)),
      ...ticketHandlers(),
    );
    renderList();
    expect(document.querySelector('table[aria-busy="true"]')).not.toBeNull();
  });

  it('sorts on the server: the first click ascending, the next descending, in the URL', async () => {
    const user = userEvent.setup();
    const queries: URLSearchParams[] = [];
    server.use(...ticketHandlers({ onTicketList: (params) => queries.push(params) }));
    renderList();
    await screen.findByRole('link', { name: 'APT1' });
    expect(queries[0]?.get('sort')).toBe('created_at');
    expect(queries[0]?.get('order')).toBe('desc');

    await user.click(screen.getByRole('button', { name: 'Ticket No.' }));
    await waitFor(() => expect(queries.at(-1)?.get('sort')).toBe('number'));
    expect(queries.at(-1)?.get('order')).toBe('asc');
    await waitFor(() => expect(codes()).toEqual(['APT1', 'APT2', 'APT16']));
    expect(where()).toBe(`${LIST}?sort=number&order=asc`);
    expect(screen.getByRole('columnheader', { name: /Ticket No\./ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(screen.getByRole('button', { name: 'Ticket No.' }));
    await waitFor(() => expect(queries.at(-1)?.get('order')).toBe('desc'));
    await waitFor(() => expect(codes()).toEqual(['APT16', 'APT2', 'APT1']));

    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Priority' }));
    await waitFor(() => expect(queries.at(-1)?.get('sort')).toBe('priority'));
    await waitFor(() => expect(codes()).toEqual(['APT1', 'APT2', 'APT16']));
  });

  it('searches the code, the subject and the description once typing pauses', async () => {
    const user = userEvent.setup();
    const queries: URLSearchParams[] = [];
    server.use(...ticketHandlers({ onTicketList: (params) => queries.push(params) }));
    renderList();
    await screen.findByRole('link', { name: 'APT1' });

    await user.type(screen.getByRole('searchbox', { name: 'Search tickets' }), 'trial');
    await waitFor(() => expect(queries.at(-1)?.get('q')).toBe('trial'));
    await waitFor(() => expect(codes()).toEqual(['APT1']));
    expect(where()).toBe(`${LIST}?q=trial`);
    // Typing is not one request per letter: the search waits for a pause.
    expect(queries.filter((query) => query.has('q')).length).toBeLessThanOrEqual(2);
  });

  it('filters by tag, priority and status, names the choice on the button and keeps it in the URL', async () => {
    const user = userEvent.setup();
    const queries: URLSearchParams[] = [];
    server.use(...ticketHandlers({ onTicketList: (params) => queries.push(params) }));
    renderList();
    await screen.findByRole('link', { name: 'APT1' });
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();

    await chooseFrom(user, 'All Tags', 'Bug');
    await waitFor(() => expect(queries.at(-1)?.getAll('tag_id')).toEqual([bugTag.id]));
    await waitFor(() => expect(codes()).toEqual(['APT1']));
    expect(screen.getByRole('button', { name: 'Bug' })).toBeInTheDocument();
    expect(where()).toBe(`${LIST}?tag=${bugTag.id}`);

    await user.keyboard('{Escape}');
    await chooseFrom(user, 'Priority', 'High');
    await waitFor(() => expect(queries.at(-1)?.getAll('priority')).toEqual(['high']));

    await user.keyboard('{Escape}');
    await chooseFrom(user, 'Status', 'In Progress');
    await waitFor(() => expect(queries.at(-1)?.getAll('status')).toEqual(['in_progress']));
    // Two choices make a count.
    await user.click(screen.getByRole('option', { name: 'Open' }));
    await waitFor(() => expect(queries.at(-1)?.getAll('status')).toEqual(['in_progress', 'open']));
    expect(screen.getByRole('button', { name: 'Status · 2' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(queries.at(-1)?.has('status')).toBe(false));
    expect(queries.at(-1)?.has('priority')).toBe(false);
    expect(queries.at(-1)?.has('tag_id')).toBe(false);
    await waitFor(() => expect(codes()).toEqual(['APT2', 'APT1', 'APT16']));
    expect(where()).toBe(LIST);
  });

  it('reads the filters, the search and the sort from the address', async () => {
    const queries: URLSearchParams[] = [];
    server.use(...ticketHandlers({ onTicketList: (params) => queries.push(params) }));
    renderList(
      OWNER_PERMISSIONS,
      `${LIST}?q=trial&status=open&status=reopen&priority=high&tag=${bugTag.id}&sort=subject&order=asc`,
    );

    await waitFor(() => expect(queries.length).toBeGreaterThan(0));
    const first = queries[0];
    expect(first?.get('q')).toBe('trial');
    expect(first?.getAll('status')).toEqual(['open', 'reopen']);
    expect(first?.getAll('priority')).toEqual(['high']);
    expect(first?.getAll('tag_id')).toEqual([bugTag.id]);
    expect(first?.get('sort')).toBe('subject');
    expect(first?.get('order')).toBe('asc');
    expect(screen.getByRole('searchbox', { name: 'Search tickets' })).toHaveValue('trial');
    expect(screen.getByRole('button', { name: 'Status · 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument();
  });

  it('ignores values in the address that are not statuses, priorities or sorts', async () => {
    const queries: URLSearchParams[] = [];
    server.use(...ticketHandlers({ onTicketList: (params) => queries.push(params) }));
    renderList(OWNER_PERMISSIONS, `${LIST}?status=done&priority=urgent&sort=color&order=sideways`);

    await waitFor(() => expect(queries.length).toBeGreaterThan(0));
    expect(queries[0]?.has('status')).toBe(false);
    expect(queries[0]?.has('priority')).toBe(false);
    expect(queries[0]?.get('sort')).toBe('created_at');
    expect(queries[0]?.get('order')).toBe('desc');
  });

  it('loads the next page on request', async () => {
    const user = userEvent.setup();
    const queries: URLSearchParams[] = [];
    server.use(...ticketHandlers({ pageSize: 2, onTicketList: (params) => queries.push(params) }));
    renderList();

    await screen.findByRole('link', { name: 'APT1' });
    expect(codes()).toEqual(['APT2', 'APT1']);
    expect(screen.getByText('Showing 2 tickets')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(codes()).toEqual(['APT2', 'APT1', 'APT16']));
    expect(queries.at(-1)?.get('cursor')).toBe('2');
    expect(screen.getByText('Showing 3 tickets · End of the list')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  describe('changing a ticket in its row', () => {
    it('shows a new status at once and keeps it when the API accepts it', async () => {
      const user = userEvent.setup();
      const pending = gate();
      const bodies: unknown[] = [];
      server.use(
        http.patch(orgApiPath('/tickets/:ticketId'), async ({ request }) => {
          bodies.push(await request.json());
          await pending.promise;
          return ok(detailOf({ ...apt2, status: 'closed', closed_at: '2026-10-18T10:00:00Z' }));
        }),
        ...ticketHandlers(),
      );
      renderList();

      await user.click(await screen.findByRole('button', { name: 'Status of APT2: Open' }));
      await user.click(screen.getByRole('option', { name: 'Closed' }));

      expect(
        await screen.findByRole('button', { name: 'Status of APT2: Closed' }),
      ).toBeInTheDocument();
      await waitFor(() => expect(bodies).toEqual([{ status: 'closed' }]));
      pending.open();
      expect(await screen.findByText('Status of APT2 set to Closed')).toBeInTheDocument();
    });

    it('puts a priority back and explains when the ticket has been deleted meanwhile', async () => {
      const user = userEvent.setup();
      server.use(
        http.patch(orgApiPath('/tickets/:ticketId'), () =>
          fail(404, 'RESOURCE_NOT_FOUND', 'Ticket not found.'),
        ),
        ...ticketHandlers(),
      );
      renderList();

      await user.click(await screen.findByRole('button', { name: 'Priority of APT2: Medium' }));
      await user.click(screen.getByRole('option', { name: 'Low' }));

      expect(await screen.findByText('That ticket no longer exists')).toBeInTheDocument();
      expect(
        screen.getByText('It may have been deleted by someone else. The list has been refreshed.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Priority of APT2: Medium' })).toBeInTheDocument();
    });
  });

  describe('states', () => {
    it('invites a practice without tickets to raise the first', async () => {
      server.use(...ticketHandlers({ tickets: [] }));
      renderList();

      expect(await screen.findByText('No tickets yet')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Tickets track the bugs and enhancements found while using the application.',
        ),
      ).toBeInTheDocument();
      // The toolbar's button and the one of the empty state: they say "Application Testing" and
      // are named for what they do.
      expect(
        screen.getAllByRole('button', { name: 'Application Testing: new ticket' }),
      ).toHaveLength(2);
      for (const button of screen.getAllByRole('button', {
        name: 'Application Testing: new ticket',
      })) {
        expect(button).toHaveTextContent('Application Testing');
      }
    });

    it('says nothing matches and offers to clear the filters', async () => {
      const user = userEvent.setup();
      server.use(...ticketHandlers());
      renderList();
      await screen.findByRole('link', { name: 'APT1' });

      await user.type(screen.getByRole('searchbox', { name: 'Search tickets' }), 'zzz');
      expect(await screen.findByText('No tickets match')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Clear filters' }));
      await waitFor(() => expect(codes()).toEqual(['APT2', 'APT1', 'APT16']));
      expect(screen.getByRole('searchbox', { name: 'Search tickets' })).toHaveValue('');
    });

    it('shows the error with a retry', async () => {
      const user = userEvent.setup();
      let failing = true;
      server.use(
        http.get(orgApiPath('/tickets'), () =>
          failing
            ? fail(500, 'INTERNAL_ERROR', 'Boom.')
            : ok([apt1], { meta: { next_cursor: null, has_more: false } }),
        ),
        ...ticketHandlers(),
      );
      renderList();

      expect(await screen.findByText('Could not load the tickets')).toBeInTheDocument();
      failing = false;
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('link', { name: 'APT1' })).toBeInTheDocument();
    });
  });

  describe('by role', () => {
    it('gives a role that may only read a plain list: no create button, ticking, pills or tag editing', async () => {
      server.use(...ticketHandlers());
      renderList(['ticket.read']);
      await screen.findByRole('link', { name: 'APT1' });

      expect(
        screen.queryByRole('button', { name: 'Application Testing: new ticket' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Status of / })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Priority of / })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /tags (to|of)/i })).not.toBeInTheDocument();
      // The values are still there as text; an untagged ticket shows a dash.
      expect(rowOf('APT2')).toHaveTextContent('Open');
      expect(rowOf('APT2')).toHaveTextContent('Medium');
      expect(rowOf('APT2')).toHaveTextContent('—');
      expect(screen.getByRole('searchbox', { name: 'Search tickets' })).toBeInTheDocument();
    });

    it('does not open the new-ticket dialog for a role that may not create', async () => {
      server.use(...ticketHandlers());
      renderList(['ticket.read'], `${LIST}?new=1`);
      await screen.findByRole('link', { name: 'APT1' });
      expect(screen.queryByRole('dialog', { name: 'Application Testing' })).not.toBeInTheDocument();
    });

    it('lets Staff create, tick and edit; there is no delete for anyone', async () => {
      const user = userEvent.setup();
      server.use(...ticketHandlers());
      renderList(STAFF_PERMISSIONS);
      await screen.findByRole('link', { name: 'APT1' });

      expect(
        screen.getByRole('button', { name: 'Application Testing: new ticket' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Status of APT1: In Progress' }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('checkbox', { name: 'Select APT1' }));
      const bulk = screen.getByRole('region', { name: 'Bulk actions' });
      expect(within(bulk).getByRole('button', { name: 'Set status' })).toBeInTheDocument();
      expect(within(bulk).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Actions for APT1' }));
      const menu = screen.getByRole('menu', { name: 'Actions for APT1' });
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.textContent),
      ).toEqual(['Open', 'Copy link']);
    });

    it('tells a role without ticket.read that the page is not included', () => {
      renderList(['client.read']);
      expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
      expect(screen.queryByRole('searchbox', { name: 'Search tickets' })).not.toBeInTheDocument();
    });
  });

  it('opens a ticket from its row menu', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers());
    renderList();
    await screen.findByRole('link', { name: 'APT16' });

    await user.click(screen.getByRole('button', { name: 'Actions for APT16' }));
    await user.click(screen.getByRole('menuitem', { name: 'Open' }));
    expect(await screen.findByText('Ticket page')).toBeInTheDocument();
    expect(where()).toBe(`${LIST}/${apt16.id}`);
  });
});
