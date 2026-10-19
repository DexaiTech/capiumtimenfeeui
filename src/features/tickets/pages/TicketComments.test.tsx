import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { fail, ok, server } from '@/test/server';

import {
  freshDetail,
  installObjectUrls,
  notesCsv,
  pngFile,
  renderDetail,
} from '../test/detailHelpers';
import { ada, adaComment, apt1, bobComment, testComments } from '../test/fixtures';
import { gate, orgApiPath, ticketHandlers } from '../test/handlers';
import type { TicketComment } from '../types';

let urls: ReturnType<typeof installObjectUrls>;
beforeEach(() => {
  urls = installObjectUrls();
});
afterEach(() => {
  urls.restore();
});

/** A thread the handlers serve and change the way the API would. */
const thread = (): TicketComment[] => structuredClone(testComments);

const commentOf = (author: string): HTMLElement => {
  const item = screen.getByText(author, { selector: 'span' }).closest('li');
  if (!item) throw new Error(`No comment by ${author}`);
  return item;
};

/** `POST /tickets/{id}/comments`: records the body and adds the comment to the thread. */
function addComment(comments: TicketComment[], bodies: unknown[]) {
  return http.post(orgApiPath('/tickets/:ticketId/comments'), async ({ request }) => {
    const body = (await request.json()) as { body: string; attachment_ids?: string[] };
    bodies.push(body);
    const created: TicketComment = {
      id: `c-${String(comments.length + 1)}`,
      ticket_id: apt1.id,
      author: ada,
      body: body.body,
      edited_at: null,
      created_at: '2026-10-18T10:00:00Z',
      attachments: (body.attachment_ids ?? []).map(() => ({ ...notesCsv, comment_id: 'c-new' })),
    };
    comments.push(created);
    return ok(created, { status: 201, message: 'Comment added' });
  });
}

