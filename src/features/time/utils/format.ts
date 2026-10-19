import { formatMinutes } from '@/utils/minutes';

import { formatDayHeader } from './weeks';

export type VarianceKind = 'over' | 'under' | 'on';

export interface Variance {
  kind: VarianceKind;
  /** "+0:30", "-7:30" or "On target": the sign is part of the text, never only a colour. */
  text: string;
}

/** Logged minus target as the text and the direction the timesheet shows. */
export function describeVariance(minutes: number): Variance {
  if (minutes === 0) return { kind: 'on', text: 'On target' };
  return minutes > 0
    ? { kind: 'over', text: `+${formatMinutes(minutes)}` }
    : { kind: 'under', text: formatMinutes(minutes) };
}

/** "Tue 13/10, Thu 15/10": several days in a sentence. */
export function formatDayList(days: ReadonlyArray<string>): string {
  return days.map(formatDayHeader).join(', ');
}

/** Elapsed seconds of a timer as "1:02:03". */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/** A share of a whole in basis points ("45%"), or a dash when there is no whole. */
export function formatShare(part: number, whole: number): string {
  if (whole <= 0) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}

export interface NamedRef {
  code?: string | null;
  name?: string | null;
}

/** "J00012 Year-end accounts": a code and a name on one line, whichever exist. */
export function refLabel({ code, name }: NamedRef): string {
  return [code, name].filter(Boolean).join(' ');
}
