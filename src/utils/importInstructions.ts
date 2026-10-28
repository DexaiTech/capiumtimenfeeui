import { downloadText, toCsv } from '@/utils/csv';

/** What one column of an import file takes, in words an accountant can follow. */
export interface ColumnHelp {
  name: string;
  required: boolean;
  /** What to type in it. */
  what: string;
  /** The values or the format it accepts. */
  allowed: string;
  example: string;
}

export interface ImportSheet {
  /** "Clients": the heading of the instructions. */
  title: string;
  /** The file name stem: `<slug>-import-instructions.csv`. */
  slug: string;
  /** What the import does, in a sentence. */
  summary: string;
  columns: ReadonlyArray<ColumnHelp>;
  /** Things to know that are not about one column. */
  tips: ReadonlyArray<string>;
}

const col = (
  name: string,
  required: boolean,
  what: string,
  allowed: string,
  example: string,
): ColumnHelp => ({ name, required, what, allowed, example });

const GENERAL_STEPS: ReadonlyArray<string> = [
  'Open the template file in Excel or Google Sheets. Row 1 holds the column names: do not rename, move or delete them.',
  'Row 2 is an example. Replace it with your first record, then add one row for each further record underneath.',
  'Fill the columns marked "Yes" under Required in every row. The other columns can be left empty.',
  'Dates are year-month-day, for example 2026-04-01 (DD/MM/YYYY is also accepted where it says so).',
  'Amounts are pounds with pence as a decimal, for example 95.50. Do not type the £ sign or thousand separators.',
  'Save the file as CSV (Comma delimited) and choose it in the import window. The file is checked first and nothing is created until every row is right.',
];

/** The instructions as the rows of a spreadsheet that opens in Excel. */
export function instructionRows(sheet: ImportSheet): string[][] {
  return [
    [`${sheet.title}: how to fill in the import file`],
    [sheet.summary],
    [],
    ['How to fill it in'],
    ...GENERAL_STEPS.map((step, index) => [`${String(index + 1)}. ${step}`]),
    [],
    ['The columns'],
    ['Column', 'Required', 'What to enter', 'Allowed values or format', 'Example'],
    ...sheet.columns.map((column) => [
      column.name,
      column.required ? 'Yes' : 'No',
      column.what,
      column.allowed,
      column.example,
    ]),
    ...(sheet.tips.length > 0
      ? [[], ['Good to know'], ...sheet.tips.map((tip) => [`- ${tip}`])]
      : []),
  ];
}

/** Saves the instructions of `sheet` as a spreadsheet next to the template. */
export function downloadImportInstructions(sheet: ImportSheet): void {
  downloadText(`${sheet.slug}-import-instructions.csv`, toCsv(instructionRows(sheet)));
}

const CLIENT_TYPES =
  'individual, sole_trader, partnership, llp, limited_company, trust, charity or other';

export const CLIENTS_SHEET: ImportSheet = {
  title: 'Clients',
  slug: 'clients',
  summary:
    'Adds many clients at once, each with its main contact and the services you provide to it. Existing clients are never changed.',
  columns: [
    col(
      'code',
      false,
      'Your own client code. Leave it empty to use the next client number.',
      'Letters, digits, - and _, up to 20 characters',
      'ACME01',
    ),
    col(
      'name',
      true,
      'The name of the client as it should appear on invoices.',
      'Up to 200 characters',
      'Techwave Innovations Ltd',
    ),
    col(
      'client_type',
      false,
      'What kind of client it is. Empty means a limited company.',
      CLIENT_TYPES,
      'limited_company',
    ),
    col(
      'status',
      false,
      'Where the client stands. Empty means active.',
      'prospect, active, inactive or archived',
      'active',
    ),
    col(
      'email',
      false,
      'The main email address of the client.',
      'A valid email address',
      'accounts@techwave.example',
    ),
    col('phone', false, 'The main phone number.', 'Digits and spaces', '020 7946 0000'),
    col('address_line1', false, 'First line of the address.', 'Text', '1 High Street'),
    col('address_line2', false, 'Second line of the address.', 'Text', 'Suite 4'),
    col('city', false, 'Town or city.', 'Text', 'London'),
    col('postcode', false, 'Postcode.', 'Text', 'EC1A 1AA'),
    col('country', false, 'Country.', 'Two-letter country code', 'GB'),
    col(
      'company_number',
      false,
      'Companies House number of a limited company or LLP.',
      '8 characters; a missing leading zero is added',
      '01234567',
    ),
    col('utr', false, 'Unique Taxpayer Reference.', 'Usually 10 digits', '1234567890'),
    col('vat_number', false, 'VAT registration number.', 'GB followed by 9 digits', 'GB123456789'),
    col('year_end', false, 'The date the accounting year ends.', 'DD/MM', '31/03'),
    col(
      'payment_terms_days',
      false,
      'Days the client has to pay an invoice.',
      'A whole number from 0 to 365',
      '30',
    ),
    col(
      'segment',
      false,
      'A label to group clients (a tier or a sector).',
      'Up to 40 characters',
      'Gold',
    ),
    col(
      'health_score',
      false,
      'How healthy the relationship is.',
      'A whole number from 0 to 100',
      '80',
    ),
    col(
      'accounting_software',
      false,
      'The software the client keeps its books in.',
      'xero, quickbooks, sage, freeagent or other',
      'xero',
    ),
    col(
      'contact_name',
      false,
      'The main contact. Required when any other contact column is filled in.',
      'Text',
      'Jane Doe',
    ),
    col(
      'contact_email',
      false,
      "The contact's email address.",
      'A valid email address',
      'jane@techwave.example',
    ),
    col('contact_phone', false, "The contact's phone number.", 'Digits and spaces', '07700 900123'),
    col('contact_position', false, "The contact's job title.", 'Text', 'Director'),
    col(
      'services',
      false,
      'The services you provide to this client.',
      'Service codes from Team & Rates > Services, separated by a comma or a semicolon',
      'ACCS;VAT',
    ),
    col(
      'manager_email',
      false,
      'The manager responsible for the client.',
      'The email of a member of staff already in the system',
      'marcus@yourpractice.co.uk',
    ),
    col(
      'partner_email',
      false,
      'The partner responsible for the client.',
      'The email of a member of staff already in the system',
      'priya@yourpractice.co.uk',
    ),
    col('notes', false, 'Anything worth remembering about the client.', 'Text', 'Prefers email'),
  ],
  tips: [
    'A code that is already used, or used twice in the file, is refused with the row number.',
    'Unknown column names are ignored and listed after the check, so nothing is lost silently.',
    'A file can hold up to a few thousand rows; split a bigger list into several files.',
  ],
};

