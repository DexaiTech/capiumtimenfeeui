import { isApiError } from '@/services/api';

/** The most rows one bulk call takes (the API answers 422 for more). */
export const MAX_BULK_IDS = 200;

/** One row a bulk action refused, named the way the person knows it (its number or code). */
export interface BulkRefusalItem {
  label: string;
  reason: string;
}

/** Why a bulk action failed: the API's message and, for a 409, each row that broke a rule. */
export interface BulkRefusal {
  message: string;
  requestId?: string;
  items: BulkRefusalItem[];
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/**
 * Reads a failed bulk call. A 409 carries `details`, a list with one entry per offending row
 * (`number` or `code`, `name`, `reason`); those become the items shown under the message. Nothing
 * was changed whatever the failure, because the bulk endpoints are all or nothing.
 */
export function describeBulkError(error: unknown): BulkRefusal {
  if (!isApiError(error)) {
    return { message: 'An unexpected error occurred. Please try again.', items: [] };
  }
  const items: BulkRefusalItem[] = [];
  if (error.status === 409 && Array.isArray(error.details)) {
    for (const entry of error.details as unknown[]) {
      if (typeof entry !== 'object' || entry === null) continue;
      const record = entry as Record<string, unknown>;
      const label = text(record.number) ?? text(record.code) ?? text(record.name);
      const reason = text(record.reason) ?? text(record.message);
      if (label && reason) items.push({ label, reason });
    }
  }
  return {
    message: error.message,
    requestId: error.retryable ? error.requestId : undefined,
    items,
  };
}

/** The sentence that says what a bulk call did, for a toast and for screen readers. */
export function bulkSummary(
  result: { affected: number; changed: number },
  noun: readonly [string, string],
  verb: string,
): { title: string; description?: string } {
  const word = (count: number) => (count === 1 ? noun[0] : noun[1]);
  const title = `${result.changed} ${word(result.changed)} ${verb}`;
  const unchanged = result.affected - result.changed;
  return unchanged > 0
    ? {
        title,
        description: `${unchanged} of the ${result.affected} selected ${word(unchanged)} already had that value.`,
      }
    : { title };
}
