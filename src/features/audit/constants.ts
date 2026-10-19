/** The most entries one export holds (the newest that match; `docs/modules/audit.md`). */
export const EXPORT_ROW_LIMIT = 50_000;

/** A record type the audit log is filtered by: what the entries call it, and in words. */
export interface RecordTypeOption {
  value: string;
  label: string;
}

/**
 * The `target_type` of the entries the application writes (`docs/modules/audit.md`), in the
 * order a practice thinks of them: clients and work first, billing, then people and settings.
 */
export const RECORD_TYPES: ReadonlyArray<RecordTypeOption> = [
  { value: 'client', label: 'Client' },
  { value: 'client_contact', label: 'Client contact' },
  { value: 'client_service', label: 'Client service' },
  { value: 'job', label: 'Job' },
  { value: 'task', label: 'Job task' },
  { value: 'time_entry', label: 'Time entry' },
  { value: 'timesheet', label: 'Timesheet' },
  { value: 'disbursement', label: 'Disbursement' },
  { value: 'expense_claim', label: 'Expense claim' },
  { value: 'expense', label: 'Expense line' },
  { value: 'wip_write_off', label: 'WIP write-off' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'credit_note', label: 'Credit note' },
  { value: 'payment', label: 'Payment' },
  { value: 'rate_rule', label: 'Rate' },
  { value: 'staff_rate', label: 'Staff rate' },
  { value: 'client_rate', label: 'Client rate' },
  { value: 'period_lock', label: 'Period lock' },
  { value: 'member', label: 'Staff member' },
  { value: 'role', label: 'Role' },
  { value: 'organization', label: 'Practice' },
  { value: 'vat_rate', label: 'VAT rate' },
  { value: 'service', label: 'Service' },
  { value: 'activity_code', label: 'Activity code' },
  { value: 'grade', label: 'Grade' },
  { value: 'sequence', label: 'Numbering' },
  { value: 'invoice_template', label: 'Invoice template' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'audit_log', label: 'Audit log' },
];

/** "Time entry" for `time_entry`; an unknown type is made readable (`widget_part` → "Widget part"). */
export function recordTypeLabel(type: string): string {
  const known = RECORD_TYPES.find((option) => option.value === type);
  if (known) return known.label;
  const words = type.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
