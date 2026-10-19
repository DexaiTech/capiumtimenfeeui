import type { InvoiceTemplate, Sequence, VatRate } from '../billingTypes';

const CREATED = '2026-10-01T09:00:00Z';

const vatRate = (
  id: string,
  name: string,
  code: VatRate['code'],
  rateBp: number,
  overrides: Partial<VatRate> = {},
): VatRate => ({
  id,
  name,
  code,
  rate_bp: rateBp,
  is_default: false,
  is_archived: false,
  archived_at: null,
  created_at: CREATED,
  updated_at: CREATED,
  ...overrides,
});

export const standardVat = vatRate('vat-standard', 'Standard 20%', 'standard', 2000, {
  is_default: true,
});
export const reducedVat = vatRate('vat-reduced', 'Reduced 5%', 'reduced', 500);
export const zeroVat = vatRate('vat-zero', 'Zero rated', 'zero', 0);
export const exemptVat = vatRate('vat-exempt', 'Exempt', 'exempt', 0);
export const outsideVat = vatRate('vat-outside', 'Outside the scope', 'outside_scope', 0);
export const archivedVat = vatRate('vat-old', 'Old 17.5%', 'standard', 1750, {
  is_archived: true,
  archived_at: '2026-01-01T00:00:00Z',
});

/** As the API lists them: highest rate first, archived last. */
export const testVatRates: VatRate[] = [
  standardVat,
  reducedVat,
  zeroVat,
  exemptVat,
  outsideVat,
  archivedVat,
];

const sequence = (
  kind: string,
  prefix: string,
  padding: number,
  nextNumber: number,
  preview: string,
): Sequence => ({ kind, prefix, padding, next_number: nextNumber, preview });

export const clientSequence = sequence('client', 'C', 4, 12, 'C0012');
export const creditNoteSequence = sequence('credit_note', 'CN-', 5, 7, 'CN-00007');
export const invoiceSequence = sequence('invoice', 'INV-', 5, 42, 'INV-00042');
export const jobSequence = sequence('job', 'J', 5, 19, 'J00019');
export const staffSequence = sequence('staff', 'S', 3, 8, 'S008');
export const ticketSequence = sequence('ticket', 'APT', 1, 63, 'APT63');
export const estimateSequence = sequence('estimate', 'EST-', 5, 3, 'EST-00003');

/** The six kinds `GET /sequences` returns today (the API has no estimate kind yet). */
export const testSequences: Sequence[] = [
  clientSequence,
  creditNoteSequence,
  invoiceSequence,
  jobSequence,
  staffSequence,
  ticketSequence,
];

const template = (
  id: string,
  name: string,
  overrides: Partial<InvoiceTemplate> = {},
): InvoiceTemplate => ({
  id,
  name,
  layout: 'standard',
  show_logo: true,
  show_bank_details: true,
  footer_text: null,
  is_default: false,
  status: 'active',
  client_count: 0,
  created_at: CREATED,
  updated_at: CREATED,
  ...overrides,
});

export const standardTemplate = template('tpl-standard', 'Standard', {
  is_default: true,
  client_count: 4,
});
export const detailedTemplate = template('tpl-detailed', 'Detailed time sheets', {
  layout: 'detailed',
  show_bank_details: false,
  footer_text: 'Registered in England and Wales, company number 01234567.',
  client_count: 2,
});
export const summaryTemplate = template('tpl-summary', 'Summary by job', {
  layout: 'summary',
  show_logo: false,
});
export const retiredTemplate = template('tpl-retired', 'Retired layout', {
  layout: 'summary',
  status: 'inactive',
});

export const testTemplates: InvoiceTemplate[] = [
  standardTemplate,
  detailedTemplate,
  summaryTemplate,
  retiredTemplate,
];
