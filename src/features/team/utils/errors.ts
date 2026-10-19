import { ApiError, isApiError } from '@/services/api';
import type { FieldErrorDetail } from '@/types/api';
import { formatWait } from '@/utils/format';

import type { RateConflict, StaffUsage } from '../types';

export interface ErrorNotice {
  title: string;
  description?: string;
}

/** The `{field, message}` entries of an error's `details` (validation errors and duplicates). */
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

/** The form field a duplicate-record code is about, for when the API sends no field list. */
const DUPLICATE_FIELD: Record<string, string> = {
  STAFF_CODE_TAKEN: 'code',
  STAFF_EMAIL_TAKEN: 'email',
  INITIALS_TAKEN: 'initials',
  GRADE_CODE_TAKEN: 'code',
  GRADE_NAME_TAKEN: 'name',
  SERVICE_CODE_TAKEN: 'code',
  SERVICE_NAME_TAKEN: 'name',
  ACTIVITY_CODE_TAKEN: 'code',
  ACTIVITY_NAME_TAKEN: 'name',
};

/**
 * Prepares an error for `useSubmitError`, which puts the field errors of a 422 on the form's
 * fields. A duplicate (409 with `details[{field, message}]`, or a code such as
 * `GRADE_CODE_TAKEN`) is the same thing to a form, so it is turned into one; field names are
 * renamed to the form's (minutes → hours).
 */
export function toFormError(error: unknown, rename: Record<string, string> = {}): unknown {
  if (!isApiError(error) || (error.status !== 422 && error.status !== 409)) return error;
  let details = fieldDetails(error);
  const duplicateField = DUPLICATE_FIELD[error.code];
  if (details.length === 0 && duplicateField) {
    details = [{ field: duplicateField, code: 'duplicate', message: error.message }];
  }
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

/** `details` of an error when it is an object (as for `STAFF_IN_USE` and `RATE_OVERLAP`). */
function detailsObject(error: unknown): Record<string, unknown> | null {
  if (!isApiError(error)) return null;
  const { details } = error;
  return typeof details === 'object' && details !== null && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : null;
}

/** The records a staff member is used by (`details.usage` of 409 `STAFF_IN_USE`). */
export function usageOf(error: unknown): StaffUsage[] {
  const usage = detailsObject(error)?.usage;
  if (!Array.isArray(usage)) return [];
  return usage.filter(
    (entry): entry is StaffUsage =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as StaffUsage).label === 'string' &&
      typeof (entry as StaffUsage).count === 'number',
  );
}

/** The rules in the way of a new period (`details.conflicts` of 409 `RATE_OVERLAP`). */
export function conflictsOf(error: unknown): RateConflict[] {
  const conflicts = detailsObject(error)?.conflicts;
  if (!Array.isArray(conflicts)) return [];
  return conflicts.filter(
    (entry): entry is RateConflict =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as RateConflict).effective_from === 'string',
  );
}

/** The text of a refusal, for the error line of a confirmation dialog. */
export function dialogError(error: unknown): { message: string; requestId?: string } {
  if (isApiError(error)) {
    return {
      message: error.message,
      requestId: error.retryable ? error.requestId : undefined,
    };
  }
  return { message: 'An unexpected error occurred. Please try again.' };
}

/** The uniform wording of a failed action, for a toast. */
export function describeFailure(error: unknown, fallbackTitle: string): ErrorNotice {
  if (!isApiError(error)) {
    return { title: fallbackTitle, description: 'An unexpected error occurred. Please try again.' };
  }
  if (error.status === 403) {
    return { title: "You don't have permission to do that", description: error.message };
  }
  if (error.status === 404) {
    return {
      title: 'That record no longer exists',
      description: 'It may have been removed by someone else. The list has been refreshed.',
    };
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
    description:
      error.requestId && error.retryable
        ? `${error.message} (Request ID: ${error.requestId})`
        : error.message,
  };
}
