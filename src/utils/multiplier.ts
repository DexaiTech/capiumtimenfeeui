/** A rate multiplier (overtime) typed as "1.5" and stored as basis points (15000 = 1.5x). */

export const MULTIPLIER_MIN_BP = 10_000;
export const MULTIPLIER_MAX_BP = 100_000;

/** "1.5", "2", "1.25x" or "×1.5" as basis points; null when it is not a multiplier from 1 to 10. */
export function parseMultiplierToBp(text: string): number | null {
  const cleaned = text.trim().replace(/^×/, '').replace(/[x×]$/i, '').trim();
  if (!/^\d{1,2}(\.\d{1,4})?$/.test(cleaned)) return null;
  const bp = Math.round(Number(cleaned) * 10_000);
  return bp >= MULTIPLIER_MIN_BP && bp <= MULTIPLIER_MAX_BP ? bp : null;
}

/** 15000 -> "1.5", 20000 -> "2", 12500 -> "1.25". */
export function bpToMultiplierInput(bp: number): string {
  return String(bp / 10_000);
}

/** 15000 -> "1.5×". */
export function formatMultiplier(bp: number): string {
  return `${bpToMultiplierInput(bp)}×`;
}
