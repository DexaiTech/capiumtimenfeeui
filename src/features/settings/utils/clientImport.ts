import { downloadText, toCsv } from '@/utils/csv';

/** The header row of the client import template (`client_import.py` of the API maps these by name). */
export const CLIENT_IMPORT_COLUMNS = [
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

type Column = (typeof CLIENT_IMPORT_COLUMNS)[number];

const EXAMPLE: Partial<Record<Column, string>> = {
  name: 'Techwave Innovations Ltd',
  client_type: 'limited_company',
  status: 'active',
  email: 'accounts@techwave.example',
  phone: '020 7946 0000',
  address_line1: '1 High Street',
  city: 'London',
  postcode: 'EC1A 1AA',
  country: 'GB',
  company_number: '01234567',
  year_end: '31/03',
  payment_terms_days: '30',
  contact_name: 'Jane Doe',
  contact_email: 'jane@techwave.example',
  contact_position: 'Director',
};

/** The CSV template: the header row and one example client. */
export function downloadClientTemplate() {
  downloadText(
    'clients-import-template.csv',
    toCsv([
      [...CLIENT_IMPORT_COLUMNS],
      CLIENT_IMPORT_COLUMNS.map((column) => EXAMPLE[column] ?? ''),
    ]),
  );
}
