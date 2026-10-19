import type { ChartColor } from '@/components/charts';
import type { BadgeTone } from '@/components/ui';

import type {
  AdjustmentKind,
  AdjustmentStatus,
  HistoricGroup,
  MovementKind,
  SummarySort,
  TransferStatus,
  WipAges,
  WipComponent,
  WipGroup,
  WipItemKind,
} from './types';

export interface Meta {
  label: string;
  tone: BadgeTone;
}

/** The text and colour of a status: never colour alone, the label is always shown. */
export const ADJUSTMENT_STATUS_META: Record<AdjustmentStatus, Meta> = {
  pending: { label: 'Pending approval', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  reversed: { label: 'Reversed', tone: 'grey' },
};

export const ADJUSTMENT_KIND_META: Record<AdjustmentKind, Meta> = {
  write_on: { label: 'Write-on', tone: 'green' },
  write_off: { label: 'Write-off', tone: 'red' },
};

export const TRANSFER_STATUS_META: Record<TransferStatus, Meta> = {
  applied: { label: 'Applied', tone: 'green' },
  reversed: { label: 'Reversed', tone: 'grey' },
};

export const COMPONENT_LABEL: Record<WipComponent, string> = {
  time: 'Time',
  fixed_fee: 'Fixed fee',
  expense: 'Expense',
};

export const ITEM_KIND_META: Record<WipItemKind, Meta> = {
  time: { label: 'Time', tone: 'blue' },
  disbursement: { label: 'Disbursement', tone: 'violet' },
  expense: { label: 'Expense', tone: 'orange' },
  fixed_fee: { label: 'Fixed fee', tone: 'green' },
  adjustment: { label: 'Adjustment', tone: 'grey' },
};

export const MOVEMENT_KIND_META: Record<MovementKind, Meta> = {
  write_on: { label: 'Write-on', tone: 'green' },
  write_off: { label: 'Write-off', tone: 'red' },
  transfer_out: { label: 'Transfer out', tone: 'amber' },
  transfer_in: { label: 'Transfer in', tone: 'blue' },
  credit_return: { label: 'Credit note: returned', tone: 'violet' },
  credit_write_off: { label: 'Credit note: written off', tone: 'red' },
  reversal: { label: 'Reversal', tone: 'grey' },
};

export interface GroupMeta {
  /** The tab. */
  tab: string;
  /** The header of the first column. */
  column: string;
  /** For the pagination footer. */
  items: [string, string];
  /** The query parameter that narrows the item list to one row of this grouping. */
  filter: 'client_id' | 'job_id' | 'partner_user_id' | 'manager_user_id' | 'service_id';
}

export const GROUP_META: Record<WipGroup, GroupMeta> = {
  client: { tab: 'Client', column: 'Client', items: ['client', 'clients'], filter: 'client_id' },
  job: { tab: 'Job', column: 'Job', items: ['job', 'jobs'], filter: 'job_id' },
  partner: {
    tab: 'Partner',
    column: 'Partner',
    items: ['partner', 'partners'],
    filter: 'partner_user_id',
  },
  manager: {
    tab: 'Manager',
    column: 'Manager',
    items: ['manager', 'managers'],
    filter: 'manager_user_id',
  },
  service: {
    tab: 'Service',
    column: 'Service',
    items: ['service', 'services'],
    filter: 'service_id',
  },
};

export const HISTORIC_GROUP_META: Record<HistoricGroup, { tab: string; column: string }> = {
  client: { tab: 'Client', column: 'Client' },
  job: { tab: 'Job', column: 'Job' },
  billing_type: { tab: 'Billing type', column: 'Billing type' },
};

export const BILLING_TYPE_LABEL: Record<string, string> = {
  hourly: 'Hourly',
  fixed: 'Fixed fee',
  non_billable: 'Non-billable',
};

export const AGE_BUCKETS: ReadonlyArray<{
  key: keyof WipAges;
  label: string;
  color: ChartColor;
}> = [
  { key: 'days_0_30', label: '0-30 days', color: 'success' },
  { key: 'days_31_60', label: '31-60 days', color: 'warning' },
  { key: 'days_61_90', label: '61-90 days', color: 'orange' },
  { key: 'days_90_plus', label: '90+ days', color: 'danger' },
];

export const SUMMARY_SORT_LABEL: Record<SummarySort, string> = {
  name: 'Name',
  total: 'Total WIP',
  time: 'Time WIP',
  fixed_fee: 'Fixed fee WIP',
  expense: 'Expense WIP',
  oldest: 'Oldest item',
  over_90: 'Over 90 days',
  items: 'Items',
};

/** The most a reason or a note may be (the API's limit). */
export const REASON_MAX = 500;

/** Items older than this are flagged in the item list (the last two ageing buckets). */
export const AGED_DAYS = 60;
export const OLD_DAYS = 90;
