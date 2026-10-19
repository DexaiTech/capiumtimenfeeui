/**
 * Practice (organization) shapes of the API (`app/schemas/organization.py`).
 * Money is in minor units (pence), durations in whole minutes.
 */

/** The minute increments the API accepts for `time_increment_minutes`. */
export const TIME_INCREMENTS = [1, 5, 6, 10, 15, 30, 60] as const;
export type TimeIncrement = (typeof TIME_INCREMENTS)[number];

/** When the unbilled part of a fixed fee counts as work in progress (`fixed_fee_wip_mode`). */
export const FIXED_FEE_WIP_MODES = ['on_completion', 'by_budget_progress'] as const;
export type FixedFeeWipMode = (typeof FIXED_FEE_WIP_MODES)[number];

/** Whether a person's own charge-out rate prices time (`staff_first`) or only their grade's. */
export const RATE_MODES = ['staff_first', 'grade_only'] as const;
export type RateMode = (typeof RATE_MODES)[number];

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
  require_timesheet_approval: boolean;
  fixed_fee_wip_mode: FixedFeeWipMode;
  /** A WIP write-on or write-off above this (pence) needs approval; 0 means every one does. */
  wip_adjustment_approval_threshold: number;
  /** A write-off above this share (basis points, 1000 = 10%) of the job's or client's current
   * WIP also needs approval, in addition to the pence threshold above; null turns it off. */
  wip_write_off_approval_threshold_percent: number | null;
  /** An expense above this gross amount (pence) must carry a receipt. */
  receipt_required_threshold: number;
  invoice_approval_required: boolean;
  /** With approval on, invoices above this gross amount (pence) need it; 0 means every one. */
  invoice_approval_threshold: number;
  /** Whether overdue invoices are reminded about automatically (a daily job). */
  payment_reminders_enabled: boolean;
  /** Days past the due date after which the automatic reminder goes (1 to 365). */
  payment_reminder_days_after_due: number;
  /** Pence per mile. */
  mileage_rate: number;
  /** Basis points added when an expense is recharged to the client (1000 = 10%). */
  expense_markup_bp: number;
  rate_mode: RateMode;
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
    | 'fixed_fee_wip_mode'
    | 'wip_adjustment_approval_threshold'
    | 'wip_write_off_approval_threshold_percent'
    | 'receipt_required_threshold'
    | 'invoice_approval_required'
    | 'invoice_approval_threshold'
    | 'payment_reminders_enabled'
    | 'payment_reminder_days_after_due'
    | 'mileage_rate'
    | 'expense_markup_bp'
    | 'rate_mode'
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
