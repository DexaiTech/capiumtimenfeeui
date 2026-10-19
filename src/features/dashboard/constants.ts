import {
  Banknote,
  BadgeCheck,
  CalendarX2,
  CircleAlert,
  Clock,
  Gauge,
  Hourglass,
  ListTodo,
  PoundSterling,
  Receipt,
  ReceiptText,
  Undo2,
  type LucideIcon,
} from 'lucide-react';

import type { ChartColor } from '@/components/charts';
import type { BadgeTone, SegmentOption } from '@/components/ui';

import type {
  ActionKind,
  ActionPriority,
  ApprovalKind,
  BucketKey,
  CardKey,
  DashboardPeriod,
} from './types';

export const DEFAULT_PERIOD: DashboardPeriod = 'this_week';
/** The pages that show a figure that stands (WIP, debtors) compare it over a month by default. */
export const DEFAULT_STOCK_PERIOD: DashboardPeriod = 'this_month';

export const PERIOD_OPTIONS: ReadonlyArray<SegmentOption<DashboardPeriod>> = [
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'ytd', label: 'Year to Date' },
];

export const PERIOD_NOUN: Record<DashboardPeriod, string> = {
  this_week: 'week',
  this_month: 'month',
  ytd: 'year',
};

export function isPeriod(value: string | null | undefined): value is DashboardPeriod {
  return value === 'this_week' || value === 'this_month' || value === 'ytd';
}

export const MONTH_CHOICES = [6, 12, 24] as const;
export const DEFAULT_MONTHS = 12;
/** The overview's billing chart is a half-year; the page has the choices. */
export const OVERVIEW_MONTHS = 6;
export const OVERVIEW_LIST_SIZE = 5;
export const TOP_CLIENT_CHOICES = [5, 10, 20] as const;
export const DEFAULT_TOP_CLIENTS = 10;
export const OVERVIEW_TOP_CLIENTS = 5;

/** The classes of one tone, from the colour tokens so the dark theme follows. */
interface Tone {
  text: string;
  soft: string;
  strong: string;
}

const VIOLET: Tone = {
  text: 'text-badge-violet',
  soft: 'bg-badge-violet-soft',
  strong: 'bg-badge-violet/15',
};
const AMBER: Tone = {
  text: 'text-badge-amber',
  soft: 'bg-badge-amber-soft',
  strong: 'bg-badge-amber/15',
};
const BLUE: Tone = {
  text: 'text-badge-blue',
  soft: 'bg-badge-blue-soft',
  strong: 'bg-badge-blue/15',
};
const ORANGE: Tone = {
  text: 'text-badge-orange',
  soft: 'bg-badge-orange-soft',
  strong: 'bg-badge-orange/15',
};
const GREEN: Tone = {
  text: 'text-badge-green',
  soft: 'bg-badge-green-soft',
  strong: 'bg-badge-green/15',
};
const RED: Tone = {
  text: 'text-badge-red',
  soft: 'bg-badge-red-soft',
  strong: 'bg-badge-red/15',
};

export interface CardMeta extends Tone {
  icon: LucideIcon;
  /** Which way is good news: a rise in hours, a fall in overdue debt. */
  better: 'up' | 'down' | 'neutral';
}

export const CARD_META: Record<CardKey, CardMeta> = {
  my_hours: { icon: Clock, ...VIOLET, better: 'up' },
  missing_timesheets: { icon: CalendarX2, ...AMBER, better: 'down' },
  pending_approvals: { icon: BadgeCheck, ...BLUE, better: 'down' },
  unbilled_wip: { icon: Hourglass, ...ORANGE, better: 'neutral' },
  billed: { icon: PoundSterling, ...GREEN, better: 'up' },
  overdue_debtors: { icon: Banknote, ...RED, better: 'down' },
};

export const SECONDARY_LABEL = {
  target: 'Target',
  people: 'People',
  over_90_days: 'Over 90 days',
  total_outstanding: 'Total owed',
} as const;

export const PRIORITY_META: Record<ActionPriority, { label: string; tone: BadgeTone }> = {
  high: { label: 'High', tone: 'red' },
  medium: { label: 'Medium', tone: 'amber' },
  low: { label: 'Low', tone: 'blue' },
};
export const PRIORITIES: ReadonlyArray<ActionPriority> = ['high', 'medium', 'low'];

export const ACTION_ICON: Record<ActionKind, LucideIcon> = {
  timesheet_returned: Undo2,
  expense_returned: Undo2,
  task_overdue: ListTodo,
  job_overdue: CircleAlert,
  budget_exceeded: Gauge,
  timesheet_to_submit: Clock,
  timesheet_missing: CalendarX2,
  timesheet_approvals: BadgeCheck,
  expense_approvals: ReceiptText,
  invoice_approvals: BadgeCheck,
  wip_adjustment_approvals: BadgeCheck,
  budget_warning: Gauge,
  job_due_soon: CircleAlert,
  draft_invoices: Receipt,
};

export const APPROVAL_KIND_LABEL: Record<ApprovalKind, string> = {
  timesheet: 'Timesheets',
  expense: 'Expense claims',
  invoice: 'Invoices',
  wip_adjustment: 'WIP adjustments',
};

export const BUCKET_META: Record<BucketKey, { label: string; color: ChartColor }> = {
  current: { label: 'Current', color: 'success' },
  days_1_30: { label: '1-30 days', color: 'info' },
  days_31_60: { label: '31-60 days', color: 'warning' },
  days_61_90: { label: '61-90 days', color: 'orange' },
  days_90_plus: { label: '90+ days', color: 'danger' },
};
export const BUCKET_KEYS: ReadonlyArray<BucketKey> = [
  'current',
  'days_1_30',
  'days_31_60',
  'days_61_90',
  'days_90_plus',
];
