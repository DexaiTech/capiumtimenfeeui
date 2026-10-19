import { PERMISSIONS as P } from '@/constants/permissions';

import {
  CLIENT_TAB_IDS,
  type BillingStatus,
  type ClientTabId,
  type InvoiceDisplayStatus,
  type JobStatus,
  type PaymentMethod,
  type PaymentState,
  type TabCounts,
} from './types';

export interface ClientTabDef {
  id: ClientTabId;
  label: string;
  /** The tab's badge, from the overview; null when the caller may not see the data. */
  count?: (counts: TabCounts) => number | null;
  /** UI gating only: the API checks every permission again. */
  visible: (can: (permission: string) => boolean) => boolean;
}

/**
 * The tabs of the client workspace (`/clients/:clientId/<id>`), in order, with who sees each.
 * Time and expenses are open to people who may see only their own entries.
 */
export const CLIENT_TABS: ReadonlyArray<ClientTabDef> = [
  { id: 'overview', label: 'Overview', visible: () => true },
  { id: 'jobs', label: 'Jobs', count: (c) => c.jobs, visible: (can) => can(P.jobRead) },
  {
    id: 'time',
    label: 'Time',
    count: (c) => c.time_entries,
    visible: (can) => can(P.timeReadAll) || can(P.timeLog),
  },
  {
    id: 'expenses',
    label: 'Expenses',
    count: (c) => c.expenses,
    visible: (can) => can(P.wipRead) || can(P.disbursementLog) || can(P.disbursementManage),
  },
  { id: 'wip', label: 'WIP', count: (c) => c.wip, visible: (can) => can(P.wipRead) },
  {
    id: 'invoices',
    label: 'Invoices',
    count: (c) => c.invoices,
    visible: (can) => can(P.invoiceRead),
  },
  {
    id: 'payments',
    label: 'Payments',
    count: (c) => c.payments,
    visible: (can) => can(P.paymentRead),
  },
  { id: 'contacts', label: 'Contacts', count: (c) => c.contacts, visible: () => true },
  { id: 'history', label: 'History', visible: (can) => can(P.auditLogRead) },
  { id: 'settings', label: 'Settings', visible: () => true },
];

/** The tabs the caller may open. */
export function visibleTabs(can: (permission: string) => boolean): ClientTabDef[] {
  return CLIENT_TABS.filter((tab) => tab.visible(can));
}

export function isClientTabId(value: string): value is ClientTabId {
  return (CLIENT_TAB_IDS as readonly string[]).includes(value);
}

/** Rows loaded per page of a tab's table. */
export const RECORD_PAGE_SIZE = 25;

/** Rows of the WIP items table shown before "Show more" (the endpoint returns every item). */
export const WIP_ITEMS_PAGE = 50;

export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'grey' | 'orange';

export interface LabelTone {
  label: string;
  tone: Tone;
}

/** The overview calls a planned job "not started" and a cancelled one "closed". */
export const JOB_STATUS_LABELS: Record<JobStatus, LabelTone> = {
  planned: { label: 'Not started', tone: 'grey' },
  in_progress: { label: 'In progress', tone: 'blue' },
  on_hold: { label: 'On hold', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Closed', tone: 'grey' },
};

export const BILLING_STATUS_LABELS: Record<BillingStatus, LabelTone> = {
  unbilled: { label: 'Unbilled', tone: 'violet' },
  in_draft: { label: 'In draft', tone: 'blue' },
  billed: { label: 'Billed', tone: 'green' },
  written_off: { label: 'Written off', tone: 'grey' },
};

export const INVOICE_STATUS_LABELS: Record<InvoiceDisplayStatus, LabelTone> = {
  draft: { label: 'Draft', tone: 'grey' },
  issued: { label: 'Issued', tone: 'blue' },
  overdue: { label: 'Overdue', tone: 'red' },
  part_paid: { label: 'Part paid', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  void: { label: 'Void', tone: 'grey' },
};

export const PAYMENT_STATE_LABELS: Record<PaymentState, LabelTone> = {
  unallocated: { label: 'Unallocated', tone: 'amber' },
  part_allocated: { label: 'Part allocated', tone: 'blue' },
  allocated: { label: 'Allocated', tone: 'green' },
  void: { label: 'Void', tone: 'grey' },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  direct_debit: 'Direct debit',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
};

/** The WIP ageing buckets of the overview and the WIP tab, with the colour of each bar. */
export const AGEING_BUCKETS = [
  { key: '0_30', label: '0–30 days', color: 'success' },
  { key: '31_60', label: '31–60 days', color: 'warning' },
  { key: '61_90', label: '61–90 days', color: 'orange' },
  { key: '90_plus', label: 'Over 90 days', color: 'danger' },
] as const;
export type AgeingKey = (typeof AGEING_BUCKETS)[number]['key'];
