import type { ChartColor } from '@/components/charts';
import type { BadgeTone } from '@/components/ui';

import type {
  AgeingBucket,
  EstimateDisplayStatus,
  GroupBy,
  InvoiceDisplayStatus,
  InvoiceLineKind,
  PaymentMethod,
  PaymentState,
  ReminderSkipReason,
  ReminderStatus,
  ReminderTemplate,
  ScheduleFrequency,
  ScheduleStatus,
  StatementEntryType,
  WipItemKind,
} from './types';

export interface LabelTone {
  label: string;
  tone: BadgeTone;
}

/** Status text and colour of an invoice (never colour alone). */
export const INVOICE_STATUS_LABELS: Record<InvoiceDisplayStatus, LabelTone> = {
  draft: { label: 'Draft', tone: 'grey' },
  awaiting_approval: { label: 'Awaiting approval', tone: 'violet' },
  approved: { label: 'Approved', tone: 'blue' },
  issued: { label: 'Issued', tone: 'blue' },
  part_paid: { label: 'Part paid', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  credited: { label: 'Credited', tone: 'orange' },
  overdue: { label: 'Overdue', tone: 'red' },
  void: { label: 'Void', tone: 'grey' },
};

/** The order of the status tabs of the invoice list. */
export const INVOICE_TAB_ORDER: ReadonlyArray<InvoiceDisplayStatus> = [
  'draft',
  'awaiting_approval',
  'approved',
  'issued',
  'part_paid',
  'paid',
  'credited',
  'void',
  'overdue',
];

export const PAYMENT_STATE_LABELS: Record<PaymentState, LabelTone> = {
  unallocated: { label: 'Unallocated', tone: 'amber' },
  part_allocated: { label: 'Part allocated', tone: 'blue' },
  allocated: { label: 'Allocated', tone: 'green' },
  void: { label: 'Void', tone: 'grey' },
  reversed: { label: 'Reversed', tone: 'red' },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  direct_debit: 'Direct debit',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
};

export const LINE_KIND_LABELS: Record<InvoiceLineKind, string> = {
  time: 'Time',
  fixed_fee: 'Fixed fee',
  disbursement: 'Disbursement',
  expense: 'Expense',
  manual: 'Manual',
};

export const WIP_KIND_LABELS: Record<WipItemKind, LabelTone> = {
  time: { label: 'Time', tone: 'blue' },
  fixed_fee: { label: 'Fixed fee', tone: 'violet' },
  expense: { label: 'Expense', tone: 'orange' },
  disbursement: { label: 'Disbursement', tone: 'amber' },
};

export const GROUP_BY_OPTIONS: ReadonlyArray<{ value: GroupBy; label: string }> = [
  { value: 'job', label: 'One line per job' },
  { value: 'entry', label: 'One line per time entry' },
  { value: 'single', label: 'One line for all time' },
];

/** Rows loaded per page of a list. */
export const LIST_PAGE_SIZE = 25;

/** The ageing buckets of the debtors, with the colour each is drawn in (never the only signal). */
export const AGEING_LABELS: Record<
  AgeingBucket,
  { label: string; color: ChartColor; short: string }
> = {
  current: { label: 'Current', short: 'Current', color: 'success' },
  days_1_30: { label: '1–30 days overdue', short: '1–30', color: 'info' },
  days_31_60: { label: '31–60 days overdue', short: '31–60', color: 'warning' },
  days_61_90: { label: '61–90 days overdue', short: '61–90', color: 'orange' },
  days_90_plus: { label: 'Over 90 days overdue', short: '90+', color: 'danger' },
};

export const REMINDER_TEMPLATE_LABELS: Record<ReminderTemplate, string> = {
  client_payment_reminder: 'Payment reminder',
  client_payment_upcoming: 'Payment due soon',
  client_payment_final_notice: 'Final notice',
};

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, LabelTone> = {
  queued: { label: 'Queued', tone: 'blue' },
  sent: { label: 'Sent', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  skipped: { label: 'Skipped', tone: 'grey' },
};

export const REMINDER_SKIP_LABELS: Record<ReminderSkipReason, string> = {
  already_reminded_today: 'Already reminded today',
  not_overdue: 'Not overdue',
  no_balance: 'Nothing outstanding',
  not_issued: 'Not issued',
  no_recipient: 'No email address on the client',
};

/** The most rows an export follows the cursor for. */
export const EXPORT_ROW_LIMIT = 5000;

/** What a line of a client statement is (the text beside the colour). */
export const STATEMENT_ENTRY_LABELS: Record<StatementEntryType, LabelTone> = {
  invoice: { label: 'Invoice', tone: 'blue' },
  credit_note: { label: 'Credit note', tone: 'orange' },
  payment: { label: 'Payment', tone: 'green' },
  payment_reversal: { label: 'Payment reversed', tone: 'red' },
};

/** The five VAT treatments of an invoice line, as the practice's VAT codes name them. */
export const VAT_KIND_LABELS: Record<string, string> = {
  standard: 'Standard',
  reduced: 'Reduced',
  zero: 'Zero',
  exempt: 'Exempt',
  outside_scope: 'Outside scope',
};

export const MAX_PENCE = 1_000_000_000_000;

/** Status text and colour of an estimate (never colour alone). */
export const ESTIMATE_STATUS_LABELS: Record<EstimateDisplayStatus, LabelTone> = {
  draft: { label: 'Draft', tone: 'grey' },
  sent: { label: 'Sent', tone: 'blue' },
  accepted: { label: 'Accepted', tone: 'green' },
  declined: { label: 'Declined', tone: 'red' },
  expired: { label: 'Expired', tone: 'amber' },
};

/** The order of the status tabs of the estimate list. */
export const ESTIMATE_TAB_ORDER: ReadonlyArray<EstimateDisplayStatus> = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
];

export const SCHEDULE_FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, LabelTone> = {
  active: { label: 'Active', tone: 'green' },
  paused: { label: 'Paused', tone: 'amber' },
  ended: { label: 'Ended', tone: 'grey' },
};

/** The order of the status tabs of the schedule list. */
export const SCHEDULE_TAB_ORDER: ReadonlyArray<ScheduleStatus> = ['active', 'paused', 'ended'];

/** The most lines the API takes on one estimate or schedule. */
export const MAX_DOCUMENT_LINES = 200;
