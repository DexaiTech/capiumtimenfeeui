import { isApiError } from '@/services/api';
import type { FieldErrorDetail } from '@/types/api';
import { formatWait } from '@/utils/format';

export interface ErrorNotice {
  title: string;
  description?: string;
}

/** The `{field, message}` entries of an error's `details` (a 422, or a duplicate). */
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

/** True when the API answered 404: the ticket (or tag, or file) is gone or never was. */
export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/** The text of a refusal, for the error line of a confirmation dialog. */
export function dialogError(error: unknown): { message: string; requestId?: string } {
  if (isApiError(error)) {
    return { message: error.message, requestId: error.retryable ? error.requestId : undefined };
  }
  return { message: 'An unexpected error occurred. Please try again.' };
}

/** The uniform wording of a failed action, for a toast. */
export function describeFailure(error: unknown, fallbackTitle: string): ErrorNotice {
  if (!isApiError(error)) {
    return { title: fallbackTitle, description: 'An unexpected error occurred. Please try again.' };
  }
  switch (error.status) {
    case 0:
      return { title: 'Could not reach the server', description: error.message };
    case 403:
      return { title: "You don't have permission to do that", description: error.message };
    case 404:
      // The record is gone; a file that is gone from the store has its own message.
      return error.code === 'ATTACHMENT_FILE_MISSING'
        ? { title: fallbackTitle, description: error.message }
        : {
            title: 'That ticket no longer exists',
            description: 'It may have been deleted by someone else. The list has been refreshed.',
          };
    case 429:
      return {
        title: 'Too many requests',
        description: `Try again in ${formatWait(error.retryAfter ?? 60)}.`,
      };
    default:
      return {
        title: fallbackTitle,
        description:
          error.requestId && error.retryable
            ? `${error.message} (Request ID: ${error.requestId})`
            : error.message,
      };
  }
}

/** Why one upload failed: the API's own message (413 and 422 name the limit or the type). */
export function uploadFailure(error: unknown): string {
  if (isApiError(error)) return error.message;
  return 'The upload failed. Please try again.';
}
