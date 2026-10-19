import { MonitorSmartphone } from 'lucide-react';

import { EmptyState, ErrorState, Skeleton, useToast } from '@/components/ui';
import { isApiError } from '@/services/api';
import type { Session } from '@/types/models';

import { useRevokeSession, useSessions } from '../api/hooks';
import { SessionRow } from './SessionRow';

function SessionsSkeleton() {
  return (
    <ul aria-hidden="true" className="divide-y divide-border">
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex items-center gap-3 py-4">
          <Skeleton shape="rect" className="size-10" />
          <Skeleton lines={2} className="w-56 max-w-full" />
        </li>
      ))}
    </ul>
  );
}

/** Active sessions with the four states: loading, empty, error with retry, and the list. */
export function SessionsList() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const { toast } = useToast();

  const onRevoke = (session: Session) => {
    revoke.mutate(session.id, {
      onSuccess: () => toast({ tone: 'success', title: 'Session revoked' }),
      onError: (error) =>
        toast({
          tone: 'error',
          title:
            isApiError(error) && error.status === 404
              ? 'That session had already ended'
              : 'Could not revoke the session',
          description: isApiError(error) && error.status !== 404 ? error.message : undefined,
        }),
    });
  };

  if (sessions.isPending) {
    return (
      <div role="status" aria-label="Loading sessions">
        <SessionsSkeleton />
      </div>
    );
  }
  if (sessions.isError) {
    return (
      <ErrorState
        title="Could not load your sessions"
        error={isApiError(sessions.error) ? sessions.error : null}
        onRetry={() => void sessions.refetch()}
        retrying={sessions.isRefetching}
      />
    );
  }
  if (sessions.data.length === 0) {
    return (
      <EmptyState
        icon={<MonitorSmartphone className="size-6" />}
        title="No active sessions"
        description="Sessions appear here when you sign in on a device."
      />
    );
  }

  // The current session first, then the most recently used.
  const ordered = [...sessions.data].sort(
    (a, b) =>
      Number(b.is_current) - Number(a.is_current) ||
      (b.last_used_at ?? b.created_at).localeCompare(a.last_used_at ?? a.created_at),
  );

  return (
    <ul className="divide-y divide-border">
      {ordered.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          revoking={revoke.isPending && revoke.variables === session.id}
          onRevoke={onRevoke}
        />
      ))}
    </ul>
  );
}
