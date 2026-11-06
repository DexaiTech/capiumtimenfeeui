/**
 * Practice (organization) shapes of the API (`app/schemas/organization.py`).
 * Money is in minor units (pence), durations in whole minutes.
 */

import type { RecoveryRate } from './recovery';

/** The minute increments the API accepts for `time_increment_minutes`. */
export const TIME_INCREMENTS = [1, 5, 6, 10, 15, 30, 60] as const;
export type TimeIncrement = (typeof TIME_INCREMENTS)[number];

/** When the unbilled part of a fixed fee counts as work in progress (`fixed_fee_wip_mode`). */
export const FIXED_FEE_WIP_MODES = ['on_completion', 'by_budget_progress'] as const;
export type FixedFeeWipMode = (typeof FIXED_FEE_WIP_MODES)[number];

/**
 * Which charge-out rates price time: a person's own before their grade's (`staff_first`), only
 * the grade rates (`grade_only`) or only the staff rates (`staff_only`, ticket APT79).
 * Deprecated (APT84): derived by the API from `wip_valuation_sources`, which replaces it.
 */
export const RATE_MODES = ['staff_first', 'grade_only', 'staff_only'] as const;
export type RateMode = (typeof RATE_MODES)[number];

/** The rate sources that can value work in progress (APT84), in the default order. */
export const WIP_VALUATION_SOURCES = ['client', 'service', 'grade', 'staff'] as const;
export type WipValuationSource = (typeof WIP_VALUATION_SOURCES)[number];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  /** ISO weekday the week starts on: 1 (Monday) to 7 (Sunday). */
  week_start: number;
  /** ISO weekdays, 1 (Monday) to 7 (Sunday). */
  working_days: number[];
  minutes_per_day: number;
  /** ISO 4217 code, for example GBP. Fixed at creation. */
  currency: string;
  vat_registered: boolean;
  vat_number: string | null;
  company_number: string | null;
  payment_terms_days: number;
  /** Default charge-out rate in pence per hour. */
  default_charge_rate: number;
  time_increment_minutes: number;
  /** Whether timesheets are approved. Off: nobody approves time, it can be billed as it is
   * recorded and submitting a week approves it at once. */
  require_timesheet_approval: boolean;
  /** Time of people who hold `timesheet.exempt` (Owner, Admin and Partner) needs no approval. */
  auto_approve_privileged_time: boolean;
  fixed_fee_wip_mode: FixedFeeWipMode;
  /** A WIP write-on or write-off above this (pence) needs approval; 0 means every one does. */
  wip_adjustment_approval_threshold: number;
  /** A write-off above this share (basis points, 1000 = 10%) of the job's or client's current
   * WIP also needs approval, in addition to the pence threshold above; null turns it off. */
  wip_write_off_approval_threshold_percent: number | null;
  /** Whether WIP adjustments above the thresholds need approval; off, every one takes effect at
   * once. */
  wip_adjustment_approval_required: boolean;
  /** Whether expense claims are approved; off, a submitted claim is approved at once. */
  expense_approval_required: boolean;
  /** An expense above this gross amount (pence) must carry a receipt. */
  receipt_required_threshold: number;
  invoice_approval_required: boolean;
  /** With approval on, invoices above this gross amount (pence) need it; 0 means every one. */
  invoice_approval_threshold: number;
  /** Whether overdue invoices are reminded about automatically (a daily job). */
  payment_reminders_enabled: boolean;
  /** Days past the due date after which the automatic reminder goes (1 to 365). */
  payment_reminder_days_after_due: number;
  /** The days, from the invoice's due date, on which the client is reminded until it is paid:
   * negative before the due date, 0 on it, positive after it. */
  payment_reminder_schedule: number[];
  /** Pence per mile. */
  mileage_rate: number;
  /** Basis points added when an expense is recharged to the client (1000 = 10%). */
  expense_markup_bp: number;
  /** Deprecated (APT84): derived from `wip_valuation_sources`; shown and edited nowhere. */
  rate_mode: RateMode;
  /** The rate sources that value time, enabled ones only, in the order they are tried (APT84). */
  wip_valuation_sources: WipValuationSource[];
  /** Overtime on (APT81): hours beyond a person's standard hours are confirmed, approved and costed. */
  overtime_enabled: boolean;
  /** Retired by APT81 (overtime rates replace it): no longer shown or sent. */
  overtime_multiplier_bp: number;
  /** Basis points added to the cost of the work for the cost-plus value of the recovery analysis
   * (5000 = 50%: time that cost £50.00 is worth £75.00). */
  cost_plus_markup_bp: number;
  /** The order the recovery analysis looks for the rate the work could have billed at: each once. */
  recovery_rate_order: RecoveryRate[];
  /** Whether the practice uses client segments; off, they are hidden everywhere (data kept). */
  client_segments_enabled: boolean;
  /** Whether the practice uses branches (APT74); on, every client needs one. Off: hidden (data kept). */
  branches_enabled: boolean;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  /** ISO 3166-1 alpha-2, for example GB. */
  country: string;
  bank_details: string | null;
  invoice_footer: string | null;
  created_at: string;
}

export interface RoleSummary {
  id: string;
  name: string;
  /** owner, admin, partner, manager, staff, billing, viewer; null for custom roles. */
  system_key: string | null;
}

/** A practice together with the caller's role and permission codes in it. */
export interface OrganizationContext {
  organization: Organization;
  role: RoleSummary;
  permissions: string[];
  /** Whether the practice has the Capium Central client integration switched on (Settings >
   * Integrations, APT74). Off (the default), the client screens show nothing about Central. */
  central_client_enabled: boolean;
}

/** Body of PATCH /organizations/{id}; every field is optional. */
export type OrganizationUpdate = Partial<
  Pick<
    Organization,
    | 'name'
    | 'timezone'
    | 'week_start'
    | 'working_days'
    | 'minutes_per_day'
    | 'vat_registered'
    | 'vat_number'
    | 'company_number'
    | 'payment_terms_days'
    | 'default_charge_rate'
    | 'require_timesheet_approval'
    | 'auto_approve_privileged_time'
    | 'fixed_fee_wip_mode'
    | 'wip_adjustment_approval_threshold'
    | 'wip_write_off_approval_threshold_percent'
    | 'wip_adjustment_approval_required'
    | 'expense_approval_required'
    | 'receipt_required_threshold'
    | 'invoice_approval_required'
    | 'invoice_approval_threshold'
    | 'payment_reminders_enabled'
    | 'payment_reminder_days_after_due'
    | 'payment_reminder_schedule'
    | 'mileage_rate'
    | 'expense_markup_bp'
    | 'overtime_enabled'
    | 'overtime_multiplier_bp'
    | 'cost_plus_markup_bp'
    | 'recovery_rate_order'
    | 'client_segments_enabled'
    | 'branches_enabled'
    | 'email'
    | 'phone'
    | 'address_line1'
    | 'address_line2'
    | 'city'
    | 'postcode'
    | 'country'
    | 'bank_details'
    | 'invoice_footer'
  >
> & { time_increment_minutes?: TimeIncrement };

/** `POST /organizations/{id}/wip-valuation/preview`: what saving an order would change (pence). */
export interface WipValuationPreview {
  /** Unbilled time entries whose value or rate source would change. */
  entries_changed: number;
  wip_before: number;
  wip_after: number;
  /** Entries left as they are: billed, in a draft invoice, in a locked period, written off. */
  skipped: { billed: number; in_draft: number; locked: number; written_off: number };
  /** More entries than can be re-valued at once (the re-rate cap). */
  too_many: boolean;
}
