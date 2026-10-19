import { isApiError } from '@/services/api';
import type { FieldErrorDetail } from '@/types/api';

/** The `{field, code, message}` entries of a 422 error's `details`. */
export function fieldDetails(error: unknown): FieldErrorDetail[] {
  if (!isApiError(error) || !Array.isArray(error.details)) return [];
  return error.details.filter(
    (entry): entry is FieldErrorDetail =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as FieldErrorDetail).field === 'string' &&
      typeof (entry as FieldErrorDetail).message === 'string',
  );
}

export interface FailureNotice {
  title: string;
  description: string;
}

/** The text of a refusal, for the error line of a confirmation dialog. */
export function dialogError(error: unknown): { message: string; requestId?: string } {
  if (isApiError(error)) {
    return { message: error.message, requestId: error.retryable ? error.requestId : undefined };
  }
  return { message: 'An unexpected error occurred. Please try again.' };
}

/** The uniform wording of a failed save, for a toast. */
export function describeFailure(error: unknown, title: string): FailureNotice {
  if (!isApiError(error)) {
    return { title, description: 'An unexpected error occurred. Please try again.' };
  }
  if (error.status === 403) {
    return { title: "You don't have permission to do that", description: error.message };
  }
  const requestId = error.retryable && error.requestId ? ` (Request ID: ${error.requestId})` : '';
  return { title, description: `${error.message}${requestId}` };
}
