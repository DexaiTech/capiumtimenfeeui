import {
  AlignLeft,
  CalendarDays,
  Clock,
  FileText,
  Flag,
  Paperclip,
  Plus,
  Tag,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge, Card } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { formatDayMonthYear } from '@/utils/dates';

import { CATEGORY_LABELS } from '../../constants';
import type { TicketDetail, TicketPriority, TicketStatus } from '../../types';
import { PrioritySelect, StatusSelect } from '../SelectPill';
import { TagChip } from '../TagChip';
import { TagPopover } from '../TagPopover';
import { AttachmentCard } from './AttachmentCard';
import { ReadOnlyText } from './ReadOnlyText';

function FieldColumn({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5 px-5 py-4">
      <dt className="flex items-center gap-2 text-xs font-medium text-text-muted">
        <Icon aria-hidden="true" className="size-4" />
        {label}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-medium text-text">
        {children}
      </dd>
    </div>
  );
}

export interface TicketCardProps {
  ticket: TicketDetail;
  timeZone: string;
  canUpdate: boolean;
  canDelete: boolean;
  onStatusChange: (status: TicketStatus) => void;
  onPriorityChange: (priority: TicketPriority) => void;
  onTagResult: (message: string) => void;
}

/**
 * The large card of a ticket: its code and category, then status, priority, creation date and
 * tags in four columns, then the subject and description (edited in place) and the files that
 * belong to the ticket itself.
 */
export function TicketCard({
  ticket,
  timeZone,
  canUpdate,
  canDelete,
  onStatusChange,
  onPriorityChange,
  onTagResult,
}: TicketCardProps) {
  const { user } = useAuth();
  const files = ticket.attachments.filter((attachment) => attachment.comment_id === null);

  return (
    <Card padding="none" className="overflow-hidden">
      <header className="flex items-center gap-3 border-b border-row-border px-5 py-4">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-text"
        >
          <FileText className="size-5" />
        </span>
        <h1 className="text-lg font-bold text-text">{ticket.code}</h1>
        <Badge tone="violet">{CATEGORY_LABELS[ticket.category]}</Badge>
      </header>

      <dl className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <FieldColumn icon={Clock} label="Status">
          <StatusSelect ticket={ticket} editable={canUpdate} onChange={onStatusChange} size="md" />
        </FieldColumn>
        <FieldColumn icon={Flag} label="Priority">
          <PrioritySelect
            ticket={ticket}
            editable={canUpdate}
            onChange={onPriorityChange}
            size="md"
          />
        </FieldColumn>
        <FieldColumn icon={CalendarDays} label="Created on">
          {formatDayMonthYear(ticket.created_at, timeZone)}
        </FieldColumn>
        <FieldColumn icon={Tag} label="Tags">
          {ticket.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
          {canUpdate ? (
            <TagPopover
              ticket={ticket}
              label={`Edit tags of ${ticket.code}`}
              triggerClassName="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-border-strong text-text-subtle hover:border-brand hover:text-brand-text"
              trigger={<Plus aria-hidden="true" className="size-3.5" />}
              onResult={onTagResult}
            />
          ) : ticket.tags.length === 0 ? (
            <span className="text-text-subtle">No tags</span>
          ) : null}
        </FieldColumn>
      </dl>

      <div className="flex flex-col gap-6 border-t border-row-border p-5">
        <ReadOnlyText label="Subject" icon={Type} value={ticket.subject} emptyText="No subject" />
        <ReadOnlyText
          label="Description"
          icon={AlignLeft}
          value={ticket.description}
          valueHtml={ticket.description_html}
          emptyText="No description"
        />
        <section aria-labelledby="ticket-files-title" className="flex flex-col gap-3">
          <h2
            id="ticket-files-title"
            className="flex items-center gap-2 text-sm font-bold text-text"
          >
            <Paperclip aria-hidden="true" className="size-4 text-text-muted" />
            Attachments
          </h2>
          {files.length === 0 ? (
            <p className="text-sm text-text-muted">No attachments yet.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {files.map((attachment) => (
                <li key={attachment.id} className="min-w-0">
                  <AttachmentCard
                    ticketId={ticket.id}
                    attachment={attachment}
                    canDelete={canDelete || (canUpdate && attachment.uploaded_by === user?.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
