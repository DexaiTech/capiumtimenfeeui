import { isApiError } from '@/services/api';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { SKIP_REASON_LABEL } from '../constants';
import type { RerateSkipped } from '../types';
import { plural } from './format';

/** "+£85.00", "−£10.00" or "£0.00": a change of value, signed. */
export function formatDelta(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return '—';
  if (pence === 0) return formatMoney(0);
  return `${pence > 0 ? '+' : '−'}${formatMoney(Math.abs(pence))}`;
}

/** The entries left alone and why, nonzero reasons only: "Already billed 1 · In a locked period 2". */
export function skipSummary(skipped: Partial<RerateSkipped> | null | undefined): string {
  if (!skipped) return '';
  return Object.entries(SKIP_REASON_LABEL)
    .map(([reason, label]) => {
      const count = skipped[reason as keyof RerateSkipped] ?? 0;
      return count > 0 ? `${label} ${count}` : null;
    })
    .filter((part): part is string => part !== null)
    .join(' · ');
}

const idsOf = (value: unknown): number =>
  Array.isArray(value) ? value.length : typeof value === 'string' && value ? 1 : 0;

/**
 * What a run covered, from its saved scope: "2 clients · 1 job · 01/09/2026 – 30/09/2026". A V1
 * re-valuation names one client and one person; a re-rate lists them.
 */
export function describeRunScope(scope: Record<string, unknown>): string {
  const clients = idsOf(scope.client_ids) + idsOf(scope.client_id);
  const jobs = idsOf(scope.job_ids);
  const staff = idsOf(scope.user_ids) + idsOf(scope.user_id);
  const from = typeof scope.date_from === 'string' ? scope.date_from : '';
  const to = typeof scope.date_to === 'string' ? scope.date_to : '';
  const parts = [
    clients > 0 ? plural(clients, 'client', 'clients') : '',
    jobs > 0 ? plural(jobs, 'job', 'jobs') : '',
    staff > 0 ? plural(staff, 'staff member', 'staff members') : '',
    from && to ? `${formatUkDate(from)} – ${formatUkDate(to)}` : '',
  ].filter(Boolean);
  return parts.join(' · ') || 'Everything';
}

/** The 409 codes that say a preview can no longer be applied: it has to be done again. */
const STALE_CODES = ['PREVIEW_REQUIRED', 'PREVIEW_MISMATCH', 'PREVIEW_STALE'];

export function isStalePreview(error: unknown): boolean {
  return isApiError(error) && error.status === 409 && STALE_CODES.includes(error.code);
}

/**
 * What the refusal of an apply says, with what the new result would have been when the API
 * names it (`PREVIEW_STALE`), and what to do about it.
 */
export function staleMessage(error: unknown): string {
  if (!isApiError(error)) return 'The re-rate could not be applied. Preview it again.';
  const details =
    typeof error.details === 'object' && error.details !== null && !Array.isArray(error.details)
      ? (error.details as Record<string, unknown>)
      : {};
  const entries = details.entries_to_change;
  const value = details.charge_value_after;
  const now =
    typeof entries === 'number' && typeof value === 'number'
      ? ` It would now change ${plural(entries, 'entry', 'entries')}, to a charge-out value of ${formatMoney(value)}.`
      : '';
  return `${error.message}${now} Close this and preview again.`;
}
