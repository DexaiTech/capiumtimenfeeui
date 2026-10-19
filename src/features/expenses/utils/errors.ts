import { ApiError, isApiError } from '@/services/api';
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

/**
 * Prepares an error for `useSubmitError`, which puts the field errors of a 422 on the form's
 * fields. A duplicate type name or code (409 with `details[{field, message}]`) is the same thing
 * to a form, so it is turned into one; field names are renamed to the form's.
 */
export function toFormError(error: unknown, rename: Record<string, string> = {}): unknown {
  if (!isApiError(error) || (error.status !== 422 && error.status !== 409)) return error;
  const details = fieldDetails(error);
  if (details.length === 0) return error;
  return new ApiError({
    status: 422,
    code: error.code,
    message: error.message,
    requestId: error.requestId,
    retryAfter: error.retryAfter,
    details: details.map((detail) => ({ ...detail, field: rename[detail.field] ?? detail.field })),
  });
}

/** True when the API answered 404: the claim (or line, or file) is gone or never was. */
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
      return error.code === 'RECEIPT_FILE_MISSING'
        ? { title: fallbackTitle, description: error.message }
        : {
            title: 'That record no longer exists',
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

/** Why one upload failed: the API's own message (413, 422, 409 and 503 name the limit or type). */
export function uploadFailure(error: unknown): string {
  if (isApiError(error)) return error.message;
  return 'The upload failed. Please try again.';
}

export interface ReceiptProblem {
  lineId: string;
  message: string;
}

/** The lines a submission was refused for (`details[].line_id` of 422 `RECEIPT_REQUIRED`). */
export function receiptProblems(error: unknown): ReceiptProblem[] {
  if (!isApiError(error) || error.code !== 'RECEIPT_REQUIRED' || !Array.isArray(error.details)) {
    return [];
  }
  const problems: ReceiptProblem[] = [];
  for (const entry of error.details as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { line_id: lineId, message } = entry as { line_id?: unknown; message?: unknown };
    if (typeof lineId === 'string') {
      problems.push({ lineId, message: typeof message === 'string' ? message : '' });
    }
  }
  return problems;
}
