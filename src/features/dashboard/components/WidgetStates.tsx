import { ShieldOff, TriangleAlert } from 'lucide-react';

import { Button, Skeleton } from '@/components/ui';
import { isApiError } from '@/services/api';

/** The widget's loading state: a few lines, announced as one status. */
export function WidgetSkeleton({ title }: { title: string }) {
  return (
    <div role="status" aria-label={`Loading ${title}`} className="flex flex-col gap-3 py-1">
      <Skeleton shape="rect" className="h-5 w-full" />
      <Skeleton shape="rect" className="h-5 w-4/5" />
      <Skeleton shape="rect" className="h-5 w-3/5" />
    </div>
  );
}

export interface WidgetErrorProps {
  title: string;
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
  /** An inline notice above figures that are still shown, instead of a whole error state. */
  inline?: boolean;
}

/** A failed load of this widget alone: the message, the request id and a retry. */
export function WidgetError({ title, error, onRetry, retrying, inline = false }: WidgetErrorProps) {
  const message =
    isApiError(error) && error.message
      ? error.message
      : 'An unexpected error occurred. Please try again.';
  const requestId = isApiError(error) ? error.requestId : undefined;
  return (
    <div
      role="alert"
      className={
        inline
          ? 'flex flex-wrap items-center gap-2 rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-text'
          : 'flex flex-col items-center justify-center gap-2 px-4 py-8 text-center'
      }
    >
      <TriangleAlert className="size-5 shrink-0 text-danger" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-text">
          {inline ? `Could not refresh ${title}` : `Could not load ${title}`}
        </p>
        <p className="text-sm text-text-muted">{message}</p>
        {requestId ? (
          <p className="text-xs text-text-subtle">
            Request ID: <code className="font-mono break-all">{requestId}</code>
          </p>
        ) : null}
      </div>
      <Button size="sm" loading={retrying} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** Shown in place of a widget the caller's role does not include. */
export function WidgetNoAccess({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <ShieldOff className="size-5 text-text-subtle" aria-hidden="true" />
      <p className="text-sm font-medium text-text">You don&apos;t have access to this</p>
      <p className="max-w-sm text-sm text-text-muted">
        Your role in this practice does not include {title}. Ask your practice administrator if you
        need it.
      </p>
    </div>
  );
}

export interface WidgetEmptyProps {
  title: string;
  description?: string;
}

/** What a widget with nothing to show says. */
export function WidgetEmpty({ title, description }: WidgetEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
      <p className="text-sm font-medium text-text">{title}</p>
      {description ? <p className="max-w-sm text-sm text-text-muted">{description}</p> : null}
    </div>
  );
}
