/**
 * A cost-plus mark-up typed in percent ("50", "12.5") and held by the API in basis points
 * (5000 = 50%, at most 100 000 = 1000%): the mark-up of a client or a job in the recovery
 * analysis. Blank means "not set" (null): the client's, else the practice's applies.
 */
export const MARKUP_MAX_BP = 100_000;

const MARKUP = /^(\d{1,4})(?:\.(\d{1,2}))?$/;

/** "10" → 1000, "12.5" → 1250, "7.25%" → 725. Anything else, or more than 1000%, gives null. */
export function percentToMarkupBp(text: string): number | null {
  const match = MARKUP.exec(text.trim().replace(/\s*%$/, ''));
  if (!match) return null;
  const bp = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return bp <= MARKUP_MAX_BP ? bp : null;
}

/** 5000 → "50", 1250 → "12.5"; null → "" (not set). */
export function markupBpToInput(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return '';
  const whole = Math.trunc(bp / 100);
  const rest = bp % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0').replace(/0$/, '')}`;
}

/** Blank or a valid percentage. */
export function isMarkupInput(text: string): boolean {
  return text.trim() === '' || percentToMarkupBp(text) !== null;
}

export const MARKUP_MESSAGE =
  'Enter a percentage from 0 to 1000 with at most two decimals, for example 50, or leave it blank';
