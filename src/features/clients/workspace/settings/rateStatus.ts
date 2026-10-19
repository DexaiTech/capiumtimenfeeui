import type { ClientRateRead } from '../../types';

export type RateStatus = 'current' | 'future' | 'ended';

export const RATE_STATUS_LABELS: Record<RateStatus, string> = {
  current: 'Current',
  future: 'Starts later',
  ended: 'Ended',
};

/** Where a rate stands today: not yet started, in force, or past its last day (ISO dates compare as text). */
export function rateStatus(
  rate: Pick<ClientRateRead, 'effective_from' | 'effective_to'>,
  today: string,
): RateStatus {
  if (rate.effective_from > today) return 'future';
  if (rate.effective_to !== null && rate.effective_to < today) return 'ended';
  return 'current';
}

/** An end date can be set or moved while the rate has not already ended. */
export function canEndRate(rate: ClientRateRead, today: string): boolean {
  return rateStatus(rate, today) !== 'ended';
}

/** Who a rate applies to, in words. */
export function rateAudience(rate: Pick<ClientRateRead, 'user_name' | 'user_id'>): string {
  if (rate.user_id === null) return 'Everyone';
  return rate.user_name ?? 'Former member';
}
