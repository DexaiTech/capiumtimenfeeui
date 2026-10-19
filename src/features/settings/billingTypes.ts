/**
 * Shapes of the VAT-rate, number-sequence and invoice-template endpoints
 * (`app/schemas/settings.py`, `app/schemas/invoice_templates.py`) behind Settings → VAT Codes,
 * the three numbering pages and Invoice Templates. Money is pence, VAT rates basis points.
 */
import type { BasisPoints, IsoDateTime } from '@/types/api';

/* --------------------------------- VAT codes --------------------------------- */

/** The five VAT treatments of an invoice line. */
export type VatCodeKind = 'standard' | 'reduced' | 'zero' | 'exempt' | 'outside_scope';

/** A VAT code of the practice (`VatRateRead`); the API calls it a VAT rate. */
export interface VatRate {
  id: string;
  name: string;
  code: VatCodeKind;
  rate_bp: BasisPoints;
  is_default: boolean;
  is_archived: boolean;
  archived_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface VatRateCreate {
  name: string;
  code: VatCodeKind;
  rate_bp: BasisPoints;
  is_default?: boolean;
}

/** PATCH is partial; `is_archived` archives (true) or restores (false). */
export interface VatRateUpdate {
  name?: string;
  code?: VatCodeKind;
  rate_bp?: BasisPoints;
  is_default?: boolean;
  is_archived?: boolean;
}

/** What a DELETE did: removed the record, or kept it archived because something uses it. */
export interface DeleteOutcome {
  outcome: 'deleted' | 'archived' | 'deactivated';
  id: string;
}

/* --------------------------------- Numbering --------------------------------- */

/** The kinds of the numbering pages; `estimate` is only returned once the API has the sequence. */
export type NumberedDocument = 'invoice' | 'credit_note' | 'estimate';

/** One number sequence (`SequenceRead`). */
export interface Sequence {
  kind: string;
  prefix: string;
  /** Zero padding: 5 shows 42 as 00042. */
  padding: number;
  next_number: number;
  /** How the next number will look, for example `INV-00042`. */
  preview: string;
}

export interface SequenceUpdate {
  prefix?: string;
  padding?: number;
  next_number?: number;
}

/* ----------------------------- Invoice templates ----------------------------- */

export type InvoiceLayout = 'standard' | 'detailed' | 'summary';
export type InvoiceTemplateStatus = 'active' | 'inactive';

export interface InvoiceTemplate {
  id: string;
  name: string;
  layout: InvoiceLayout;
  show_logo: boolean;
  show_bank_details: boolean;
  /** Up to 1000 characters; null when there is none. */
  footer_text: string | null;
  /** The template of clients that have not chosen one. */
  is_default: boolean;
  status: InvoiceTemplateStatus;
  /** Live clients of the practice that use the template. */
  client_count: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface InvoiceTemplateCreate {
  name: string;
  layout?: InvoiceLayout;
  show_logo?: boolean;
  show_bank_details?: boolean;
  footer_text?: string | null;
  is_default?: boolean;
  status?: InvoiceTemplateStatus;
}

/** PATCH is partial; `is_default` is changed with the make-default action. */
export interface InvoiceTemplateUpdate {
  name?: string;
  layout?: InvoiceLayout;
  show_logo?: boolean;
  show_bank_details?: boolean;
  footer_text?: string | null;
  status?: InvoiceTemplateStatus;
}
