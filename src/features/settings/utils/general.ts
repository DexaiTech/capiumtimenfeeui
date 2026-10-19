import type { SelectOption } from '@/components/ui';
import {
  TIME_INCREMENTS,
  type FixedFeeWipMode,
  type RateMode,
  type TimeIncrement,
} from '@/types/organization';

const INCREMENT_LABELS: Record<TimeIncrement, string> = {
  1: '1 minute (exact)',
  5: '5 minutes',
  6: '6 minutes (tenths of an hour)',
  10: '10 minutes',
  15: '15 minutes (quarters)',
  30: '30 minutes',
  60: '1 hour',
};

export const INCREMENT_OPTIONS: ReadonlyArray<SelectOption> = TIME_INCREMENTS.map((value) => ({
  value: String(value),
  label: INCREMENT_LABELS[value],
}));

export const WIP_MODE_LABEL: Record<FixedFeeWipMode, string> = {
  on_completion: 'When the job is completed',
  by_budget_progress: 'As the budget is used',
};

export const WIP_MODE_HELP: Record<FixedFeeWipMode, string> = {
  on_completion:
    'The unbilled part of a fixed fee counts as work in progress once the job is completed or closed.',
  by_budget_progress:
    'The fixed fee counts as work in progress in step with the budget hours used (fee × hours logged ÷ budget hours), less what is already billed.',
};

export const WIP_MODE_OPTIONS: ReadonlyArray<SelectOption<FixedFeeWipMode>> = [
  { value: 'on_completion', label: WIP_MODE_LABEL.on_completion },
  { value: 'by_budget_progress', label: WIP_MODE_LABEL.by_budget_progress },
];

export const RATE_MODE_LABEL: Record<RateMode, string> = {
  staff_first: "Staff rate first, then the grade's",
  grade_only: 'Grade rates only',
};

export const RATE_MODE_HELP: Record<RateMode, string> = {
  staff_first:
    "A person's own charge-out rate prices their time; where they have none, their grade's rate does.",
  grade_only:
    "Staff-level rates are skipped, so every person is priced at their grade's rate. The staff rates are kept and apply again if you switch back. Cost rates are not affected.",
};

export const RATE_MODE_OPTIONS: ReadonlyArray<SelectOption<RateMode>> = [
  { value: 'staff_first', label: RATE_MODE_LABEL.staff_first },
  { value: 'grade_only', label: RATE_MODE_LABEL.grade_only },
];

/** The API bound of an approval or receipt threshold: £1,000,000.00 in pence. */
export const THRESHOLD_MAX_PENCE = 100_000_000;
/** The API bound of the mileage rate: £10.00 a mile in pence. */
export const MILEAGE_MAX_PENCE = 1000;
/** The API bound of the expense mark-up: 1000% in basis points. */
export const MARKUP_MAX_BP = 100_000;
export const REMINDER_DAYS_MAX = 365;

const MARKUP = /^(\d{1,4})(?:\.(\d{1,2}))?$/;

/** "10" → 1000, "12.5" → 1250, "7.25%" → 725. Anything else, or more than 1000, gives null. */
export function parseMarkupToBp(text: string): number | null {
  const match = MARKUP.exec(text.trim().replace(/\s*%$/, ''));
  if (!match) return null;
  const bp = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return bp <= MARKUP_MAX_BP ? bp : null;
}
