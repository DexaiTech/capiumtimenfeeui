import type { BadgeTone, SelectOption } from '@/components/ui';

import type { VatCodeKind } from '../billingTypes';

/** The five VAT treatments in the order a person thinks of them. */
export const VAT_CODES = ['standard', 'reduced', 'zero', 'exempt', 'outside_scope'] as const;

export const VAT_CODE_LABEL: Record<VatCodeKind, string> = {
  standard: 'Standard',
  reduced: 'Reduced',
  zero: 'Zero rated',
  exempt: 'Exempt',
  outside_scope: 'Outside scope',
};

export const VAT_CODE_OPTIONS: ReadonlyArray<SelectOption<VatCodeKind>> = VAT_CODES.map(
  (value) => ({ value, label: VAT_CODE_LABEL[value] }),
);

export const VAT_CODE_TONE: Record<VatCodeKind, BadgeTone> = {
  standard: 'violet',
  reduced: 'blue',
  zero: 'green',
  exempt: 'amber',
  outside_scope: 'grey',
};

/** Treatments that charge no VAT by definition: the rate is fixed at 0%. */
export const ZERO_RATE_CODES: ReadonlySet<string> = new Set(['zero', 'exempt', 'outside_scope']);

export const VAT_RATE_MAX_BP = 10_000;

const PERCENT = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

/** "20" → 2000, "17.5" → 1750, "5.25%" → 525. Anything else, or more than 100, gives null. */
export function parsePercentToBp(text: string): number | null {
  const match = PERCENT.exec(text.trim().replace(/\s*%$/, ''));
  if (!match) return null;
  const bp = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return bp <= VAT_RATE_MAX_BP ? bp : null;
}

/** 2000 → "20", 1750 → "17.5", 525 → "5.25": the text of a percentage input. */
export function bpToPercentInput(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const rest = bp % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0').replace(/0$/, '')}`;
}
