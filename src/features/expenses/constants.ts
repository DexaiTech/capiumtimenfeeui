import type { BadgeTone } from '@/components/ui';

import type { BillingStatus, ClaimEventAction, ClaimStatus, Payer } from './types';

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

/** Text and colour of a claim status: never colour alone, the label is always shown. */
export const CLAIM_STATUS_META: Record<ClaimStatus, StatusMeta> = {
  draft: { label: 'Draft', tone: 'grey' },
  submitted: { label: 'Submitted', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  returned: { label: 'Returned', tone: 'red' },
};

export const BILLING_STATUS_META: Record<BillingStatus, StatusMeta> = {
  unbilled: { label: 'Unbilled', tone: 'grey' },
  in_draft: { label: 'On a draft invoice', tone: 'blue' },
  billed: { label: 'Billed', tone: 'green' },
  written_off: { label: 'Written off', tone: 'orange' },
};

/** What the history of a claim says, in the past tense. */
export const EVENT_LABEL: Record<ClaimEventAction, string> = {
  submitted: 'Submitted',
  recalled: 'Recalled',
  approved: 'Approved',
  returned: 'Returned',
  corrected: 'Corrected',
};

export const PAYER_LABEL: Record<Payer, string> = {
  staff: 'Staff (reimbursed)',
  practice: 'Practice (company card)',
};

export const PAYER_OPTIONS: ReadonlyArray<{ value: Payer; label: string }> = [
  { value: 'staff', label: PAYER_LABEL.staff },
  { value: 'practice', label: PAYER_LABEL.practice },
];

/** The most a receipt may weigh (10 MiB, inclusive) and how many a line may hold. */
export const MAX_RECEIPT_BYTES = 10_485_760;
export const MAX_RECEIPT_LABEL = '10 MB';
export const MAX_RECEIPTS_PER_LINE = 5;

/** A claim holds at most this many lines. */
export const MAX_CLAIM_LINES = 200;

/** `docs/modules/expenses.md`, "Limits". */
export const LIMITS = {
  title: 200,
  description: 500,
  supplier: 200,
  reason: 500,
  decision: 2000,
  typeName: 80,
  typeCode: 12,
} as const;

/** Rows of a bulk approval (the API takes at most 100 claims at once). */
export const BULK_LIMIT = 100;
