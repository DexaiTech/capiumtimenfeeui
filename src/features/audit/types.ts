/**
 * Shapes of the audit endpoints that a record's History uses (`app/schemas/audit.py`,
 * `docs/modules/audit.md`). The settings area reads the full list with its own types.
 */

/** One field of a record that an action changed; the API normalises every shape the services write. */
export interface AuditChange {
  field: string;
  /** The value before; null when there was none. */
  before: unknown;
  /** The value after; null when it was cleared. */
  after: unknown;
}

/** One entry of a record's history (`GET …/audit-logs/history`). */
export interface HistoryEntry {
  id: string;
  /** `<area>.<what happened>`, for example `invoice.issued`. */
  action: string;
  /** The action in words, for example "Invoice issued". */
  label: string;
  /** Null for what the system did. */
  actor: { id: string; name: string } | null;
  /** When it happened (UTC). */
  at: string;
  /** Null unless the caller holds `audit_log.read`. */
  ip_address: string | null;
  target_type: string | null;
  target_id: string | null;
  /** What the action changed; empty for a creation, a deletion or an action without a before and after. */
  changes: AuditChange[];
  /** The label with the record it is about, for example "Invoice issued: INV-00012 (Babbage Ltd)". */
  summary: string;
}

/** The record whose history is read. */
export interface HistoryQuery {
  /** The record's type as it appears in the entries: `client`, `invoice` … */
  targetType: string;
  targetId: string;
  /** For a client: also the entries that name it (contacts, jobs, invoices, payments …). */
  includeRelated?: boolean;
}

export type ExportFormat = 'csv' | 'xlsx';

/** The filters an export takes: the same names as `GET …/audit-logs`. */
export interface AuditExportFilters {
  /** Exact action, or a prefix ending in `.`. */
  action?: string;
  actor_user_id?: string;
  /** ISO timestamps. */
  from?: string;
  to?: string;
  target_type?: string;
  target_id?: string;
  q?: string;
}
