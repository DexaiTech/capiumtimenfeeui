import type { Deadlines } from './types';

/** Client avatar colours of the design: orange, violet, then the other spec hues. */
export const AVATAR_PALETTE = ['#D97707', '#694BAF', '#2663EB', '#069668', '#975100'] as const;

/** A stable colour for a name (FNV-1a hash), so a client keeps its colour. */
export function avatarColor(seed: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[1];
}

/** Up to two initials, the way the API derives `initials` ("Acme Widgets" → "AW", "Zed" → "ZE"). */
export function initialsOf(name: string): string {
  const words = name.split(/[^0-9A-Za-z]+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  const second = words[1];
  if (!second) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase();
}

export type HealthTone = 'good' | 'fair' | 'poor';

/** Green by default, amber under 60, red under 40 (design spec). */
export function healthTone(score: number): HealthTone {
  if (score < 40) return 'poor';
  if (score < 60) return 'fair';
  return 'good';
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let value = partsCache.get(timeZone);
  if (!value) {
    try {
      value = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      value = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    partsCache.set(timeZone, value);
  }
  return value;
}

/** "20/05/2026 - 09:23PM" (dd/MM/yyyy - hh:mma) in the practice time zone. */
export function formatActivity(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  ) as Partial<Record<Intl.DateTimeFormatPartTypes, string>>;
  const hour = (parts.hour ?? '').padStart(2, '0');
  const period = (parts.dayPeriod ?? '').replace(/\./g, '').toUpperCase();
  return `${parts.day}/${parts.month}/${parts.year} - ${hour}:${parts.minute}${period}`;
}

/** Today's date (YYYY-MM-DD) in a time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

export interface DeadlinePill {
  tone: 'danger' | 'warning';
  label: string;
}

/**
 * The Deadlines pill: red "N Overdue by Nd", amber "N Due today" / "N Due in Nd",
 * nothing when the client has no urgent deadline.
 */
export function deadlinePill(deadlines: Deadlines, today: string): DeadlinePill | null {
  switch (deadlines.status) {
    case 'overdue':
      return {
        tone: 'danger',
        label: `${deadlines.overdue} Overdue by ${deadlines.overdue_days}d`,
      };
    case 'due_today':
      return { tone: 'warning', label: `${deadlines.due_today} Due today` };
    case 'due_soon': {
      const days = deadlines.next_due_date
        ? Math.max(1, daysBetween(today, deadlines.next_due_date))
        : deadlines.due_soon_days;
      return { tone: 'warning', label: `${deadlines.due_soon} Due in ${days}d` };
    }
    default:
      return null;
  }
}

/** "31 March" for a year end. */
export function formatYearEnd(month: number | null, day: number | null): string {
  if (!month || !day) return '';
  const date = new Date(Date.UTC(2024, month - 1, day));
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
}

/** "17 Oct 2026" for an ISO date (no time zone shift). */
export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Offers a blob to the browser as a file download. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
