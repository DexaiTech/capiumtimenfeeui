import { Pencil, Trash2 } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { Button, ConfirmDialog, InitialsAvatar, Textarea, useToast } from '@/components/ui';
import { formatUkDateTime } from '@/utils/dates';
import { isApiError } from '@/services/api';

import { useDeleteComment, useUpdateComment } from '../../api';
import { COMMENT_MAX_LENGTH } from '../../constants';
import type { TicketComment } from '../../types';
import { dialogError, fieldDetails } from '../../utils/errors';
import { relativeTime } from '../../utils/format';
import { AttachmentCard } from './AttachmentCard';

export interface CommentItemProps {
  ticketId: string;
  comment: TicketComment;
  /** The signed-in person's id: their own comments can be edited. */
  userId: string | undefined;
  timeZone: string;
  canUpdate: boolean;
  canDelete: boolean;
}

/**
 * One comment: the author's avatar, name and relative time, the text (with an "edited" marker),
 * its files, and for the author Edit and Delete (`ticket.update`); a person with `ticket.delete`
 * may delete anyone's comment.
 */
export function CommentItem({
  ticketId,
  comment,
  userId,
  timeZone,
  canUpdate,
  canDelete,
}: CommentItemProps) {
  const { toast } = useToast();
  const update = useUpdateComment(ticketId);
  const remove = useDeleteComment(ticketId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);

  const isAuthor = comment.author.id === userId;
  const mayEdit = isAuthor && canUpdate;
  const mayDelete = canDelete || mayEdit;

  const cancel = () => {
    setEditing(false);
    setError(undefined);
  };

  const save = () => {
    const text = draft.trim();
    if (text === comment.body) {
      cancel();
      return;
    }
    setError(undefined);
    update.mutate(
      { commentId: comment.id, body: text },
      {
        onSuccess: () => {
          setEditing(false);
          toast({ tone: 'success', title: 'Comment saved' });
        },
        onError: (failure) => {
          const named = fieldDetails(failure).find((detail) => detail.field === 'body');
          setError(
            named?.message ??
              (isApiError(failure) ? failure.message : 'Could not save the comment. Try again.'),
          );
        },
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      save();
    }
  };

  const confirmDelete = () => {
    remove.mutate(comment.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: 'Comment deleted' });
        setConfirming(false);
      },
      onError: (failure) => setRefusal(dialogError(failure)),
    });
  };

  return (
    <li className="flex gap-3">
      <InitialsAvatar name={comment.author.full_name} colorKey={comment.author.id} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold text-text">{comment.author.full_name}</span>
          <time
            dateTime={comment.created_at}
            title={formatUkDateTime(comment.created_at, timeZone)}
            className="text-2xs text-text-muted"
          >
            {relativeTime(comment.created_at)}
          </time>
          {comment.edited_at ? (
            <span
              title={`Edited ${formatUkDateTime(comment.edited_at, timeZone)}`}
              className="text-2xs text-text-subtle"
            >
              (edited)
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-0.5">
            {mayEdit && !editing ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit comment"
                onClick={() => {
                  setDraft(comment.body);
                  setError(undefined);
                  setEditing(true);
                }}
              >
                <Pencil aria-hidden="true" className="size-3.5" />
              </Button>
            ) : null}
            {mayDelete ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete comment"
                onClick={() => {
                  setRefusal(null);
                  setConfirming(true);
                }}
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </Button>
            ) : null}
          </span>
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              label="Comment text"
              hideLabel
              autoFocus
              rows={3}
              maxLength={COMMENT_MAX_LENGTH}
              value={draft}
              error={error}
              hint="Ctrl+Enter saves, Escape cancels."
              onChange={(event) => {
                setDraft(event.target.value);
                setError(undefined);
              }}
              onKeyDown={onKeyDown}
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" loading={update.isPending} onClick={save}>
                Save
              </Button>
              <Button size="sm" disabled={update.isPending} onClick={cancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : comment.body ? (
          <p className="text-sm break-words whitespace-pre-wrap text-text">{comment.body}</p>
        ) : null}
        {comment.attachments.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {comment.attachments.map((attachment) => (
              <li key={attachment.id} className="min-w-0">
                <AttachmentCard
                  ticketId={ticketId}
                  attachment={attachment}
                  size="sm"
                  canDelete={canDelete || (canUpdate && attachment.uploaded_by === userId)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={confirmDelete}
        title="Delete comment?"
        confirmLabel="Delete comment"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          The comment by{' '}
          <strong className="font-medium text-text">{comment.author.full_name}</strong> will be
          deleted with its files. This cannot be undone.
        </p>
      </ConfirmDialog>
    </li>
  );
}