describe('the comments of a ticket', () => {
  it('shows the thread oldest first with author, time, edited marker and files', async () => {
    server.use(...ticketHandlers());
    renderDetail();

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Comments (2)' }),
    ).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Comments' });
    // Two comments (the file inside the first is a list item of its own).
    expect(list.children).toHaveLength(2);

    const first = commentOf('Ada Lovelace');
    expect(first).toHaveTextContent('Reproduced on the demo practice.');
    expect(first.querySelector('time')).toHaveAttribute('datetime', adaComment.created_at);
    expect(first).not.toHaveTextContent('(edited)');
    expect(
      within(first).getByRole('button', { name: 'Download differences.xlsx' }),
    ).toBeInTheDocument();

    const second = commentOf('Bob Brown');
    expect(second).toHaveTextContent('Same difference after the second client is selected.');
    expect(second).toHaveTextContent('(edited)');
    expect(second.querySelector('time')).toHaveAttribute('datetime', bobComment.created_at);
  });

  it('shows a skeleton while the thread loads', async () => {
    server.use(
      http.get(orgApiPath('/tickets/:ticketId/comments'), () => new Promise(() => undefined)),
      ...ticketHandlers(),
    );
    renderDetail();
    expect(await screen.findByRole('status', { name: 'Loading comments' })).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    let failing = true;
    const comments = thread();
    server.use(
      http.get(orgApiPath('/tickets/:ticketId/comments'), () =>
        failing
          ? fail(500, 'INTERNAL_ERROR', 'Boom.')
          : ok(comments, { meta: { next_cursor: null, has_more: false } }),
      ),
      ...ticketHandlers(),
    );
    renderDetail();

    expect(await screen.findByText('Could not load the comments')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Reproduced on the demo practice.')).toBeInTheDocument();
  });

  it('loads more comments a page at a time', async () => {
    const user = userEvent.setup();
    server.use(...ticketHandlers({ commentPageSize: 1 }));
    renderDetail();

    await screen.findByText('Reproduced on the demo practice.');
    expect(
      screen.queryByText('Same difference after the second client is selected.'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more comments' }));
    expect(
      await screen.findByText('Same difference after the second client is selected.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more comments' })).not.toBeInTheDocument();
  });

  describe('adding a comment', () => {
    it('sends the text with Enter, trimmed, empties the box and says so', async () => {
      const user = userEvent.setup();
      const detail = freshDetail();
      const comments = thread();
      const bodies: unknown[] = [];
      server.use(
        http.post(orgApiPath('/tickets/:ticketId/comments'), async ({ request }) => {
          const body = (await request.json()) as { body: string };
          bodies.push(body);
          const created: TicketComment = {
            ...adaComment,
            id: 'c-3',
            body: body.body,
            attachments: [],
            edited_at: null,
          };
          comments.push(created);
          detail.comment_count += 1;
          return ok(created, { status: 201, message: 'Comment added' });
        }),
        ...ticketHandlers({ detail, comments }),
      );
      renderDetail();

      const box = await screen.findByRole('textbox', { name: 'Comment' });
      const send = screen.getByRole('button', { name: 'Send comment' });
      expect(send).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Add Comment' })).toBeDisabled();
      await user.type(box, '  Fixed by the 18 October build  {Enter}');

      await waitFor(() => expect(bodies).toEqual([{ body: 'Fixed by the 18 October build' }]));
      expect(await screen.findByText('Fixed by the 18 October build')).toBeInTheDocument();
      expect(box).toHaveValue('');
      expect(screen.getByText('Comment added')).toBeInTheDocument();
      expect(
        await screen.findByRole('heading', { level: 2, name: 'Comments (3)' }),
      ).toBeInTheDocument();
    });

    it('sends with the Add Comment button, and starts a new line with Shift+Enter', async () => {
      const user = userEvent.setup();
      const comments = thread();
      const bodies: unknown[] = [];
      server.use(addComment(comments, bodies), ...ticketHandlers({ comments }));
      renderDetail();

      const box = await screen.findByRole('textbox', { name: 'Comment' });
      await user.type(box, 'First{Shift>}{Enter}{/Shift}Second');
      expect(box).toHaveValue('First\nSecond');
      expect(bodies).toEqual([]);
      await user.click(screen.getByRole('button', { name: 'Add Comment' }));

      await waitFor(() => expect(bodies).toEqual([{ body: 'First\nSecond' }]));
    });

    it('does not send text that is only white space', async () => {
      const user = userEvent.setup();
      const bodies: unknown[] = [];
      server.use(addComment(thread(), bodies), ...ticketHandlers());
      renderDetail();

      const box = await screen.findByRole('textbox', { name: 'Comment' });
      await user.type(box, '   {Enter}');
      expect(screen.getByRole('button', { name: 'Send comment' })).toBeDisabled();
      expect(bodies).toEqual([]);
    });

    it("shows the API's refusal and keeps the text", async () => {
      const user = userEvent.setup();
      server.use(
        http.post(orgApiPath('/tickets/:ticketId/comments'), () =>
          fail(422, 'VALIDATION_ERROR', 'The comment may not contain control characters.'),
        ),
        ...ticketHandlers(),
      );
      renderDetail();

      const box = await screen.findByRole('textbox', { name: 'Comment' });
      await user.type(box, 'Something{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The comment may not contain control characters.',
      );
      expect(box).toHaveValue('Something');
    });

    it('attaches a pasted screenshot: uploaded at once, sent with the comment, even without text', async () => {
      const user = userEvent.setup();
      const comments = thread();
      const bodies: unknown[] = [];
      const uploaded: string[] = [];
      server.use(
        http.post(orgApiPath('/tickets/:ticketId/attachments'), () => {
          uploaded.push('file');
          return ok(
            {
              ...notesCsv,
              id: 'att-new',
              file_name: 'image.png',
              content_type: 'image/png',
              is_image: true,
            },
            { status: 201 },
          );
        }),
        addComment(comments, bodies),
        ...ticketHandlers({ comments }),
      );
      renderDetail();

      const box = await screen.findByRole('textbox', { name: 'Comment' });
      fireEvent.paste(box, {
        clipboardData: { files: [pngFile('image.png')], types: ['Files'], getData: () => '' },
      });

      const files = await screen.findByRole('list', { name: 'Files for this comment' });
      expect(await within(files).findByText(/^Attached · 69 B$/)).toBeInTheDocument();
      expect(within(files).getByText('image.png')).toBeInTheDocument();
      expect(uploaded).toHaveLength(1);
      // A comment may be only a file.
      const send = screen.getByRole('button', { name: 'Send comment' });
      expect(send).toBeEnabled();
      await user.click(send);

      await waitFor(() => expect(bodies).toEqual([{ body: '', attachment_ids: ['att-new'] }]));
      await waitFor(() =>
        expect(
          screen.queryByRole('list', { name: 'Files for this comment' }),
        ).not.toBeInTheDocument(),
      );
    });

    it('lets a paste that carries text be a text paste', async () => {
      let posts = 0;
      server.use(
        http.post(orgApiPath('/tickets/:ticketId/attachments'), () => {
          posts += 1;
          return ok(notesCsv, { status: 201 });
        }),
        ...ticketHandlers(),
      );
      renderDetail();

      const box = await screen.findByRole('textbox', { name: 'Comment' });
      fireEvent.paste(box, {
        clipboardData: {
          files: [pngFile('range.png')],
          types: ['Files', 'text/plain'],
          getData: () => '1\t2',
        },
      });

      expect(
        screen.queryByRole('list', { name: 'Files for this comment' }),
      ).not.toBeInTheDocument();
      expect(posts).toBe(0);
    });

    it('deletes a pasted file again when it is taken off the comment before sending', async () => {
      const user = userEvent.setup();
      const removed: unknown[] = [];
      server.use(
        http.post(orgApiPath('/tickets/:ticketId/attachments'), () =>
          ok({ ...notesCsv, id: 'att-new', file_name: 'image.png' }, { status: 201 }),
        ),
        http.delete(orgApiPath('/tickets/:ticketId/attachments/:attachmentId'), ({ params }) => {
          removed.push(params.attachmentId);
          return ok(null, { message: 'File deleted' });
        }),
        ...ticketHandlers(),
      );
      renderDetail();

      const box = await screen.findByRole('textbox', { name: 'Comment' });
      fireEvent.paste(box, {
        clipboardData: { files: [pngFile('image.png')], types: ['Files'], getData: () => '' },
      });
      const files = await screen.findByRole('list', { name: 'Files for this comment' });
      await within(files).findByText(/^Attached/);
      await user.click(within(files).getByRole('button', { name: 'Remove image.png' }));

      await waitFor(() => expect(removed).toEqual(['att-new']));
      await waitFor(() =>
        expect(
          screen.queryByRole('list', { name: 'Files for this comment' }),
        ).not.toBeInTheDocument(),
      );
    });

    it('waits for a running upload before it lets the comment go', async () => {
      const pending = gate();
      server.use(
        http.post(orgApiPath('/tickets/:ticketId/attachments'), async () => {
          await pending.promise;
          return ok({ ...notesCsv, id: 'att-new' }, { status: 201 });
        }),
        ...ticketHandlers(),
      );
      renderDetail();

      const box = await screen.findByRole('textbox', { name: 'Comment' });
      fireEvent.paste(box, {
        clipboardData: { files: [pngFile('image.png')], types: ['Files'], getData: () => '' },
      });
      expect(
        await screen.findByRole('progressbar', { name: 'Uploading image.png' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send comment' })).toBeDisabled();

      pending.open();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Send comment' })).toBeEnabled(),
      );
    });

    it("keeps what is pasted into the comment box in the comment's own list of files", async () => {
      server.use(
        http.post(orgApiPath('/tickets/:ticketId/attachments'), () =>
          ok({ ...notesCsv, id: 'att-new' }, { status: 201 }),
        ),
        ...ticketHandlers(),
      );
      renderDetail();
      const box = await screen.findByRole('textbox', { name: 'Comment' });

      fireEvent.paste(box, {
        clipboardData: { files: [pngFile('image.png')], types: ['Files'], getData: () => '' },
      });

      // One row, in the comment's list; the drop zone's own list stays empty.
      expect(
        await screen.findByRole('list', { name: 'Files for this comment' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Uploads' })).not.toBeInTheDocument();
    });
  });

  describe('editing and deleting', () => {
    it('lets the author edit her comment with Save, and marks it edited', async () => {
      const user = userEvent.setup();
      const comments = thread();
      const bodies: unknown[] = [];
      server.use(
        http.patch(
          orgApiPath('/tickets/:ticketId/comments/:commentId'),
          async ({ request, params }) => {
            const body = (await request.json()) as { body: string };
            bodies.push([params.commentId, body]);
            Object.assign(comments[0] as TicketComment, {
              body: body.body,
              edited_at: '2026-10-18T12:00:00Z',
            });
            return ok(comments[0]);
          },
        ),
        ...ticketHandlers({ comments }),
      );
      renderDetail();
      await screen.findByText('Reproduced on the demo practice.');

      await user.click(
        within(commentOf('Ada Lovelace')).getByRole('button', { name: 'Edit comment' }),
      );
      const field = screen.getByRole('textbox', { name: 'Comment text' });
      expect(field).toHaveValue('Reproduced on the demo practice.');
      await user.type(field, ' Also on the Globex practice.');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(bodies).toEqual([
          [
            adaComment.id,
            { body: 'Reproduced on the demo practice. Also on the Globex practice.' },
          ],
        ]),
      );
      expect(await screen.findByText('Comment saved')).toBeInTheDocument();
      await waitFor(() => expect(commentOf('Ada Lovelace')).toHaveTextContent('(edited)'));
      expect(screen.queryByRole('textbox', { name: 'Comment text' })).not.toBeInTheDocument();
    });

    it('saves with Ctrl+Enter, cancels with Escape and sends nothing for unchanged text', async () => {
      const user = userEvent.setup();
      const bodies: unknown[] = [];
      server.use(
        http.patch(orgApiPath('/tickets/:ticketId/comments/:commentId'), async ({ request }) => {
          bodies.push(await request.json());
          return ok(adaComment);
        }),
        ...ticketHandlers(),
      );
      renderDetail();
      await screen.findByText('Reproduced on the demo practice.');

      const edit = () =>
        user.click(within(commentOf('Ada Lovelace')).getByRole('button', { name: 'Edit comment' }));
      await edit();
      await user.type(screen.getByRole('textbox', { name: 'Comment text' }), ' more{Escape}');
      expect(screen.queryByRole('textbox', { name: 'Comment text' })).not.toBeInTheDocument();

      await edit();
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.queryByRole('textbox', { name: 'Comment text' })).not.toBeInTheDocument();
      expect(bodies).toEqual([]);

      await edit();
      await user.type(
        screen.getByRole('textbox', { name: 'Comment text' }),
        '!{Control>}{Enter}{/Control}',
      );
      await waitFor(() => expect(bodies).toEqual([{ body: 'Reproduced on the demo practice.!' }]));
    });

    it("shows the API's refusal of an edit under the field", async () => {
      const user = userEvent.setup();
      server.use(
        http.patch(orgApiPath('/tickets/:ticketId/comments/:commentId'), () =>
          fail(403, 'PERMISSION_DENIED', 'Only the author may edit a comment.'),
        ),
        ...ticketHandlers(),
      );
      renderDetail();
      await screen.findByText('Reproduced on the demo practice.');

      await user.click(
        within(commentOf('Ada Lovelace')).getByRole('button', { name: 'Edit comment' }),
      );
      await user.type(screen.getByRole('textbox', { name: 'Comment text' }), '!');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Only the author may edit a comment.')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Comment text' })).toBeInTheDocument();
    });

    it('offers editing only to the author, and deleting to the author and to a moderator', async () => {
      server.use(...ticketHandlers());
      renderDetail(OWNER_PERMISSIONS);
      await screen.findByText('Reproduced on the demo practice.');

      expect(
        within(commentOf('Ada Lovelace')).getByRole('button', { name: 'Edit comment' }),
      ).toBeInTheDocument();
      expect(
        within(commentOf('Ada Lovelace')).getByRole('button', { name: 'Delete comment' }),
      ).toBeInTheDocument();
      // Someone else's: not editable, but a person with ticket.delete may remove it.
      expect(
        within(commentOf('Bob Brown')).queryByRole('button', { name: 'Edit comment' }),
      ).not.toBeInTheDocument();
      expect(
        within(commentOf('Bob Brown')).getByRole('button', { name: 'Delete comment' }),
      ).toBeInTheDocument();
    });

    it('gives Staff the buttons of their own comments only', async () => {
      server.use(...ticketHandlers());
      renderDetail(STAFF_PERMISSIONS);
      await screen.findByText('Reproduced on the demo practice.');

      expect(
        within(commentOf('Ada Lovelace')).getByRole('button', { name: 'Edit comment' }),
      ).toBeInTheDocument();
      expect(
        within(commentOf('Ada Lovelace')).getByRole('button', { name: 'Delete comment' }),
      ).toBeInTheDocument();
      expect(within(commentOf('Bob Brown')).queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows a role that may only read the thread without any button', async () => {
      server.use(...ticketHandlers());
      renderDetail(['ticket.read']);
      await screen.findByText('Reproduced on the demo practice.');

      expect(
        within(commentOf('Ada Lovelace')).queryByRole('button', { name: /comment$/ }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Comment' })).not.toBeInTheDocument();
    });

    it('deletes a comment after a confirmation that names its author', async () => {
      const user = userEvent.setup();
      const comments = thread();
      const deleted: unknown[] = [];
      server.use(
        http.delete(orgApiPath('/tickets/:ticketId/comments/:commentId'), ({ params }) => {
          deleted.push(params.commentId);
          comments.splice(1, 1);
          return ok(null, { message: 'Comment deleted' });
        }),
        ...ticketHandlers({ comments }),
      );
      renderDetail();
      await screen.findByText('Same difference after the second client is selected.');

      await user.click(
        within(commentOf('Bob Brown')).getByRole('button', { name: 'Delete comment' }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Delete comment?' });
      expect(dialog).toHaveTextContent(
        'The comment by Bob Brown will be deleted with its files. This cannot be undone.',
      );
      await user.click(within(dialog).getByRole('button', { name: 'Delete comment' }));

      await waitFor(() => expect(deleted).toEqual([bobComment.id]));
      expect(await screen.findByText('Comment deleted')).toBeInTheDocument();
      await waitFor(() =>
        expect(
          screen.queryByText('Same difference after the second client is selected.'),
        ).not.toBeInTheDocument(),
      );
    });

    it('keeps the dialog open with the reason when the API refuses the delete', async () => {
      const user = userEvent.setup();
      server.use(
        http.delete(orgApiPath('/tickets/:ticketId/comments/:commentId'), () =>
          fail(403, 'PERMISSION_DENIED', 'You may not delete this comment.'),
        ),
        ...ticketHandlers(),
      );
      renderDetail();
      await screen.findByText('Reproduced on the demo practice.');

      await user.click(
        within(commentOf('Ada Lovelace')).getByRole('button', { name: 'Delete comment' }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Delete comment?' });
      await user.click(within(dialog).getByRole('button', { name: 'Delete comment' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'You may not delete this comment.',
      );
    });
  });
});
