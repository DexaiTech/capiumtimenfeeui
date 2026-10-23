import { downloadText, toCsv } from '@/utils/csv';

/** What a staff, rates or jobs import reads: help text for the dialog and the CSV template. */
export interface BulkImportKind {
  /** The dialog title and the template file name (`<slug>-import-template.csv`). */
  title: string;
  slug: string;
  /** Singular and plural of what is imported, for the counts. */
  one: string;
  many: string;
  intro: string;
  /** Columns the file must have. */
  required: readonly string[];
  /** Every column the import reads, in template order, with an example value. */
  columns: ReadonlyArray<readonly [name: string, example: string]>;
  /** Extra sentences of help, shown under the column lists. */
  notes: readonly string[];
}

export const STAFF_IMPORT: BulkImportKind = {
  title: 'Import staff',
  slug: 'staff',
  one: 'staff member',
  many: 'staff members',
  intro:
    'Add many staff members at once. They are created without a login, like staff added one at a time; existing staff are never changed.',
  required: ['full_name', 'grade', 'start_date'],
  columns: [
    ['code', ''],
    ['full_name', 'Jane Doe'],
    ['email', 'jane@example.com'],
    ['grade', 'SNR'],
    ['job_title', 'Tax senior'],
    ['initials', 'JD'],
    ['start_date', '2026-02-01'],
    ['leaving_date', ''],
    ['working_minutes_per_day', '450'],
    ['working_days', 'Mon-Fri'],
    ['chargeable_target_percent', '75'],
    ['approver_code', ''],
    ['cost_rate', '18.50'],
    ['charge_rate', '95.00'],
    ['rate_effective_from', ''],
  ],
  notes: [
    'Grade is a grade code or name. Leave code blank to use the next staff number.',
    'Dates are YYYY-MM-DD or DD/MM/YYYY. hours_per_day can replace working_minutes_per_day.',
    'cost_rate and charge_rate are pounds per hour and create staff rates (they need permission to manage rates); rate_effective_from defaults to the start date.',
    'approver_code is an existing staff member who can sign in.',
  ],
};

export const RATES_IMPORT: BulkImportKind = {
  title: 'Import rates',
  slug: 'rates',
  one: 'rate',
  many: 'rates',
  intro:
    'Add many cost and charge-out rates at once, one rate rule per row. Rates follow the same rules as rates added one at a time.',
  required: ['kind', 'rate', 'effective_from'],
  columns: [
    ['kind', 'charge'],
    ['staff_code', ''],
    ['grade', 'SNR'],
    ['client_code', ''],
    ['service_code', ''],
    ['rate', '110.00'],
    ['effective_from', '2026-04-01'],
    ['effective_to', ''],
  ],
  notes: [
    'kind is cost or charge; rate is pounds per hour.',
    'Which of staff_code, grade, client_code and service_code are filled decides what the rate applies to: a staff member, a grade, a client (with or without a service or staff member) or a service with a grade. Cost rates are for a staff member or a grade only.',
    'effective_to is optional; leave it blank for a rate with no end.',
  ],
};

export const JOBS_IMPORT: BulkImportKind = {
  title: 'Import jobs',
  slug: 'jobs',
  one: 'job',
  many: 'jobs',
  intro:
    'Add many jobs at once. Jobs are created like jobs added one at a time and numbered from the job numbering.',
  required: ['name', 'client_code'],
  columns: [
    ['name', 'Year end 2026'],
    ['client_code', 'C0001'],
    ['service_code', 'ACCS'],
    ['status', 'planned'],
    ['billing_basis', 'fixed'],
    ['fixed_fee', '1200.00'],
    ['hourly_rate', ''],
    ['budget_hours', '12.5'],
    ['budget_fee', ''],
    ['period_start', ''],
    ['period_end', ''],
    ['start_date', '2026-04-01'],
    ['due_date', '2026-12-31'],
    ['manager', 'S001'],
    ['partner', ''],
    ['assignees', 'S002;S003'],
    ['description', ''],
  ],
  notes: [
    'client_code and service_code name existing clients and services. Staff (manager, partner, assignees) are staff codes or email addresses; assignees are separated by semicolons.',
    'status is planned or in_progress. billing_basis is hourly, fixed or non_billable; leave it blank to use the service default. Amounts are pounds.',
  ],
};

/** The CSV template: the header row and one example row. */
export function downloadImportTemplate(kind: BulkImportKind) {
  downloadText(
    `${kind.slug}-import-template.csv`,
    toCsv([kind.columns.map(([name]) => name), kind.columns.map(([, example]) => example)]),
  );
}
