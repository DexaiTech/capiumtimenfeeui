import { ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/layout';
import { Card, EmptyState, ErrorState } from '@/components/ui';
import { isApiError } from '@/services/api';

export interface PageShellProps {
  title: string;
  description?: ReactNode;
  /** The page's actions; at most one of them is primary. */
  actions?: ReactNode;
  children: ReactNode;
}

/** Title, description and actions of a Team & Rates page. The shell provides the chrome. */
export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader title={title} description={description} actions={actions} className="mb-1" />
      {children}
    </section>
  );
}

/** Shown when the page is opened without the permission its endpoint requires. */
export function NoAccess({ what }: { what: string }) {
  return (
    <Card padding="none">
      <EmptyState
        icon={<ShieldOff className="size-6" />}
        title="You don't have access to this page"
        description={`Your role in this practice does not include viewing ${what}. Ask your practice administrator if you need it.`}
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

/** A failed list, in a card, with a retry. */
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
