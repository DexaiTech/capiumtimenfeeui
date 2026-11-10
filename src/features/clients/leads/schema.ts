import * as z from 'zod';

import { parsePounds } from '@/utils/money';

import { optionalEmail, text } from '../schemas';
import { CLIENT_TYPES } from '../types';
import type { Lead, LeadCreate } from './types';

/* The rules mirror `app/schemas/leads.py`; the API checks them again. */

/**
 * An amount in the practice currency: blank is nothing spent (0), otherwise 0 or more with at
 * most the currency's decimals.
 */
const cost = (currency: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || (parsePounds(value, currency) ?? -1) >= 0, {
      message: 'Enter an amount in pounds, for example 250 or 99.50',
    });

/** Add or change a lead; the costs are read in the practice currency. */
export function leadFormSchema(currency: string) {
  return z.object({
    name: z.string().trim().min(1, 'Enter the lead name').max(200, 'Use at most 200 characters'),
    client_type: z.enum(CLIENT_TYPES),
    contact_name: text(120),
    email: optionalEmail,
    phone: text(40),
    source: text(100),
    notes: text(5000),
    acquisition_cost: cost(currency),
    onboarding_cost: cost(currency),
  });
}

export type LeadFormValues = z.input<ReturnType<typeof leadFormSchema>>;

export const LEAD_FORM_FIELDS = [
  'name',
  'client_type',
  'contact_name',
  'email',
  'phone',
  'source',
  'notes',
  'acquisition_cost',
  'onboarding_cost',
] as const satisfies ReadonlyArray<keyof LeadFormValues>;

export const EMPTY_LEAD_FORM: LeadFormValues = {
  name: '',
  client_type: 'limited_company',
  contact_name: '',
  email: '',
  phone: '',
  source: '',
  notes: '',
  acquisition_cost: '',
  onboarding_cost: '',
};

export function leadToForm(lead: Lead, toPounds: (pence: number) => string): LeadFormValues {
  return {
    name: lead.name,
    client_type: lead.client_type,
    contact_name: lead.contact_name ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    source: lead.source ?? '',
    notes: lead.notes ?? '',
    acquisition_cost: toPounds(lead.acquisition_cost),
    onboarding_cost: toPounds(lead.onboarding_cost),
  };
}

const orNull = (value: string) => value.trim() || null;
const toPence = (value: string, currency: string) =>
  value.trim() === '' ? 0 : (parsePounds(value, currency) ?? 0);

/** The form as the API takes it: blank text is null, amounts become whole minor units. */
export function toLeadPayload(values: LeadFormValues, currency: string): Required<LeadCreate> {
  return {
    name: values.name.trim(),
    client_type: values.client_type,
    contact_name: orNull(values.contact_name),
    email: orNull(values.email),
    phone: orNull(values.phone),
    source: orNull(values.source),
    notes: orNull(values.notes),
    acquisition_cost: toPence(values.acquisition_cost, currency),
    onboarding_cost: toPence(values.onboarding_cost, currency),
  };
}
