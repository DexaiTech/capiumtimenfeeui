import { formatUkDate } from '@/utils/dates';

import type { ExpenseClaim } from '../types';

/** "138.6 KB", "69 B", "1.9 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

/** "07/09/2026" for one day, "07/09/2026 – 10/09/2026" for a span, "" for none. */
export function dateSpan(first: string | null, last: string | null): string {
  if (!first) return '';
  if (!last || last === first) return formatUkDate(first);
  return `${formatUkDate(first)} – ${formatUkDate(last)}`;
}

/** What a claim is called in a sentence or a label: its title, else the claimant and period. */
export function claimLabel(
  claim: Pick<ExpenseClaim, 'title' | 'user_name' | 'first_date' | 'line_count'>,
): string {
  if (claim.title) return claim.title;
  const span = dateSpan(claim.first_date, claim.first_date);
  const who = claim.user_name ?? 'Expense claim';
  return span ? `${who}, ${span}` : who;
}

/** "42.50" → "42.5 miles": the API sends two decimals, the screen drops a trailing zero. */
export function formatMiles(miles: string | null): string {
  if (miles === null) return '';
  const value = Number(miles);
  return `${String(Number.isNaN(value) ? miles : value)} ${value === 1 ? 'mile' : 'miles'}`;
}

/** Whole pence per mile as the practice states it: 45 → "45p a mile". */
export function formatRatePerMile(pence: number): string {
  return `${String(pence)}p a mile`;
}
