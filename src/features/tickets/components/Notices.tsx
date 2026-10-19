import { ShieldOff } from 'lucide-react';

import { Card, EmptyState, ErrorState } from '@/components/ui';
import { isApiError } from '@/services/api';

/** Shown when a page is opened without the permission its endpoint needs. */
export function NoAccess({ what }: { what: string }) {
  return (
    <Card padding="none">
      <EmptyState
        icon={<ShieldOff className="size-6" />}
        title="You don't have access to this page"
        description={`Your role in this practice does not include ${what}. Ask your practice administrator if you need it.`}
      />
    </Card>
  );
}

export interface LoadErrorProps {
  title: string;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}

/** A failed load, in a card, with a retry and the request id. */
export function LoadError({ title, error, onRetry, retrying }: LoadErrorProps) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-card">
      <ErrorState
        title={title}
        error={isApiError(error) ? error : null}
        onRetry={onRetry}
        retrying={retrying}
      />
    </div>
  );
}
