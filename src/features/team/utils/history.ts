import type { RateChange, RateSnapshot } from '../types';
import { formatPeriod, formatRate, scopeNames } from './format';

export interface ChangeSummary {
  /** "£175.00/h", or "£175.00/h → £190.00/h" when the amount changed. */
  rate: string;
  /** The period, or "old → new" when it changed; a grade default has none. */
  period: string;
  /** Who or what the rate applies to: "Acme Ltd · Year-end accounts". */
  scope: string;
}

const periodOf = (snapshot: RateSnapshot | null) =>
  formatPeriod(snapshot?.effective_from, snapshot?.effective_to);

const samePeriod = (a: RateSnapshot | null, b: RateSnapshot | null) =>
  (a?.effective_from ?? null) === (b?.effective_from ?? null) &&
  (a?.effective_to ?? null) === (b?.effective_to ?? null);

/**
 * A change of a rate in words: the amount (before → after when it moved), the period (the same)
 * and what it applies to. A created rule has only an "after", a deleted one only a "before"; the
 * default rates of a grade have no period.
 */
export function summariseChange(change: RateChange): ChangeSummary {
  const { old, new: next } = change;
  let rate: string;
  if (change.action === 'created') rate = formatRate(next?.rate);
  else if (change.action === 'deleted') rate = formatRate(old?.rate);
  else if ((old?.rate ?? null) === (next?.rate ?? null)) rate = formatRate(next?.rate);
  else rate = `${formatRate(old?.rate)} → ${formatRate(next?.rate)}`;

  const isDefault = Boolean(old?.default ?? next?.default);
  let period: string;
  if (isDefault) period = 'Grade default';
  else if (change.action === 'created') period = periodOf(next);
  else if (change.action === 'deleted') period = periodOf(old);
  else if (samePeriod(old, next)) period = periodOf(next);
  else period = `${periodOf(old)} → ${periodOf(next)}`;

  return { rate, period, scope: scopeNames(change).join(' · ') };
}
