import { ArrowLeft, FileX2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { buttonClasses, Card, EmptyState, Skeleton } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { useTicket } from '../api';
import { CommentsPanel } from '../components/detail/CommentsPanel';
import { TicketCard } from '../components/detail/TicketCard';
import { TimelinePanel } from '../components/detail/TimelinePanel';
import { UploadPanel } from '../components/detail/UploadPanel';
import { LiveRegion } from '../components/LiveRegion';
import { LoadError, NoAccess } from '../components/Notices';
import { useTicketFieldChange } from '../hooks/useTicketFieldChange';
import { isNotFound } from '../utils/errors';

function BackLink() {
  const { organization } = useOrg();
  return (
    <Link
      to={routes.org.tickets(organization.slug)}
      className="inline-flex items-center gap-1.5 self-start rounded-sm text-sm font-medium text-brand-text underline underline-offset-2 hover:text-brand-hover"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to Application Testing
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <Card
      padding="md"
      role="status"
      aria-label="Loading the ticket"
      className="flex flex-col gap-5"
    >
      <Skeleton shape="rect" className="h-10 w-1/3" />
      <Skeleton lines={2} />
      <Skeleton shape="rect" className="h-16 w-full" />
      <Skeleton shape="rect" className="h-32 w-full" />
    </Card>
  );
}

function TicketDetail({ ticketId }: { ticketId: string }) {
  const { organization, can } = useOrg();
  const ticket = useTicket(ticketId);
  const { change, announcement } = useTicketFieldChange();
  const [note, setNote] = useState('');
  const canUpdate = can(PERMISSIONS.ticketUpdate);
  const canDelete = can(PERMISSIONS.ticketDelete);
  useDocumentTitle(ticket.data ? `${ticket.data.code} ${ticket.data.subject}` : 'Ticket');

  if (ticket.isPending) return <DetailSkeleton />;
  if (ticket.isError) {
    return isNotFound(ticket.error) ? (
      <Card padding="none">
        <EmptyState
          icon={<FileX2 className="size-6" />}
          title="Ticket not found"
          description="It may have been deleted, or the link is not right."
          action={
            <Link
              to={routes.org.tickets(organization.slug)}
              className={buttonClasses({ variant: 'primary' })}
            >
              Back to Application Testing
            </Link>
          }
        />
      </Card>
    ) : (
      <LoadError
        title="Could not load the ticket"
        error={ticket.error}
        onRetry={() => void ticket.refetch()}
        retrying={ticket.isRefetching}
      />
    );
  }

  const data = ticket.data;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <BackLink />
      <LiveRegion message={announcement} />
      <LiveRegion message={note} />
      <TicketCard
        ticket={data}
        timeZone={organization.timezone}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onStatusChange={(status) => change(data, { status })}
        onPriorityChange={(priority) => change(data, { priority })}
        onTagResult={setNote}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <CommentsPanel
          ticketId={ticketId}
          commentCount={data.comment_count}
          timeZone={organization.timezone}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
        <UploadPanel ticketId={ticketId} canUpdate={canUpdate} />
      </div>
      <TimelinePanel ticketId={ticketId} timeZone={organization.timezone} />
    </div>
  );
}

/** `/:orgSlug/application-testing/tickets/:ticketId`: one ticket, with its comments, files and timeline (`ticket.read`). */
export default function TicketDetailPage() {
  const { ticketId } = useParams();
  const { can } = useOrg();
  if (!can(PERMISSIONS.ticketRead)) return <NoAccess what="Application Testing" />;
  return ticketId ? <TicketDetail ticketId={ticketId} /> : null;
}
