import * as z from 'zod';

import { parsePounds, penceToPoundsInput } from '@/utils/money';

import { intOrNull, optionalEmail, optionalUuid, orNull, text, wholeNumber } from '../../schemas';
import type {
  ClientDetail,
  ClientRateCreate,
  ClientRateRead,
  ClientUpdate,
  ContactRead,
} from '../../types';

/** The keys whose value differs: a PATCH sends only what the person changed. */
export function changedFields<TValues extends object>(
  next: TValues,
  previous: TValues,
): Partial<TValues> {
  const changes: Partial<TValues> = {};
  for (const key of Object.keys(next) as Array<keyof TValues>) {
    if (next[key] !== previous[key]) changes[key] = next[key];
  }
  return changes;
}

/* ----------------------------------- Billing ----------------------------------- */

export const billingFormSchema = z.object({
  invoice_email: optionalEmail,
  /** The contact flagged `is_billing`; blank: none. */
  billing_contact_id: z.string(),
  payment_terms_days: wholeNumber(0, 365, 'Enter a number of days from 0 to 365'),
  default_vat_rate_id: optionalUuid,
  default_service_id: optionalUuid,
  invoice_template_id: optionalUuid,
  billing_notes: text(2000),
});

export type BillingFormValues = z.input<typeof billingFormSchema>;

export const BILLING_FORM_FIELDS = [
  'invoice_email',
  'billing_contact_id',
  'payment_terms_days',
  'default_vat_rate_id',
  'default_service_id',
  'invoice_template_id',
  'billing_notes',
] as const satisfies ReadonlyArray<keyof BillingFormValues>;

export function billingToForm(client: ClientDetail): BillingFormValues {
  return {
    invoice_email: client.invoice_email ?? '',
    billing_contact_id: client.contacts.find((contact) => contact.is_billing)?.id ?? '',
    payment_terms_days: client.payment_terms_days === null ? '' : String(client.payment_terms_days),
    default_vat_rate_id: client.default_vat_rate_id ?? '',
    default_service_id: client.default_service_id ?? '',
    invoice_template_id: client.invoice_template_id ?? '',
    billing_notes: client.billing_notes ?? '',
  };
}

/** The client fields of the billing form, as the API holds them (blank is null). */
function billingFields(values: BillingFormValues) {
  return {
    invoice_email: orNull(values.invoice_email),
    payment_terms_days: intOrNull(values.payment_terms_days),
    default_vat_rate_id: orNull(values.default_vat_rate_id),
    default_service_id: orNull(values.default_service_id),
    invoice_template_id: orNull(values.invoice_template_id),
    billing_notes: orNull(values.billing_notes),
  };
}

/** The `PATCH /clients/{id}` body of the billing card: only the fields that changed. */
export function toBillingPatch(values: BillingFormValues, client: ClientDetail): ClientUpdate {
  return changedFields(billingFields(values), billingFields(billingToForm(client)));
}

export interface BillingFlagChange {
  contactId: string;
  is_billing: boolean;
}

/**
 * The contact endpoint calls that make `chosenId` the billing contact: it is flagged first, then
 * the flag is taken off the others, so a failure in between never leaves the client with none.
 * Nothing when the choice did not change.
 */
export function billingFlagChanges(
  chosenId: string,
  contacts: ReadonlyArray<ContactRead>,
  initialId: string,
): BillingFlagChange[] {
  if (chosenId === initialId) return [];
  const changes: BillingFlagChange[] = [];
  const chosen = contacts.find((contact) => contact.id === chosenId);
  if (chosen && !chosen.is_billing) changes.push({ contactId: chosen.id, is_billing: true });
  for (const contact of contacts) {
    if (contact.is_billing && contact.id !== chosenId) {
      changes.push({ contactId: contact.id, is_billing: false });
    }
  }
  return changes;
}

/* ------------------------------------- Team ------------------------------------- */

export const teamFormSchema = z.object({
  partner_user_id: optionalUuid,
  manager_user_id: optionalUuid,
});

export type TeamFormValues = z.input<typeof teamFormSchema>;

export const TEAM_FORM_FIELDS = [
  'partner_user_id',
  'manager_user_id',
] as const satisfies ReadonlyArray<keyof TeamFormValues>;

export function teamToForm(client: ClientDetail): TeamFormValues {
  return {
    partner_user_id: client.partner_user_id ?? '',
    manager_user_id: client.manager_user_id ?? '',
  };
}

const teamFields = (values: TeamFormValues) => ({
  partner_user_id: orNull(values.partner_user_id),
  manager_user_id: orNull(values.manager_user_id),
});

export function toTeamPatch(values: TeamFormValues, client: ClientDetail): ClientUpdate {
  return changedFields(teamFields(values), teamFields(teamToForm(client)));
}

/* -------------------------------- Client rate overrides -------------------------------- */

const isoDate = z
  .string()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Enter a date');

const hourlyRate = z
  .string()
  .trim()
  .refine((value) => {
    const pence = parsePounds(value);
    return value !== '' && pence !== null && pence >= 0;
  }, 'Enter an hourly rate in pounds, for example 95 or 120.50');

export const clientRateFormSchema = z
  .object({
    /** Blank: everyone working for the client. */
    user_id: optionalUuid,
    hourly_rate: hourlyRate,
    effective_from: isoDate,
    effective_to: isoDate,
  })
  .superRefine((values, ctx) => {
    if (
      values.effective_from &&
      values.effective_to &&
      values.effective_to < values.effective_from
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['effective_to'],
        message: 'The end date is before the start date',
      });
    }
  });

export type ClientRateFormValues = z.input<typeof clientRateFormSchema>;

export const CLIENT_RATE_FORM_FIELDS = [
  'user_id',
  'hourly_rate',
  'effective_from',
  'effective_to',
] as const satisfies ReadonlyArray<keyof ClientRateFormValues>;

export const EMPTY_CLIENT_RATE_FORM: ClientRateFormValues = {
  user_id: '',
  hourly_rate: '',
  effective_from: '',
  effective_to: '',
};

export function clientRateToForm(rate: ClientRateRead): ClientRateFormValues {
  return {
    user_id: rate.user_id ?? '',
    hourly_rate: penceToPoundsInput(rate.hourly_rate),
    effective_from: rate.effective_from,
    effective_to: rate.effective_to ?? '',
  };
}

/** The `POST /clients/{id}/rates` body; the period is left out when blank (every day, open-ended). */
export function toClientRateCreate(values: ClientRateFormValues): ClientRateCreate {
  return {
    user_id: orNull(values.user_id),
    hourly_rate: parsePounds(values.hourly_rate) ?? 0,
    ...(values.effective_from ? { effective_from: values.effective_from } : {}),
    ...(values.effective_to ? { effective_to: values.effective_to } : {}),
  };
}

/** The end-date dialog: one required date. */
export const rateEndFormSchema = z.object({
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the last day of the rate'),
});

export type RateEndFormValues = z.input<typeof rateEndFormSchema>;
