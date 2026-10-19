import type { BadgeTone } from '@/components/ui';

import type {
  BillingStatus,
  JobStatus,
  MissingStatus,
  TimeGroupBy,
  TimesheetStatus,
} from './types';

/** The longest day the API accepts (24 hours), in minutes. */
export const MAX_DAY_MINUTES = 1440;

/** How long a typed cell waits for the next keystroke before it is saved. */
export const AUTOSAVE_DELAY_MS = 800;

/** Rows per request when a whole week of entries is read (the API allows up to 100). */
export const WEEK_ENTRIES_PAGE = 100;

/** The most entries a CSV export of the Time Entries page collects. */
export const EXPORT_MAX_ROWS = 5000;

/** Time cannot be recorded against a job in one of these states. */
export const CLOSED_JOB_STATUSES: ReadonlyArray<JobStatus> = ['completed', 'closed', 'cancelled'];

/** `rejected` is shown as "Returned": the approver sent it back with a reason. */
export const SHEET_STATUS_LABEL: Record<TimesheetStatus | MissingStatus, string> = {
  none: 'Not started',
  open: 'Open',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Returned',
};

export const SHEET_STATUS_TONE: Record<TimesheetStatus | MissingStatus, BadgeTone> = {
  none: 'grey',
  open: 'blue',
  submitted: 'amber',
  approved: 'green',
  rejected: 'red',
};

export const TIMESHEET_STATUSES: ReadonlyArray<TimesheetStatus> = [
  'open',
  'submitted',
  'approved',
  'rejected',
];

/** Time can be typed in while the sheet is open or has been returned. */
export const EDITABLE_SHEET_STATUSES: ReadonlyArray<TimesheetStatus> = ['open', 'rejected'];

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  unbilled: 'Unbilled',
  in_draft: 'On a draft invoice',
  billed: 'Billed',
  written_off: 'Written off',
};

export const BILLING_STATUS_TONE: Record<BillingStatus, BadgeTone> = {
  unbilled: 'amber',
  in_draft: 'blue',
  billed: 'green',
  written_off: 'grey',
};

export const BILLING_STATUSES: ReadonlyArray<BillingStatus> = [
  'unbilled',
  'in_draft',
  'billed',
  'written_off',
];

/** The level of the rate ladder that priced an entry (`rate_source`). */
export const RATE_SOURCE_LABEL: Record<string, string> = {
  client_service_staff: 'Client + service + staff rate',
  client_service: 'Client + service rate',
  client_staff: 'Client + staff rate',
  client: 'Client rate',
  job: 'Job rate',
  service_grade: 'Service rate for the grade',
  staff: 'Staff rate',
  grade: 'Grade rate',
  default: 'Practice default rate',
};

export const GROUP_BY_OPTIONS: ReadonlyArray<{ value: TimeGroupBy; label: string }> = [
  { value: 'person', label: 'Person' },
  { value: 'client', label: 'Client' },
  { value: 'job', label: 'Job' },
  { value: 'activity', label: 'Activity' },
  { value: 'service', label: 'Service' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/** What a field of a time entry is called in a correction's before and after. */
export const ENTRY_FIELD_LABEL: Record<string, string> = {
  entry_date: 'Date',
  minutes: 'Time',
  client_id: 'Client',
  client_name: 'Client',
  job_id: 'Job',
  job_name: 'Job',
  job_number: 'Job number',
  activity_code_id: 'Activity',
  activity_code: 'Activity',
  description: 'Description',
  internal_note: 'Internal note',
  is_billable: 'Billable',
  charge_rate: 'Charge rate',
  cost_rate: 'Cost rate',
  charge_value: 'Value',
  cost_value: 'Cost',
  rate_source: 'Rate source',
  timesheet_id: 'Timesheet',
  week_start: 'Week',
};

/** The keys of a snapshot that only repeat another one (an id next to its name). */
export const HISTORY_HIDDEN_FIELDS: ReadonlyArray<string> = [
  'client_id',
  'job_id',
  'activity_code_id',
  'timesheet_id',
];
