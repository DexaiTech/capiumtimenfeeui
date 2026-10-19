import { RotateCw, TriangleAlert } from 'lucide-react';

import { cn } from '@/utils/cn';

import { Button } from './Button';

/** Structural, so the primitive needs no knowledge of the API client's error class. */
export interface DisplayableError {
  message: string;
  requestId?: string;
  /** The API's error code; a page the role does not include is shown calmly, not as a failure. */
  code?: string;
}

export interface ErrorStateProps {
  error: DisplayableError | null | undefined;
  onRetry?: () => void;
  title?: string;
  retryLabel?: string;
  /** True while the retry is running. */
  retrying?: boolean;
  className?: string;
}

/** Shows the message, a Retry action and the request id the user can quote to support. */
export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
  retryLabel = 'Try again',
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-xl bg-danger-soft text-danger"
      >
        <TriangleAlert className="size-6" />
      </span>
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <p className="max-w-md text-sm text-text-muted">
        {error?.message || 'An unexpected error occurred. Please try again.'}
      </p>
      {error?.requestId ? (
        <p className="text-xs text-text-subtle">
          Request ID: <code className="font-mono break-all">{error.requestId}</code>
        </p>
      ) : null}
      {onRetry ? (
        <Button
          className="mt-2"
          onClick={onRetry}
          loading={retrying}
          leftIcon={<RotateCw className="size-4" aria-hidden="true" />}
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
