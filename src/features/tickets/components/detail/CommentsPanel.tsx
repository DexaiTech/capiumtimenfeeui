import { MessageSquareText } from 'lucide-react';

import { Card, ErrorState, Pagination, Skeleton } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { isApiError } from '@/services/api';

import { flattenPages, useTicketComments } from '../../api';
import { CommentComposer } from './CommentComposer';
import { CommentItem } from './CommentItem';

export interface CommentsPanelProps {
  ticketId: string;
  /** The ticket's own count (the header's number). */
  commentCount: number;
  timeZone: string;
  canUpdate: boolean;
  canDelete: boolean;
}

/**
 * "Comments (N)": a header strip, the thread (or "No comments yet."), and the box to add one.
 * A role that may not update tickets reads the thread but has no box.
 */
export function CommentsPanel({
  ticketId,
  commentCount,
  timeZone,
  canUpdate,
  canDelete,
}: CommentsPanelProps) {
  const { user } = useAuth();
  const comments = useTicketComments(ticketId);
  const items = flattenPages(comments.data);

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-row-border bg-surface-sunken px-5 py-3">
        <MessageSquareText aria-hidden="true" className="size-4 text-text-muted" />
        <h2 className="text-sm font-bold text-text">Comments ({commentCount})</h2>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-5">
        {comments.isPending ? (
          <div role="status" aria-label="Loading comments" className="flex flex-col gap-3">
            <Skeleton lines={2} />
            <Skeleton lines={3} />
          </div>
        ) : comments.isError ? (
          <ErrorState
            title="Could not load the comments"
            error={isApiError(comments.error) ? comments.error : null}
            onRetry={() => void comments.refetch()}
            retrying={comments.isRefetching}
            className="py-6"
          />
        ) : items.length === 0 ? (
          <p className="text-sm text-text-muted">No comments yet.</p>
        ) : (
          <ul aria-label="Comments" className="flex flex-col gap-5">
            {items.map((comment) => (
              <CommentItem
                key={comment.id}
                ticketId={ticketId}
                comment={comment}
                userId={user?.id}
                timeZone={timeZone}
                canUpdate={canUpdate}
                canDelete={canDelete}
              />
            ))}
          </ul>
        )}
        {comments.hasNextPage ? (
          <Pagination
            hasMore
            onLoadMore={() => void comments.fetchNextPage()}
            loading={comments.isFetchingNextPage}
            count={items.length}
            itemLabel={['comment', 'comments']}
            loadMoreLabel="Load more comments"
          />
        ) : null}
      </div>
      {canUpdate ? (
        <div className="border-t border-row-border p-5">
          <CommentComposer ticketId={ticketId} />
        </div>
      ) : null}
    </Card>
  );
}
