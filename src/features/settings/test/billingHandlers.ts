import { http, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type {
  InvoiceTemplate,
  InvoiceTemplateCreate,
  InvoiceTemplateUpdate,
  Sequence,
  SequenceUpdate,
  VatRate,
  VatRateCreate,
  VatRateUpdate,
} from '../billingTypes';
import { testSequences, testTemplates, testVatRates } from './billingFixtures';

export { orgApiPath };

/** The requests the fake API has seen, for assertions on exact bodies and counts. */
export interface BillingCalls {
  vatLists: URLSearchParams[];
  vatCreates: VatRateCreate[];
  vatUpdates: Array<{ id: string; body: VatRateUpdate }>;
  vatDeletes: string[];
  sequenceLists: number;
  sequenceUpdates: Array<{ kind: string; body: SequenceUpdate }>;
  templateLists: URLSearchParams[];
  templateCreates: InvoiceTemplateCreate[];
  templateUpdates: Array<{ id: string; body: InvoiceTemplateUpdate }>;
  templateDeletes: string[];
  templateDefaults: string[];
}

/** An in-memory stand-in for the VAT-rate, sequence and invoice-template endpoints. */
export interface BillingBackend {
  vatRates: VatRate[];
  /** Ids of VAT codes something uses: deleting one archives it. */
  usedVatRates: Set<string>;
  sequences: Sequence[];
  /** Numbers of documents that exist, per kind: a next number that formats to one is refused. */
  usedNumbers: Record<string, string[]>;
  templates: InvoiceTemplate[];
  /** Holds settings.manage: only then may inactive templates be listed. */
  manager: boolean;
  calls: BillingCalls;
}

export function createBillingBackend(
  initial: Partial<Omit<BillingBackend, 'calls'>> = {},
): BillingBackend {
  return {
    vatRates: testVatRates.map((rate) => ({ ...rate })),
    usedVatRates: new Set(),
    sequences: testSequences.map((entry) => ({ ...entry })),
    usedNumbers: {},
    templates: testTemplates.map((entry) => ({ ...entry })),
    manager: true,
    ...initial,
    calls: {
      vatLists: [],
      vatCreates: [],
      vatUpdates: [],
      vatDeletes: [],
      sequenceLists: 0,
      sequenceUpdates: [],
      templateLists: [],
      templateCreates: [],
      templateUpdates: [],
      templateDeletes: [],
      templateDefaults: [],
    },
  };
}

const NOW = '2026-10-18T10:00:00Z';
const FORWARD_ONLY = new Set(['invoice', 'credit_note', 'estimate']);
const format = (prefix: string, number: number, padding: number) =>
  `${prefix}${String(number).padStart(padding, '0')}`;

const nameTaken = (code: string, message: string) =>
  fail(409, code, message, { details: [{ field: 'name', code: 'duplicate', message }] });

const invalid = (field: string, message: string) =>
  fail(422, 'VALIDATION_ERROR', 'Some fields are invalid.', {
    details: [{ field, code: 'invalid', message }],
  });

const sameName = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

/** Handlers for every endpoint of the three pages, backed by `backend` and following the API's rules. */
export function billingHandlers(backend: BillingBackend): HttpHandler[] {
  const { calls } = backend;
  let counter = 0;
  const newId = (prefix: string) => `${prefix}-new-${(counter += 1)}`;

  const rateById = (id: unknown) => backend.vatRates.find((rate) => rate.id === id);
  const templateById = (id: unknown) => backend.templates.find((entry) => entry.id === id);
  const vatNameTaken = (name: string, exceptId?: string) =>
    backend.vatRates.some(
      (rate) => !rate.is_archived && rate.id !== exceptId && sameName(rate.name, name),
    );
  const templateNameTaken = (name: string, exceptId?: string) =>
    backend.templates.some((entry) => entry.id !== exceptId && sameName(entry.name, name));

  return [
    /* ------------------------------- VAT codes ------------------------------- */
    http.get(orgApiPath('/vat-rates'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.vatLists.push(params);
      const withArchived = params.get('include_archived') === 'true';
      return ok(backend.vatRates.filter((rate) => withArchived || !rate.is_archived));
    }),
    http.post(orgApiPath('/vat-rates'), async ({ request }) => {
      const body = (await request.json()) as VatRateCreate;
      calls.vatCreates.push(body);
      if (vatNameTaken(body.name)) {
        return nameTaken('VAT_RATE_NAME_TAKEN', 'A VAT rate with this name exists.');
      }
      if (body.is_default) backend.vatRates.forEach((rate) => (rate.is_default = false));
      const created: VatRate = {
        id: newId('vat'),
        name: body.name,
        code: body.code,
        rate_bp: body.rate_bp,
        is_default: body.is_default ?? false,
        is_archived: false,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      };
      backend.vatRates.splice(
        backend.vatRates.findIndex((rate) => rate.is_archived) === -1
          ? backend.vatRates.length
          : backend.vatRates.findIndex((rate) => rate.is_archived),
        0,
        created,
      );
      return ok(created, { status: 201, message: 'VAT rate created' });
    }),
    http.patch(orgApiPath('/vat-rates/:id'), async ({ params, request }) => {
      const body = (await request.json()) as VatRateUpdate;
      calls.vatUpdates.push({ id: String(params.id), body });
      const rate = rateById(params.id);
      if (!rate) return fail(404, 'RESOURCE_NOT_FOUND', 'VAT rate not found.');
      const archived = body.is_archived ?? rate.is_archived;
      if (body.is_default && archived) {
        return invalid('is_default', 'An archived VAT rate cannot be the default.');
      }
      if (!archived && body.name !== undefined && vatNameTaken(body.name, rate.id)) {
        return nameTaken('VAT_RATE_NAME_TAKEN', 'A VAT rate with this name exists.');
      }
      if (body.name !== undefined) rate.name = body.name;
      if (body.code !== undefined) rate.code = body.code;
      if (body.rate_bp !== undefined) rate.rate_bp = body.rate_bp;
      if (body.is_archived !== undefined) {
        rate.is_archived = body.is_archived;
        rate.archived_at = body.is_archived ? NOW : null;
      }
      if (rate.is_archived) rate.is_default = false;
      if (body.is_default === true) {
        backend.vatRates.forEach((entry) => (entry.is_default = false));
        rate.is_default = true;
      } else if (body.is_default === false) {
        rate.is_default = false;
      }
      return ok(rate, { message: 'VAT rate updated' });
    }),
    http.delete(orgApiPath('/vat-rates/:id'), ({ params }) => {
      calls.vatDeletes.push(String(params.id));
      const rate = rateById(params.id);
      if (!rate) return fail(404, 'RESOURCE_NOT_FOUND', 'VAT rate not found.');
      if (backend.usedVatRates.has(rate.id)) {
        rate.is_archived = true;
        rate.archived_at = NOW;
        rate.is_default = false;
        return ok(
          { outcome: 'archived', id: rate.id },
          { message: 'VAT rate is in use, so it was archived' },
        );
      }
      backend.vatRates = backend.vatRates.filter((entry) => entry.id !== rate.id);
      return ok({ outcome: 'deleted', id: rate.id }, { message: 'VAT rate deleted' });
    }),

    /* -------------------------------- Numbering ------------------------------- */
    http.get(orgApiPath('/sequences'), () => {
      calls.sequenceLists += 1;
      return ok(backend.sequences);
    }),
    http.patch(orgApiPath('/sequences/:kind'), async ({ params, request }) => {
      const kind = String(params.kind);
      const body = (await request.json()) as SequenceUpdate;
      calls.sequenceUpdates.push({ kind, body });
      const sequence = backend.sequences.find((entry) => entry.kind === kind);
      if (!sequence) return invalid('kind', 'Unknown sequence kind.');
      const next = body.next_number ?? sequence.next_number;
      if (FORWARD_ONLY.has(kind) && next < sequence.next_number) {
        return fail(
          409,
          'SEQUENCE_BACKWARDS',
          'Invoice, credit note and ticket numbers can only move forward.',
          { details: { current_next_number: sequence.next_number } },
        );
      }
      const prefix = body.prefix ?? sequence.prefix;
      const padding = body.padding ?? sequence.padding;
      const preview = format(prefix, next, padding);
      if ((backend.usedNumbers[kind] ?? []).includes(preview)) {
        return fail(409, 'SEQUENCE_NUMBER_TAKEN', `The number ${preview} is already used.`, {
          details: { preview },
        });
      }
      Object.assign(sequence, { prefix, padding, next_number: next, preview });
      return ok(sequence, { message: 'Numbering updated' });
    }),

    /* ---------------------------- Invoice templates --------------------------- */
    http.get(orgApiPath('/invoice-templates'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.templateLists.push(params);
      const withInactive = params.get('include_inactive') === 'true';
      if (withInactive && !backend.manager) {
        return fail(403, 'PERMISSION_DENIED', 'You do not have permission to do that.');
      }
      return ok(backend.templates.filter((entry) => withInactive || entry.status === 'active'));
    }),
    http.post(orgApiPath('/invoice-templates'), async ({ request }) => {
      const body = (await request.json()) as InvoiceTemplateCreate;
      calls.templateCreates.push(body);
      if (templateNameTaken(body.name)) {
        return nameTaken('TEMPLATE_NAME_TAKEN', 'A template with this name already exists.');
      }
      const created: InvoiceTemplate = {
        id: newId('tpl'),
        name: body.name,
        layout: body.layout ?? 'standard',
        show_logo: body.show_logo ?? true,
        show_bank_details: body.show_bank_details ?? true,
        footer_text: body.footer_text ?? null,
        is_default: false,
        status: body.status ?? 'active',
        client_count: 0,
        created_at: NOW,
        updated_at: NOW,
      };
      backend.templates.push(created);
      return ok(created, { status: 201, message: 'Invoice template created' });
    }),
    http.patch(orgApiPath('/invoice-templates/:id'), async ({ params, request }) => {
      const body = (await request.json()) as InvoiceTemplateUpdate;
      calls.templateUpdates.push({ id: String(params.id), body });
      const found = templateById(params.id);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Invoice template not found.');
      if (body.status === 'inactive' && found.is_default) {
        return fail(
          409,
          'TEMPLATE_IS_DEFAULT',
          'The default template cannot be deactivated: make another template the default first.',
        );
      }
      if (body.name !== undefined && templateNameTaken(body.name, found.id)) {
        return nameTaken('TEMPLATE_NAME_TAKEN', 'A template with this name already exists.');
      }
      Object.assign(found, body, { updated_at: NOW });
      return ok(found, { message: 'Invoice template updated' });
    }),
    http.delete(orgApiPath('/invoice-templates/:id'), ({ params }) => {
      calls.templateDeletes.push(String(params.id));
      const found = templateById(params.id);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Invoice template not found.');
      if (found.is_default) {
        return fail(
          409,
          'TEMPLATE_IS_DEFAULT',
          'The default template cannot be deleted: make another template the default first.',
        );
      }
      if (found.client_count > 0) {
        return fail(
          409,
          'TEMPLATE_IN_USE',
          'Clients use this template: deactivate it instead of deleting it.',
          { details: { clients: found.client_count } },
        );
      }
      backend.templates = backend.templates.filter((entry) => entry.id !== found.id);
      return ok(null, { message: 'Invoice template deleted' });
    }),
    http.post(orgApiPath('/invoice-templates/:id/make-default'), ({ params }) => {
      calls.templateDefaults.push(String(params.id));
      const found = templateById(params.id);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Invoice template not found.');
      if (found.status !== 'active') {
        return fail(409, 'TEMPLATE_INACTIVE', 'An inactive template cannot be the default.');
      }
      backend.templates.forEach((entry) => (entry.is_default = false));
      found.is_default = true;
      return ok(found, { message: 'Default template changed' });
    }),
  ];
}