export const OPENING_BALANCES_SHEET: ImportSheet = {
  title: 'Opening balances (historic time)',
  slug: 'opening-balances',
  summary:
    'Brings in time that was worked and not yet billed in your previous system, so it can be billed from here. Each row becomes one time entry.',
  columns: [
    col('client', true, 'The client the time was worked for.', 'The client code', 'ACME01'),
    col(
      'staff',
      true,
      'Who worked the time.',
      'The work email of a member of staff',
      'jane@yourpractice.co.uk',
    ),
    col('date', true, 'The day the work was done.', 'YYYY-MM-DD', '2025-03-31'),
    col(
      'hours',
      true,
      'How long it took.',
      'Hours as a number above 0 and up to 24; 3.5 is three and a half hours',
      '3.5',
    ),
    col(
      'activity',
      false,
      'The kind of work.',
      'An activity code from Team & Rates > Activity Types',
      'ACC',
    ),
    col('job', false, 'The job to put the time on.', 'A job number', 'J00012'),
    col('billable', false, 'Whether the time can be billed. Empty means billable.', 'Y or N', 'Y'),
  ],
  tips: [
    'The imported time is shown separately from newly recorded time and can still be billed together with it.',
    'Dates inside a locked period are refused: unlock the period first, or use dates after it.',
    'Nothing is created unless every row is valid.',
  ],
};

export const STAFF_SHEET: ImportSheet = {
  title: 'Staff',
  slug: 'staff',
  summary:
    'Adds many staff members at once without a login, like staff added one at a time. Existing staff are never changed.',
  columns: [
    col(
      'code',
      false,
      'The staff code. Empty uses the next staff number.',
      'Letters, digits, - and _',
      'S010',
    ),
    col('full_name', true, 'The full name.', 'Text', 'Jane Doe'),
    col(
      'email',
      false,
      'The work email address.',
      'A valid email address',
      'jane@yourpractice.co.uk',
    ),
    col(
      'grade',
      true,
      'The grade of the person.',
      'A grade code or name from Team & Rates > Grades',
      'SNR',
    ),
    col('job_title', false, 'The job title.', 'Text', 'Tax senior'),
    col(
      'initials',
      false,
      'Initials shown on timesheets and reports.',
      '1 to 6 letters or digits',
      'JD',
    ),
    col('start_date', true, 'The first day of work.', 'YYYY-MM-DD or DD/MM/YYYY', '2026-02-01'),
    col(
      'leaving_date',
      false,
      'The last day of work, when it is known.',
      'YYYY-MM-DD or DD/MM/YYYY',
      '2026-12-31',
    ),
    col(
      'working_minutes_per_day',
      false,
      'Minutes worked in a day. You can use hours_per_day (hours) instead.',
      'A whole number; 450 is 7.5 hours',
      '450',
    ),
    col(
      'working_days',
      false,
      'The days of the week worked.',
      'Mon-Fri, or days listed like Mon;Tue;Wed',
      'Mon-Fri',
    ),
    col(
      'chargeable_target_percent',
      false,
      'The share of the time that should be billable.',
      'A number from 0 to 100',
      '75',
    ),
    col(
      'approver_code',
      false,
      'Who approves their timesheets.',
      'The staff code of someone who can sign in',
      'S001',
    ),
    col(
      'cost_rate',
      false,
      'What an hour of this person costs the practice.',
      'Pounds per hour',
      '18.50',
    ),
    col(
      'charge_rate',
      false,
      'What an hour of this person is charged at.',
      'Pounds per hour',
      '95.00',
    ),
    col(
      'rate_effective_from',
      false,
      'The date the rates start. Empty uses the start date.',
      'YYYY-MM-DD or DD/MM/YYYY',
      '2026-02-01',
    ),
  ],
  tips: [
    'Entering cost_rate and charge_rate creates staff rates; you need the permission to manage rates to use them.',
    'A staff code already in use, or used twice in the file, is refused with the row number.',
  ],
};

