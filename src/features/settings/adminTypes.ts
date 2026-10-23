/**
 * Shapes of the period-lock, onboarding, integration and client import endpoints
 * (`docs/modules/period-locks.md`; `app/schemas/{onboarding,integration_connections,integrations,
 * bookkeeping_mappings}.py` of the API). Dates are `YYYY-MM-DD`, moments are ISO 8601 in UTC.
 */
import type { IsoDate, IsoDateTime } from '@/types/api';

/* ------------------------------- Period lock ------------------------------- */

export type PeriodLockEventType = 'locked' | 'reopened';

export interface PeriodLockEvent {
  id: string;
  event_type: PeriodLockEventType;
  /** The last locked day before the event; null when nothing was locked. */
  previous_locked_through: IsoDate | null;
  /** The last locked day after the event; null when nothing is locked any more. */
  locked_through: IsoDate | null;
  /** Optional for a lock, always there for a reopening. */
  reason: string | null;
  actor_user_id: string;
  actor_name: string | null;
  created_at: IsoDateTime;
}

export interface PeriodLock {
  /** Every day on or before it is closed; null when nothing is locked. */
  locked_through: IsoDate | null;
  updated_at: IsoDateTime | null;
  last_event: PeriodLockEvent | null;
}

export interface PeriodLockCreate {
  locked_through: IsoDate;
  reason?: string | null;
}

export interface PeriodLockReopen {
  /** The new last locked day, or null to remove the lock. */
  reopen_to: IsoDate | null;
  reason: string;
}

/* -------------------------------- Onboarding -------------------------------- */

export type StepState = 'done' | 'todo' | 'skipped';
export type StepSource = 'auto' | 'manual';

export interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  state: StepState;
  /** `auto`: counted from the practice's data; `manual`: a person marked it. */
  source: StepSource;
  /** What the data says; null for a step only a person can complete. */
  detected: boolean | null;
  /** What was found, for example "3 active staff members". */
  detail: string | null;
  /** Where to do it: a path below the practice's URL. */
  link: string;
  updated_by_name: string | null;
  updated_at: IsoDateTime | null;
}

export interface OnboardingSummary {
  total: number;
  done: number;
  skipped: number;
  todo: number;
  /** Steps finished (done or skipped), in percent. */
  percent: number;
  complete: boolean;
}

export interface Onboarding {
  steps: OnboardingStep[];
  summary: OnboardingSummary;
}

/* ------------------------------- Integrations ------------------------------- */

export type IntegrationKey =
  'central_client' | 'central_user' | 'practice_management' | 'bookkeeping';

export type CardStatus = 'disabled' | 'ready' | 'connected' | 'error';
export type ItemStatus = 'pending' | 'ok' | 'failed' | 'skipped';
export type SyncStatus = 'ok' | 'failed' | 'skipped';
export type RetryOutcome = 'sent' | 'retry_scheduled' | 'failed' | 'skipped' | 'already_synced';

export interface IntegrationCard {
  key: IntegrationKey;
  name: string;
  description: string;
  /** `2A` (practice management) or `2B` (bookkeeping), else null. */
  phase: string | null;
  enabled: boolean;
  /** Cannot be switched off (the central client service). */
  always_on: boolean;
  status: CardStatus;
  last_success_at: IsoDateTime | null;
  last_attempt_at: IsoDateTime | null;
  last_error: string | null;
  pending_items: number;
  failed_items: number;
  /** The settings with their defaults: see `PracticeManagementConfig` and `BookkeepingConfig`. */
  config: Record<string, unknown>;
  /** Counts specific to the integration (linked clients, linked jobs, documents sent). */
  summary: Record<string, number>;
  /** Present only while a mock service is in use (never in production). */
  mock: { available: boolean } | null;
}

export interface BookkeepingConfig {
  send_invoices: boolean;
  send_credit_notes: boolean;
  send_from: IsoDate | null;
}

export interface PracticeManagementConfig {
  sync_statuses: boolean;
}

export interface IntegrationUpdate {
  enabled?: boolean;
  config?: Partial<BookkeepingConfig> | Partial<PracticeManagementConfig>;
}

