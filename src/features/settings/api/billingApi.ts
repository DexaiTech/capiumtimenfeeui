import { api } from '@/services/api';

import type {
  DeleteOutcome,
  InvoiceTemplate,
  InvoiceTemplateCreate,
  InvoiceTemplateUpdate,
  Sequence,
  SequenceUpdate,
  VatRate,
  VatRateCreate,
  VatRateUpdate,
} from '../billingTypes';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const id = encodeURIComponent;

/** Typed wrappers over the VAT-rate, number-sequence and invoice-template endpoints. */
export const billingApi = {
  // Bounded lists: the API returns every row at once. Archived VAT rates come last.
  listVatRates: (organizationId: string, signal?: AbortSignal) =>
    api.get<VatRate[]>(`${org(organizationId)}/vat-rates`, {
      query: { include_archived: true },
      signal,
    }),
  createVatRate: (organizationId: string, body: VatRateCreate) =>
    api.post<VatRate>(`${org(organizationId)}/vat-rates`, body),
  updateVatRate: (organizationId: string, rateId: string, body: VatRateUpdate) =>
    api.patch<VatRate>(`${org(organizationId)}/vat-rates/${id(rateId)}`, body),
  deleteVatRate: (organizationId: string, rateId: string) =>
    api.delete<DeleteOutcome>(`${org(organizationId)}/vat-rates/${id(rateId)}`),

  listSequences: (organizationId: string, signal?: AbortSignal) =>
    api.get<Sequence[]>(`${org(organizationId)}/sequences`, { signal }),
  updateSequence: (organizationId: string, kind: string, body: SequenceUpdate) =>
    api.patch<Sequence>(`${org(organizationId)}/sequences/${id(kind)}`, body),

  /** `include_inactive` needs `settings.manage`: the API answers 403 to anyone else. */
  listInvoiceTemplates: (organizationId: string, includeInactive: boolean, signal?: AbortSignal) =>
    api.get<InvoiceTemplate[]>(`${org(organizationId)}/invoice-templates`, {
      query: { include_inactive: includeInactive ? true : undefined },
      signal,
    }),
  createInvoiceTemplate: (organizationId: string, body: InvoiceTemplateCreate) =>
    api.post<InvoiceTemplate>(`${org(organizationId)}/invoice-templates`, body),
  updateInvoiceTemplate: (
    organizationId: string,
    templateId: string,
    body: InvoiceTemplateUpdate,
  ) =>
    api.patch<InvoiceTemplate>(`${org(organizationId)}/invoice-templates/${id(templateId)}`, body),
  deleteInvoiceTemplate: (organizationId: string, templateId: string) =>
    api.delete<null>(`${org(organizationId)}/invoice-templates/${id(templateId)}`),
  makeDefaultInvoiceTemplate: (organizationId: string, templateId: string) =>
    api.post<InvoiceTemplate>(
      `${org(organizationId)}/invoice-templates/${id(templateId)}/make-default`,
    ),
};
