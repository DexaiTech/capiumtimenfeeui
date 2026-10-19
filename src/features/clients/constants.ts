import {
  ACCOUNTING_SOFTWARE,
  AML_STATUSES,
  CLIENT_STATUSES,
  CLIENT_TYPES,
  FREQUENCIES,
  type AccountingSoftware,
  type AmlStatus,
  type CentralFilter,
  type ClientFilters,
  type ClientSort,
  type ClientStatus,
  type ClientType,
  type Frequency,
} from './types';

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  individual: 'Individual',
  sole_trader: 'Sole Trader',
  partnership: 'Partnership',
  llp: 'LLP',
  limited_company: 'Limited',
  trust: 'Trust',
  charity: 'Charity',
  other: 'Other',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  prospect: 'Prospect',
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

export const AML_LABELS: Record<AmlStatus, string> = {
  not_started: 'Not started',
  pending: 'Pending',
  clear: 'Clear',
  review: 'Review',
  failed: 'Failed',
};

export const SOFTWARE_LABELS: Record<AccountingSoftware, string> = {
  xero: 'Xero',
  quickbooks: 'QuickBooks',
  sage: 'Sage',
  freeagent: 'FreeAgent',
  other: 'Other',
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  one_off: 'One-off',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

/** The `central` list filter: enabled from the central client service, or created here. */
export const CENTRAL_FILTER_OPTIONS: ReadonlyArray<{ value: CentralFilter; label: string }> = [
  { value: 'linked', label: 'Linked to central' },
  { value: 'local', label: 'Local only' },
];

/** The filter a select value stands for (empty: no filter). */
export function parseCentralFilter(value: string): CentralFilter | null {
  return CENTRAL_FILTER_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

/** The segments the design names; any other text the API holds is shown as it is. */
export const KNOWN_SEGMENTS = ['Bronze', 'Silver', 'Gold', 'Platinum'] as const;

const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

export const CLIENT_TYPE_OPTIONS = options(CLIENT_TYPES, CLIENT_TYPE_LABELS);
export const CLIENT_STATUS_OPTIONS = options(CLIENT_STATUSES, CLIENT_STATUS_LABELS);
export const AML_OPTIONS = options(AML_STATUSES, AML_LABELS);
export const SOFTWARE_OPTIONS = options(ACCOUNTING_SOFTWARE, SOFTWARE_LABELS);
export const FREQUENCY_OPTIONS = options(FREQUENCIES, FREQUENCY_LABELS);

export const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label, index) => ({ value: String(index + 1), label }));

export function labelOf<T extends string>(labels: Record<T, string>, value: string | null): string {
  if (!value) return '';
  return (labels as Record<string, string>)[value] ?? value;
}

/** Table columns that can be hidden (the checkbox and the client name always show). */
export const TOGGLEABLE_COLUMNS = [
  { id: 'reg_no', label: 'Reg No' },
  { id: 'segment', label: 'Segment' },
  { id: 'health', label: 'Health' },
  { id: 'contact', label: 'Contact' },
  { id: 'contact_email', label: 'Contact Email' },
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'aml', label: 'AML' },
  { id: 'activity', label: 'Activity' },
  { id: 'services', label: 'Services' },
  { id: 'central', label: 'Central' },
  { id: 'action', label: 'Action' },
] as const;
export type ToggleableColumnId = (typeof TOGGLEABLE_COLUMNS)[number]['id'];

/** Sortable columns and the API sort key each maps to. Contact Email has no API sort key. */
export const SORT_KEYS = {
  client: 'name',
  segment: 'segment',
  health: 'health_score',
  aml: 'aml_status',
} as const satisfies Record<string, ClientSort>;

export const DEFAULT_SORT: ClientSort = 'name';

export const EMPTY_FILTERS: ClientFilters = {
  status: [],
  segment: [],
  client_type: [],
  aml_status: [],
  accounting_software: [],
  service_id: null,
  manager_user_id: null,
  partner_user_id: null,
  central: null,
};

/** Number of filter values set, for the Filter button badge. */
export function countFilters(filters: ClientFilters): number {
  return (
    filters.status.length +
    filters.segment.length +
    filters.client_type.length +
    filters.aml_status.length +
    filters.accounting_software.length +
    (filters.service_id ? 1 : 0) +
    (filters.manager_user_id ? 1 : 0) +
    (filters.partner_user_id ? 1 : 0) +
    (filters.central ? 1 : 0)
  );
}

/** "Drafts" are prospects. */
export const DRAFT_FILTERS: ClientFilters = { ...EMPTY_FILTERS, status: ['prospect'] };

export function isDraftsView(filters: ClientFilters): boolean {
  return (
    filters.status.length === 1 && filters.status[0] === 'prospect' && countFilters(filters) === 1
  );
}

/** The header row of the CSV template offered in the import dialog (`client_import.py`). */
export const IMPORT_TEMPLATE_COLUMNS = [
  'code',
  'name',
  'client_type',
  'status',
  'email',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'postcode',
  'country',
  'company_number',
  'utr',
  'vat_number',
  'year_end',
  'payment_terms_days',
  'segment',
  'aml_status',
  'health_score',
  'accounting_software',
  'contact_name',
  'contact_email',
  'contact_phone',
  'contact_position',
  'services',
  'manager_email',
  'partner_email',
  'notes',
] as const;

export const IMPORT_TEMPLATE_EXAMPLE: Record<(typeof IMPORT_TEMPLATE_COLUMNS)[number], string> = {
  code: '',
  name: 'Techwave Innovations Ltd',
  client_type: 'limited_company',
  status: 'active',
  email: 'accounts@techwave.example',
  phone: '020 7946 0000',
  address_line1: '1 High Street',
  address_line2: '',
  city: 'London',
  postcode: 'EC1A 1AA',
  country: 'GB',
  company_number: '01234567',
  utr: '',
  vat_number: '',
  year_end: '31/03',
  payment_terms_days: '30',
  segment: 'Gold',
  aml_status: 'clear',
  health_score: '80',
  accounting_software: 'xero',
  contact_name: 'Jane Doe',
  contact_email: 'jane@techwave.example',
  contact_phone: '',
  contact_position: 'Director',
  services: '',
  manager_email: '',
  partner_email: '',
  notes: '',
};

/** Rows fetched per page of the client list. */
export const CLIENT_PAGE_SIZE = 50;
