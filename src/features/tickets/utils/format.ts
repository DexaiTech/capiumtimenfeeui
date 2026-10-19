import { formatRelativeTime } from '@/utils/format';

import type { Change, TicketListItem } from '../types';

/** "138.6 KB", "69 B", "1.9 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ChangeLine {
  /** The arrow: up (green) for an increase or no change, down (red) for a decrease. */
  direction: 'up' | 'down';
  /** "New", "12%", "0%". */
  text: string;
}

/** The dashboard's "vs last period" line from the API's `change` (the arrow carries the sign). */
export function changeLine(change: Change): ChangeLine {
  if (change.kind === 'new') return { direction: 'up', text: 'New' };
  const percent = change.kind === 'percent' ? (change.percent ?? 0) : 0;
  return { direction: percent < 0 ? 'down' : 'up', text: `${String(Math.abs(percent))}%` };
}

/** "1.9%" from the API's one-decimal share; null (an empty range) gives "0.0%". */
export function formatShare(percent: number | null): string {
  return `${(percent ?? 0).toFixed(1)}%`;
}

/** "3 minutes ago" for a comment; "" for an unreadable timestamp. */
export function relativeTime(iso: string): string {
  return formatRelativeTime(iso, new Date(), 'en-GB');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}

/** The text a ticket is announced by: its code and subject. */
export function ticketLabel(ticket: Pick<TicketListItem, 'code' | 'subject'>): string {
  return `${ticket.code} ${ticket.subject}`;
}
