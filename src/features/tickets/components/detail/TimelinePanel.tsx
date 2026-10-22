import {
  ArrowRight,
  FilePlus2,
  FileX2,
  Flag,
  History,
  MessageSquarePlus,
  MessageSquareText,
  MessageSquareX,
  Pencil,
  Plus,
  Tag,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, ErrorState, Pagination, Skeleton } from '@/components/ui';
import { isApiError } from '@/services/api';
import { cn } from '@/utils/cn';
import { formatUkDateTime } from '@/utils/dates';

import { flattenPages, useTicketTimeline } from '../../api';
import { PRIORITY_META, STATUS_META, type ToneClasses } from '../../constants';
import type { TicketPriority, TicketStatus, TimelineEvent, TimelineKind } from '../../types';
import { relativeTime } from '../../utils/format';

export interface TimelinePanelProps {
  ticketId: string;
  timeZone: string;
}

const ICONS: Record<TimelineKind, LucideIcon> = {
  created: Plus,
  status_changed: History,
  priority_changed: Flag,
  assignee_changed: UserRound,
  tags_changed: Tag,
  subject_changed: Pencil,
  description_changed: Pencil,
  comment_added: MessageSquarePlus,
  comment_edited: MessageSquareText,
  comment_deleted: MessageSquareX,
  file_added: FilePlus2,
  file_removed: FileX2,
};

function Value({ tone, children }: { tone?: ToneClasses; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium whitespace-nowrap',
        tone ? `${tone.soft} ${tone.text}` : 'bg-surface-sunken text-text',
      )}
    >
      {children}
    </span>
  );
}

function statusValue(code: string | null) {
  const meta = code ? STATUS_META[code as TicketStatus] : undefined;
  return <Value tone={meta?.tone}>{meta?.label ?? code ?? 'None'}</Value>;
}

function priorityValue(code: string | null) {
  const meta = code ? PRIORITY_META[code as TicketPriority] : undefined;
  return <Value tone={meta?.tone}>{meta?.label ?? code ?? 'None'}</Value>;
}

function Change({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {before}
      <ArrowRight aria-hidden="true" className="size-3 text-text-muted" />
      {after}
    </span>
  );
}

function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="mt-1 line-clamp-2 border-l-2 border-row-border pl-2 text-xs text-text-muted">
      {children}
    </blockquote>
  );
}

/** The sentence of one event, without the person: "changed the status", with its values below. */
function describe(event: TimelineEvent): { text: string; extra?: ReactNode } {
  switch (event.kind) {
    case 'created':
      return {
        text: 'created the ticket',
        extra: event.after ? <Change before={null} after={statusValue(event.after)} /> : undefined,
      };
    case 'status_changed':
      return {
        text: 'changed the status',
        extra: <Change before={statusValue(event.before)} after={statusValue(event.after)} />,
      };
    case 'priority_changed':
      return {
        text: 'changed the priority',
        extra: <Change before={priorityValue(event.before)} after={priorityValue(event.after)} />,
      };
    case 'assignee_changed':
      return {
        text: event.after === 'Unassigned' ? 'removed the assignee' : 'changed the assignee',
        extra: (
          <Change
            before={<Value>{event.before ?? 'Unassigned'}</Value>}
            after={<Value>{event.after ?? 'Unassigned'}</Value>}
          />
        ),
      };
    case 'tags_changed':
      return {
        text: 'changed the tags',
        extra: (
          <span className="inline-flex flex-wrap gap-1.5">
            {event.added.map((name) => (
              <Value key={`+${name}`} tone={STATUS_META.closed.tone}>
                + {name}
              </Value>
            ))}
            {event.removed.map((name) => (
              <Value key={`-${name}`} tone={STATUS_META.blocked.tone}>
                − {name}
              </Value>
            ))}
          </span>
        ),
      };
    case 'subject_changed':
      return {
        text: 'changed the subject',
        extra: (
          <Change before={<Value>{event.before}</Value>} after={<Value>{event.after}</Value>} />
        ),
      };
    case 'description_changed':
      return { text: 'edited the description' };
    case 'comment_added':
      return {
        text: 'added a comment',
        extra: event.detail ? <Quote>{event.detail}</Quote> : undefined,
      };
    case 'comment_edited':
      return {
        text: 'edited a comment',
        extra: event.detail ? <Quote>{event.detail}</Quote> : undefined,
      };
    case 'comment_deleted':
      return { text: 'deleted a comment' };
    case 'file_added':
      return {
        text: event.comment_id ? 'attached a file to a comment' : 'attached a file',
        extra: event.detail ? <Value>{event.detail}</Value> : undefined,
      };
    case 'file_removed':
      return {
        text: 'removed a file',
        extra: event.detail ? <Value>{event.detail}</Value> : undefined,
      };
  }
}

function TimelineItem({ event, timeZone }: { event: TimelineEvent; timeZone: string }) {
  const Icon = ICONS[event.kind];
  const { text, extra } = describe(event);
  return (
    <li className="group/item relative flex gap-3 pb-5 last:pb-0">
      <span
        aria-hidden="true"
        className="absolute top-7 bottom-0 left-3.5 w-px -translate-x-1/2 bg-row-border group-last/item:hidden"
      />
      <span
        aria-hidden="true"
        className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-row-border bg-surface text-text-muted"
      >
        <Icon className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        <p className="text-xs text-text">
          <span className="font-semibold">{event.actor?.full_name ?? 'The system'}</span> {text}
          {event.bulk ? <span className="text-text-muted"> (bulk action)</span> : null}
          <span aria-hidden="true" className="text-text-muted">
            {' · '}
          </span>
          <time
            dateTime={event.at}
            title={formatUkDateTime(event.at, timeZone)}
            className="text-2xs text-text-muted"
          >
            {relativeTime(event.at)}
          </time>
        </p>
        {extra ? <div className="min-w-0 text-xs">{extra}</div> : null}
      </div>
    </li>
  );
}

/**
 * "Timeline": everything that happened to the ticket, newest first: its creation, changes of
 * status, priority, assignee, tags, subject and description, comments and files. Anyone who can
 * read the ticket can read this (it needs `ticket.read`, not the audit log's permission).
 */
export function TimelinePanel({ ticketId, timeZone }: TimelinePanelProps) {
  const timeline = useTicketTimeline(ticketId);
  const items = flattenPages(timeline.data);

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-row-border bg-surface-sunken px-5 py-3">
        <History aria-hidden="true" className="size-4 text-text-muted" />
        <h2 className="text-sm font-bold text-text">Timeline</h2>
      </header>
      <div className="p-5">
        {timeline.isPending ? (
          <div role="status" aria-label="Loading the timeline" className="flex flex-col gap-3">
            <Skeleton lines={2} />
            <Skeleton lines={2} />
          </div>
        ) : timeline.isError ? (
          <ErrorState
            title="Could not load the timeline"
            error={isApiError(timeline.error) ? timeline.error : null}
            onRetry={() => void timeline.refetch()}
            retrying={timeline.isRefetching}
            className="py-6"
          />
        ) : items.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing has happened to this ticket yet.</p>
        ) : (
          <ol aria-label="Ticket timeline" className="flex flex-col">
            {items.map((event) => (
              <TimelineItem key={event.id} event={event} timeZone={timeZone} />
            ))}
          </ol>
        )}
        {timeline.hasNextPage ? (
          <div className="pt-4">
            <Pagination
              hasMore
              onLoadMore={() => void timeline.fetchNextPage()}
              loading={timeline.isFetchingNextPage}
              count={items.length}
              itemLabel={['event', 'events']}
              loadMoreLabel="Load more events"
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
