import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FormAlertProps {
  message: string;
  requestId?: string;
  /** For example a Resend or Retry button. */
  action?: ReactNode;
}

/** Form-level error: anything the server reported that does not belong to one field. */
export function FormAlert({ message, requestId, action }: FormAlertProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-danger/40 bg-danger-soft px-3 py-2.5 text-sm text-text"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        <p>{message}</p>
        {requestId ? (
          <p className="text-xs text-text-muted">
            Request ID: <code className="font-mono break-all">{requestId}</code>
          </p>
        ) : null}
        {action}
      </div>
    </div>
  );
}
