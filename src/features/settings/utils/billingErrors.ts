import { ApiError, isApiError } from '@/services/api';
import type { FieldErrorDetail } from '@/types/api';

import { fieldErrors } from './errors';

/** 409 codes of a duplicate name, for when the API sends no field list with them. */
const NAME_TAKEN = new Set(['VAT_RATE_NAME_TAKEN', 'TEMPLATE_NAME_TAKEN']);

/** `details` of an error when it is an object (`TEMPLATE_IN_USE`, `SEQUENCE_BACKWARDS`, …). */
function detailsObject(error: ApiError): Record<string, unknown> {
  const { details } = error;
  return typeof details === 'object' && details !== null && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : {};
}

function asFormError(
  error: ApiError,
  details: FieldErrorDetail[],
  rename: Record<string, string>,
): ApiError {
  return new ApiError({
    status: 422,
    code: error.code,
    message: error.message,
    requestId: error.requestId,
    retryAfter: error.retryAfter,
    details: details.map((detail) => ({ ...detail, field: rename[detail.field] ?? detail.field })),
  });
}

/** The sentence for a refused next number (409 `SEQUENCE_BACKWARDS` / `SEQUENCE_NUMBER_TAKEN`). */
function sequenceRefusal(error: ApiError): string | null {
  const details = detailsObject(error);
  if (error.code === 'SEQUENCE_BACKWARDS') {
    const current = details.current_next_number;
    return typeof current === 'number'
      ? `Numbers only move forward. The next number is already ${current}: enter ${current} or higher.`
      : error.message;
  }
  if (error.code === 'SEQUENCE_NUMBER_TAKEN') {
    const preview = details.preview;
    return typeof preview === 'string'
      ? `${preview} is already used and a number is never issued twice. Enter a higher number.`
      : error.message;
  }
  return null;
}

/**
 * Prepares an error for `useSubmitError`, which puts the entries of a 422 on the form's fields.
 * A duplicate name (409 with `details[{field, message}]`) and the two refusals of a next number
 * are the same thing to a form, so they are turned into one; `rename` maps API field names to the
 * form's (`rate_bp` → `rate`).
 */
export function toBillingFormError(error: unknown, rename: Record<string, string> = {}): unknown {
  if (!isApiError(error) || (error.status !== 409 && error.status !== 422)) return error;
  const listed = fieldErrors(error);
  if (listed.length > 0) return asFormError(error, listed, rename);
  if (NAME_TAKEN.has(error.code)) {
    const entry = { field: 'name', code: 'duplicate', message: error.message };
    return asFormError(error, [entry], rename);
  }
  const refusal = sequenceRefusal(error);
  if (refusal) {
    return asFormError(
      error,
      [{ field: 'next_number', code: error.code, message: refusal }],
      rename,
    );
  }
  return error;
}

/** Why the API refused to delete a template: the clients that use it are counted. */
function templateRefusal(error: ApiError): string | null {
  if (error.code !== 'TEMPLATE_IN_USE') return null;
  const clients = detailsObject(error).clients;
  if (typeof clients !== 'number') return error.message;
  const who = clients === 1 ? '1 client uses' : `${clients} clients use`;
  return `${who} this template, so it cannot be deleted. Deactivate it instead: clients keep an inactive template.`;
}

/** The text of a refusal, for the error line of a confirmation dialog. */
export function dialogError(error: unknown): { message: string; requestId?: string } {
  if (!isApiError(error)) return { message: 'An unexpected error occurred. Please try again.' };
  return {
    message: templateRefusal(error) ?? error.message,
    requestId: error.retryable ? error.requestId : undefined,
  };
}
