import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { fail, ok, server } from '@/test/server';

import { freshDetail, patchTicket, renderDetail } from '../test/detailHelpers';
import { testTimeline } from '../test/fixtures';
import { orgApiPath, ticketHandlers } from '../test/handlers';
import type { TimelineEvent } from '../types';

const timelineList = () => screen.findByRole('list', { name: 'Ticket timeline' });

describe('the timeline of a ticket', () => {
  it('lists what happened, newest first, each with who did it', async () => {
    server.use(...ticketHandlers());
    renderDetail();

    expect(await screen.findByRole('heading', { level: 2, name: 'Timeline' })).toBeInTheDocument();
    const items = within(await timelineList()).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('added a comment');
    expect(items[0]).toHaveTextContent('Looks like the opening balance.');
    expect(items[1]).toHaveTextContent('changed the tags');
    expect(items[1]).toHaveTextContent('+ Reporting');
    expect(items[1]).toHaveTextContent('− Docs');
    expect(items[2]).toHaveTextContent('changed the status');
    expect(items[2]).toHaveTextContent('Open');
    expect(items[2]).toHaveTextContent('Requirement Pending');
    expect(items[3]).toHaveTextContent('created the ticket');
    for (const item of items) expect(item).toHaveTextContent('User 001');
  });

  it('describes priority, assignee, subject, description and file events', async () => {
    const at = '2026-10-22T09:00:00Z';
    const event = (id: string, kind: TimelineEvent['kind'], rest: Partial<TimelineEvent>) => ({
      ...testTimeline[0],
      id,
      kind,
      at,
      detail: null,
      comment_id: null,
      added: [],
      removed: [],
      before: null,
      after: null,
      ...rest,
    });
    const events = [
      event('a', 'priority_changed', { before: 'not_set', after: 'high' }),
      event('b', 'assignee_changed', { before: 'Unassigned', after: 'Bob Brown' }),
      event('c', 'assignee_changed', { before: 'Bob Brown', after: 'Unassigned' }),
      event('d', 'subject_changed', { before: 'Crash', after: 'Crash on login' }),
      event('e', 'description_changed', {}),
      event('f', 'file_added', { detail: 'shot.png' }),
      event('g', 'file_removed', { detail: 'shot.png' }),
      event('h', 'comment_deleted', { actor: null, bulk: true }),
    ] as TimelineEvent[];
    server.use(...ticketHandlers({ timeline: events }));
    renderDetail();

    const items = within(await timelineList()).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('changed the priority');
    expect(items[0]).toHaveTextContent('Not Set');
    expect(items[0]).toHaveTextContent('High');
    expect(items[1]).toHaveTextContent('changed the assignee');
    expect(items[1]).toHaveTextContent('Bob Brown');
    expect(items[2]).toHaveTextContent('removed the assignee');
    expect(items[3]).toHaveTextContent('changed the subject');
    expect(items[3]).toHaveTextContent('Crash on login');
    expect(items[4]).toHaveTextContent('edited the description');
    expect(items[5]).toHaveTextContent('attached a file');
    expect(items[5]).toHaveTextContent('shot.png');
    expect(items[6]).toHaveTextContent('removed a file');
    // What nobody did by hand: the system, and the mark of a bulk action.
    expect(items[7]).toHaveTextContent('The system deleted a comment (bulk action)');
  });

  it('says so when nothing has happened', async () => {
    server.use(...ticketHandlers({ timeline: [] }));
    renderDetail();
    expect(await screen.findByText('Nothing has happened to this ticket yet.')).toBeInTheDocument();
  });

  it('loads more events a page at a time', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers({ commentPageSize: 2 }));
    renderDetail();

    const list = await timelineList();
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Load more events' }));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(4));
    expect(screen.queryByRole('button', { name: 'Load more events' })).not.toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    let failing = true;
    server.use(
      http.get(orgApiPath('/tickets/:ticketId/timeline'), () =>
        failing
          ? fail(500, 'INTERNAL_ERROR', 'Boom.')
          : ok(testTimeline, { meta: { next_cursor: null, has_more: false } }),
      ),
      ...ticketHandlers(),
    );
    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByText('Could not load the timeline')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await timelineList()).toBeInTheDocument();
  });

  it('is read again after the ticket changes', async () => {
    const user = userEvent.setup();
    const detail = freshDetail();
    let reads = 0;
    server.use(
      http.get(orgApiPath('/tickets/:ticketId/timeline'), () => {
        reads += 1;
        return ok(testTimeline, { meta: { next_cursor: null, has_more: false } });
      }),
      ...ticketHandlers({ detail }),
      patchTicket(detail),
    );
    renderDetail(OWNER_PERMISSIONS);
    await timelineList();
    expect(reads).toBe(1);

    await user.click(await screen.findByRole('button', { name: /^Status of APT1/ }));
    await user.click(screen.getByRole('option', { name: /^Blocked/ }));
    await waitFor(() => expect(reads).toBe(2));
  });
});
