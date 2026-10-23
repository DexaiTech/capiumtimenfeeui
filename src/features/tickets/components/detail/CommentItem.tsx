import { InitialsAvatar, RichText } from '@/components/ui';
import { formatUkDateTime } from '@/utils/dates';

import type { TicketComment } from '../../types';
import { relativeTime } from '../../utils/format';
import { AttachmentCard } from './AttachmentCard';

export interface CommentItemProps {
  ticketId: string;
  comment: TicketComment;
  /** The signed-in person's id: they may remove their own files. */
  userId: string | undefined;
  timeZone: string;
  canUpdate: boolean;
  canDelete: boolean;
}

/**
 * One comment: the author's avatar, name and relative time, the text and its files. A comment
 * is a record: once posted it can be neither edited nor deleted. (A file on it can still be
 * removed by whoever may, as on the ticket itself.)
 */
export function CommentItem({
  ticketId,
  comment,
  userId,
  timeZone,
  canUpdate,
  canDelete,
}: CommentItemProps) {
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
        </div>
        {comment.body ? (
          <RichText html={comment.body_html} text={comment.body} className="text-sm text-text" />
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
    </li>
  );
}
