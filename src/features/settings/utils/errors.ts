import { ApiError, isApiError } from '@/services/api';
import type { FieldErrorDetail } from '@/types/api';
import { formatWait } from '@/utils/format';

export interface ErrorNotice {
  title: string;
  description?: string;
}

export function fieldErrors(error: unknown): FieldErrorDetail[] {
  if (!isApiError(error) || !Array.isArray(error.details)) return [];
  return error.details.filter(
    (entry): entry is FieldErrorDetail =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as FieldErrorDetail).field === 'string' &&
      typeof (entry as FieldErrorDetail).message === 'string',
  );
}

/** Renames the fields of a 422 so they match the form (for example minutes → hours). */
export function renameFields(error: unknown, names: Record<string, string>): unknown {
  if (!isApiError(error) || error.status !== 422) return error;
  const details = fieldErrors(error);
  if (details.length === 0) return error;
  return new ApiError({
    status: error.status,
    code: error.code,
    message: error.message,
    requestId: error.requestId,
    retryAfter: error.retryAfter,
    details: details.map((detail) => ({ ...detail, field: names[detail.field] ?? detail.field })),
  });
}

/** The uniform per-status wording for a failed action (docs/frontend.md, "Status handling"). */
export function describeError(error: unknown, fallbackTitle: string): ErrorNotice {
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
  if (error.status === 0)
    return { title: 'Could not reach the server', description: error.message };
  return {
    title: fallbackTitle,
    description: error.requestId
      ? `${error.message} (Request ID: ${error.requestId})`
      : error.message,
  };
}
