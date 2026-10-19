import type { DisplayableError } from '@/components/ui';
import { isApiError } from '@/services/api';
import { formatWait } from '@/utils/format';

/** A failed load for the widgets and charts: the message and the request id to quote. */
export function toDisplayable(error: unknown): DisplayableError | null {
  if (!error) return null;
  if (isApiError(error)) return error;
  return { message: 'An unexpected error occurred. Please try again.' };
}

export interface FailureNotice {
  title: string;
  description: string;
}

/** The wording of a failed action, for a toast (the status decides the title). */
export function describeFailure(error: unknown, fallbackTitle: string): FailureNotice {
  if (!isApiError(error)) {
    return { title: fallbackTitle, description: 'An unexpected error occurred. Please try again.' };
  }
  if (error.status === 403) {
    return { title: "You don't have permission to do that", description: error.message };
  }
  if (error.status === 429) {
    return {
      title: 'Too many requests',
      description: `Try again in ${formatWait(error.retryAfter ?? 60)}.`,
    };
  }
  if (error.status === 0) {
    return { title: 'Could not reach the server', description: error.message };
  }
  return {
    title: fallbackTitle,
    description: error.requestId
      ? `${error.message} (Request ID: ${error.requestId})`
      : error.message,
  };
}