export const RATES_SHEET: ImportSheet = {
  title: 'Rates',
  slug: 'rates',
  summary:
    'Adds many cost and charge-out rates at once, one rate per row. They follow the same rules as rates added one at a time.',
  columns: [
    col(
      'kind',
      true,
      'Whether it is what the person costs or what you charge.',
      'cost or charge',
      'charge',
    ),
    col('staff_code', false, 'The rate is for this person.', 'A staff code', 'S003'),
    col('grade', false, 'The rate is for this grade.', 'A grade code or name', 'SNR'),
    col('client_code', false, 'The rate is for this client only.', 'A client code', 'ACME01'),
    col('service_code', false, 'The rate is for this service only.', 'A service code', 'ACCS'),
    col('rate', true, 'The rate per hour.', 'Pounds per hour', '110.00'),
    col(
      'effective_from',
      true,
      'The first day the rate applies.',
      'YYYY-MM-DD or DD/MM/YYYY',
      '2026-04-01',
    ),
    col(
      'effective_to',
      false,
      'The last day it applies. Empty means no end.',
      'YYYY-MM-DD or DD/MM/YYYY',
      '2026-12-31',
    ),
  ],
  tips: [
    'Which of staff_code, grade, client_code and service_code you fill in decides who or what the rate applies to: a person (with or without a service), a grade, a client (with or without a service or person), or a service with a grade.',
    'Cost rates are for a person or a grade only.',
    'The most specific rate in force on the day of an entry is the one used.',
  ],
};

export const JOBS_SHEET: ImportSheet = {
  title: 'Jobs',
  slug: 'jobs',
  summary:
    'Adds many jobs at once. They are created like jobs added one at a time and numbered from the job numbering.',
  columns: [
    col('name', true, 'The name of the job.', 'Text', 'Year end 2026'),
    col('client_code', true, 'The client the job is for.', 'A client code that exists', 'ACME01'),
    col('service_code', false, 'The service the job belongs to.', 'A service code', 'ACCS'),
    col('status', false, 'The state the job starts in.', 'planned or in_progress', 'planned'),
    col(
      'billing_basis',
      false,
      'How the job is billed. Empty uses the service default.',
      'hourly, fixed or non_billable',
      'fixed',
    ),
    col('fixed_fee', false, 'The fee of a fixed-fee job.', 'Pounds', '1200.00'),
    col(
      'hourly_rate',
      false,
      'The rate of an hourly job, when it differs from the usual.',
      'Pounds per hour',
      '95.00',
    ),
    col('budget_hours', false, 'The time budgeted for the job.', 'Hours as a number', '12.5'),
    col('budget_fee', false, 'The fee budgeted for the job.', 'Pounds', '1500.00'),
    col(
      'period_start',
      false,
      'The start of the period the work covers, for example the accounting year.',
      'YYYY-MM-DD or DD/MM/YYYY',
      '2025-04-01',
    ),
    col('period_end', false, 'The end of that period.', 'YYYY-MM-DD or DD/MM/YYYY', '2026-03-31'),
    col(
      'start_date',
      false,
      'When work on the job starts.',
      'YYYY-MM-DD or DD/MM/YYYY',
      '2026-04-01',
    ),
    col('due_date', false, 'When the job is due.', 'YYYY-MM-DD or DD/MM/YYYY', '2026-12-31'),
    col('manager', false, 'The manager of the job.', 'A staff code or work email', 'S001'),
    col('partner', false, 'The partner responsible.', 'A staff code or work email', 'S003'),
    col(
      'assignees',
      false,
      'Everyone working on the job.',
      'Staff codes or work emails, separated by semicolons',
      'S002;S003',
    ),
    col('description', false, 'A note about the job.', 'Text', 'Includes the director loan review'),
  ],
  tips: [
    'client_code and service_code must already exist: add them first, then import the jobs.',
    'The due date cannot be before the start date, and the period cannot end before it starts.',
  ],
};
