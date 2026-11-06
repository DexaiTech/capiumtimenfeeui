import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';
import { formatMultiplier } from '@/utils/multiplier';

import type { OvertimeRate, RateRule } from '../types';

/** The largest money amount the API accepts (`Money`: 0 to 10^12 pence). */
export const MAX_PENCE = 1_000_000_000_000;

/** A rate in pence per hour as "£95.00/h"; no rate gives a dash (cost rates are hidden without `rate.read`). */
export function formatRate(pence: number | null | undefined): string {
  return pence === null || pence === undefined ? '—' : `${formatMoney(pence)}/h`;
}

/** "75" → 7500, "62.5" → 6250. Parsed through the digits, never a float; null when not a percentage. */
export function percentToBp(value: string): number | null {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** 7500 → "75", 6250 → "62.5". */
export function bpToPercent(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const rest = bp % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0').replace(/0$/, '')}`;
}

/** "01/09/2026 – 31/12/2026", or "01/09/2026 – open-ended". */
export function formatPeriod(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  return `${formatUkDate(from)} – ${to ? formatUkDate(to) : 'open-ended'}`;
}

/** Who or what a rule applies to, as the names of its scope: "Acme Ltd · Accounts · Sam Staff". */
export function scopeNames(
  rule: Pick<RateRule, 'client' | 'service' | 'staff' | 'grade'>,
): string[] {
  return [
    rule.client?.name,
    rule.service?.name,
    rule.staff?.full_name,
    rule.grade ? `${rule.grade.name} grade` : undefined,
  ].filter((name): name is string => Boolean(name));
}

/** Who an overtime rate applies to: "Senior grade" or "Sam Staff". */
export function overtimeSubject(rate: Pick<OvertimeRate, 'grade' | 'staff'>): string {
  return rate.staff?.full_name ?? (rate.grade ? `${rate.grade.name} grade` : '—');
}

/** An overtime rate as "1.5× the cost rate" or "£45.00/h fixed". */
export function formatOvertimeRate(
  rate: Pick<OvertimeRate, 'mode' | 'multiplier_bp' | 'rate'>,
): string {
  if (rate.mode === 'multiplier') {
    return rate.multiplier_bp === null
      ? '—'
      : `${formatMultiplier(rate.multiplier_bp)} the cost rate`;
  }
  return rate.rate === null ? '—' : `${formatRate(rate.rate)} fixed`;
}

/** Text for a plain count: "1 entry", "3 entries". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
