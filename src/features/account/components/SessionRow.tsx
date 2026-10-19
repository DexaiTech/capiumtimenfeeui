import { Monitor, Smartphone } from 'lucide-react';

import { Badge, Button } from '@/components/ui';
import type { Session } from '@/types/models';
import { formatDate, formatRelativeTime } from '@/utils/format';
import { parseUserAgent } from '@/utils/userAgent';

export interface SessionRowProps {
  session: Session;
  revoking: boolean;
  onRevoke: (session: Session) => void;
}

export function SessionRow({ session, revoking, onRevoke }: SessionRowProps) {
  const { browser, os, isMobile } = parseUserAgent(session.user_agent);
  const DeviceIcon = isMobile ? Smartphone : Monitor;
  const lastUsed = session.last_used_at ? formatRelativeTime(session.last_used_at) : '';
  const name = `${browser} on ${os}`;

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-hover text-text-muted"
        >
          <DeviceIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-text">{name}</span>
            {session.is_current ? <Badge tone="success">Current</Badge> : null}
          </div>
          <p className="text-xs text-text-muted">
            {session.ip_address ?? 'Unknown address'}
            {lastUsed ? ` · Active ${lastUsed}` : ''}
            {` · Signed in ${formatDate(session.created_at)}`}
          </p>
        </div>
      </div>
      {session.is_current ? null : (
        <Button
          size="sm"
          loading={revoking}
          aria-label={`Revoke session: ${name}`}
          onClick={() => onRevoke(session)}
          className="w-full sm:w-auto"
        >
          Revoke
        </Button>
      )}
    </li>
  );
}
