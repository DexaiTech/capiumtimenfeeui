import type { ApiError } from '@/services/api';

interface FieldDetail {
  field: string;
  message?: string;
}

function isFieldDetail(value: unknown): value is FieldDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { field?: unknown }).field === 'string'
  );
}

/**
 * The message a 409 CONFLICT attaches to `field`, or null when the conflict is about
 * something else. `details` may be a list of field entries or a single one.
 */
export function conflictOnField(error: ApiError, field: string): { message: string } | null {
  if (error.status !== 409) return null;
  const entries: unknown[] = Array.isArray(error.details) ? error.details : [error.details];
  const match = entries.filter(isFieldDetail).find((entry) => entry.field === field);
  return match ? { message: match.message || error.message } : null;
}