export interface SyncItem {
  id: string;
  integration: IntegrationKey;
  entity_type: string | null;
  entity_id: string | null;
  /** A name for the record, for example the invoice number. */
  label: string | null;
  direction: 'inbound' | 'outbound';
  operation: string;
  status: ItemStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: IsoDateTime | null;
  last_attempt_at: IsoDateTime | null;
  completed_at: IsoDateTime | null;
  last_error: string | null;
  /** A stable word for the failure: `UNMAPPED`, `UNAVAILABLE`, `REJECTED`, … */
  last_error_code: string | null;
  external_ref: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface SyncLogEntry {
  id: string;
  integration: string;
  direction: 'inbound' | 'outbound';
  operation: string;
  entity_type: string | null;
  entity_id: string | null;
  external_id: string | null;
  status: SyncStatus;
  message: string | null;
  attempt: number;
  created_at: IsoDateTime;
}

export interface SyncRunResult {
  integration: IntegrationKey;
  /** The other system answered (false: it was unavailable and the work stays queued). */
  available: boolean;
  queued: number;
  processed: number;
  ok: number;
  retrying: number;
  failed: number;
  skipped: number;
  pending: number;
  details: Record<string, number>;
  message: string;
}

export interface SyncItemRetried {
  outcome: RetryOutcome;
  item: SyncItem;
}

export interface RetryFailedResult {
  requeued: number;
  ok: number;
  failed: number;
  remaining: number;
}

export interface MockAvailability {
  integration: IntegrationKey;
  available: boolean;
}

export interface SyncItemFilters {
  integration?: IntegrationKey;
  status?: ItemStatus;
  q?: string;
}

export interface SyncLogFilters {
  integration?: string;
  status?: SyncStatus;
}

/* ---------------------------- Bookkeeping mappings ---------------------------- */

export interface ServiceMapping {
  /** Null is the row for invoice lines that have no service. */
  service_id: string | null;
  code: string | null;
  name: string | null;
  is_active: boolean | null;
  account_code: string | null;
  account_name: string | null;
}

export interface VatMapping {
  /** Null is the row for lines that carry no VAT code. */
  vat_rate_id: string | null;
  code: string | null;
  name: string | null;
  rate_bp: number | null;
  is_archived: boolean | null;
  tax_code: string | null;
  tax_name: string | null;
}

export interface Mappings {
  services: ServiceMapping[];
  vat_rates: VatMapping[];
  unmapped_services: number;
  unmapped_vat_rates: number;
}

export interface MappingsWrite {
  services: { service_id: string | null; account_code: string; account_name?: string | null }[];
  vat_rates: { vat_rate_id: string | null; tax_code: string; tax_name?: string | null }[];
}

/* --------------------------------- Importing --------------------------------- */

export interface ImportRowError {
  /** 1-based data row number (the header is row 0). */
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface ImportedClient {
  row: number;
  code: string | null;
  name: string;
  id: string | null;
}

export interface ImportResult {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  created: number;
  columns: string[];
  ignored_columns: string[];
  errors: ImportRowError[];
  clients: ImportedClient[];
}

/** One row of a staff, rate or job import: `code` is the staff code or job number (null for rates). */
export interface ImportedRecord {
  row: number;
  code: string | null;
  name: string;
  id: string | null;
}

/** What `POST /imports/{staff,rates,jobs}` answers (`counts`: `rates`, or `cost` and `charge`). */
export interface BulkImportResult {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  created: number;
  columns: string[];
  ignored_columns: string[];
  errors: ImportRowError[];
  items: ImportedRecord[];
  counts: Record<string, number>;
}

export interface ImportedOpeningBalanceTime {
  row: number;
  client_code: string;
  staff_email: string;
  entry_date: string;
  minutes: number;
  id: string | null;
}

export interface OpeningBalanceTimeImportResult {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  created: number;
  columns: string[];
  ignored_columns: string[];
  errors: ImportRowError[];
  entries: ImportedOpeningBalanceTime[];
}
