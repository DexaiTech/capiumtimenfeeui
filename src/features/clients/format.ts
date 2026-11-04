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
