import { formatUkDate } from '@/utils/dates';

/** Text for a plain count: "1 invoice", "3 invoices". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** `in_progress` as "In progress". */
export function words(code: string | null | undefined): string {
  if (!code) return '—';
  const text = code.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A page of the practice with a query: empty values are left out. */
export function linkTo(path: string, query: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

/** "Week of 12/10/2026". */
export function weekOf(date: string): string {
  return `Week of ${formatUkDate(date)}`;
}
