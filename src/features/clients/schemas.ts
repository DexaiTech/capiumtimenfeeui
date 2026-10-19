import * as z from 'zod';

import { parsePounds } from '@/utils/money';

import {
  ACCOUNTING_SOFTWARE,
  AML_STATUSES,
  CLIENT_STATUSES,
  CLIENT_TYPES,
  FREQUENCIES,
  type AccountingSoftware,
  type ClientCreate,
  type ClientRead,
  type ClientServiceCreate,
  type ClientServiceRead,
  type ClientUpdate,
  type ContactCreate,
  type ContactRead,
  type Frequency,
} from './types';

/* The rules mirror `app/schemas/clients.py`; the API checks them again. */

export const text = (max: number) => z.string().trim().max(max, `Use at most ${max} characters`);

export const optionalEmail = z
  .string()
  .trim()
  .max(254, 'Use at most 254 characters')
  .refine((value) => value === '' || z.email().safeParse(value).success, {
    message: 'Enter a valid email address',
  });

export const wholeNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' || (/^\d+$/.test(value) && Number(value) >= min && Number(value) <= max),
      message,
    );

export const optionalUuid = z
  .string()
  .refine((value) => value === '' || z.uuid().safeParse(value).success, 'Choose from the list');

export const CODE_PATTERN = /^[A-Za-z0-9_-]{1,20}$/;

/** Days in a month of a leap year, as the API checks the year end (`calendar.monthrange(2024, m)`). */
function daysInMonth(month: number): number {
  return new Date(Date.UTC(2024, month, 0)).getUTCDate();
}

export const clientFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter the client name').max(200, 'Use at most 200 characters'),
    code: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || CODE_PATTERN.test(value),
        "Use 1-20 letters, digits, '_' or '-'",
      ),
    client_type: z.enum(CLIENT_TYPES),
    status: z.enum(CLIENT_STATUSES),
    company_number: text(20),
    utr: text(20),
    vat_number: text(20),
    email: optionalEmail,
    phone: text(40),
    address_line1: text(200),
    address_line2: text(200),
    city: text(100),
    postcode: text(20),
    country: z
      .string()
      .trim()
      .refine((value) => /^[A-Za-z]{2}$/.test(value), 'Use a two-letter country code, e.g. GB'),
    year_end_month: wholeNumber(1, 12, 'Choose a month'),
    year_end_day: wholeNumber(1, 31, 'Enter a day from 1 to 31'),
    segment: text(40),
    aml_status: z.enum(AML_STATUSES),
    health_score: wholeNumber(0, 100, 'Enter a whole number from 0 to 100'),
    accounting_software: z.union([z.literal(''), z.enum(ACCOUNTING_SOFTWARE)]),
    manager_user_id: optionalUuid,
    partner_user_id: optionalUuid,
    payment_terms_days: wholeNumber(0, 365, 'Enter a number of days from 0 to 365'),
    notes: text(5000),
    billing_notes: text(2000),
  })
  .superRefine((values, ctx) => {
    const month = values.year_end_month;
    const day = values.year_end_day;
    if ((month === '') !== (day === '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['year_end_day'],
        message: 'Give both the year-end month and day, or neither',
      });
    } else if (month !== '' && day !== '' && Number(day) > daysInMonth(Number(month))) {
      ctx.addIssue({
        code: 'custom',
        path: ['year_end_day'],
        message: 'This day does not exist in that month',
      });
    }
  });

export type ClientFormValues = z.input<typeof clientFormSchema>;

/** Every field the form owns: 422 details for these paths land on the field. */
export const CLIENT_FORM_FIELDS = [
  'name',
  'code',
  'client_type',
  'status',
  'company_number',
  'utr',
  'vat_number',
  'email',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'postcode',
  'country',
  'year_end_month',
  'year_end_day',
  'segment',
  'aml_status',
  'health_score',
  'accounting_software',
  'manager_user_id',
  'partner_user_id',
  'payment_terms_days',
  'notes',
  'billing_notes',
] as const satisfies ReadonlyArray<keyof ClientFormValues>;

export function isClientFormField(name: string): name is (typeof CLIENT_FORM_FIELDS)[number] {
  return (CLIENT_FORM_FIELDS as readonly string[]).includes(name);
}

export const EMPTY_CLIENT_FORM: ClientFormValues = {
  name: '',
  code: '',
  client_type: 'limited_company',
  status: 'active',
  company_number: '',
  utr: '',
  vat_number: '',
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postcode: '',
  country: 'GB',
  year_end_month: '',
  year_end_day: '',
  segment: '',
  aml_status: 'not_started',
  health_score: '',
  accounting_software: '',
  manager_user_id: '',
  partner_user_id: '',
  payment_terms_days: '',
  notes: '',
  billing_notes: '',
};

const asEnum = <T extends string>(values: readonly T[], value: string, fallback: T): T =>
  (values as readonly string[]).includes(value) ? (value as T) : fallback;

/** A client as the form shows it. */
export function clientToForm(client: ClientRead): ClientFormValues {
  const str = (value: string | number | null) => (value === null ? '' : String(value));
  return {
    name: client.name,
    code: client.code,
    client_type: asEnum(CLIENT_TYPES, client.client_type, 'other'),
    status: asEnum(CLIENT_STATUSES, client.status, 'active'),
    company_number: str(client.company_number),
    utr: str(client.utr),
    vat_number: str(client.vat_number),
    email: str(client.email),
    phone: str(client.phone),
    address_line1: str(client.address_line1),
    address_line2: str(client.address_line2),
    city: str(client.city),
    postcode: str(client.postcode),
    country: client.country,
    year_end_month: str(client.year_end_month),
    year_end_day: str(client.year_end_day),
    segment: str(client.segment),
    aml_status: asEnum(AML_STATUSES, client.aml_status, 'not_started'),
    health_score: str(client.health_score),
    accounting_software: client.accounting_software
      ? asEnum<AccountingSoftware>(ACCOUNTING_SOFTWARE, client.accounting_software, 'other')
      : '',
    manager_user_id: str(client.manager_user_id),
    partner_user_id: str(client.partner_user_id),
    payment_terms_days: str(client.payment_terms_days),
    notes: str(client.notes),
    billing_notes: str(client.billing_notes),
  };
}

export const orNull = (value: string) => (value.trim() === '' ? null : value.trim());
export const intOrNull = (value: string) => (value.trim() === '' ? null : Number(value.trim()));

/** The fields both create and update send (blank text is null). */
function commonPayload(values: ClientFormValues) {
  return {
    name: values.name.trim(),
    client_type: values.client_type,
    status: values.status,
    company_number: orNull(values.company_number),
    utr: orNull(values.utr),
    vat_number: orNull(values.vat_number),
    email: orNull(values.email),
    phone: orNull(values.phone),
    address_line1: orNull(values.address_line1),
    address_line2: orNull(values.address_line2),
    city: orNull(values.city),
    postcode: orNull(values.postcode),
    country: values.country.trim().toUpperCase(),
    year_end_month: intOrNull(values.year_end_month),
    year_end_day: intOrNull(values.year_end_day),
    segment: orNull(values.segment),
    aml_status: values.aml_status,
    health_score: intOrNull(values.health_score),
    accounting_software: values.accounting_software === '' ? null : values.accounting_software,
    manager_user_id: orNull(values.manager_user_id),
    partner_user_id: orNull(values.partner_user_id),
    payment_terms_days: intOrNull(values.payment_terms_days),
    notes: orNull(values.notes),
    billing_notes: orNull(values.billing_notes),
  };
}

export function toClientCreate(values: ClientFormValues): ClientCreate {
  const code = orNull(values.code);
  return { ...commonPayload(values), ...(code ? { code: code.toUpperCase() } : {}) };
}

/** PATCH body. `code` cannot be null, so a cleared code is left unchanged. */
export function toClientUpdate(values: ClientFormValues): ClientUpdate {
  const code = orNull(values.code);
  return { ...commonPayload(values), ...(code ? { code: code.toUpperCase() } : {}) };
}

/* ---------------------------------- Contacts ---------------------------------- */

export const contactFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter the contact name').max(120, 'Use at most 120 characters'),
  position: text(120),
  email: optionalEmail,
  phone: text(40),
  is_primary: z.boolean(),
  is_billing: z.boolean(),
});

export type ContactFormValues = z.input<typeof contactFormSchema>;

export const CONTACT_FORM_FIELDS = [
  'name',
  'position',
  'email',
  'phone',
  'is_primary',
  'is_billing',
] as const satisfies ReadonlyArray<keyof ContactFormValues>;

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: '',
  position: '',
  email: '',
  phone: '',
  is_primary: true,
  is_billing: false,
};

export function contactToForm(contact: ContactRead): ContactFormValues {
  return {
    name: contact.name,
    position: contact.position ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    is_primary: contact.is_primary,
    is_billing: contact.is_billing,
  };
}

export function toContactPayload(values: ContactFormValues): ContactCreate {
  return {
    name: values.name.trim(),
    position: orNull(values.position),
    email: orNull(values.email),
    phone: orNull(values.phone),
    is_primary: values.is_primary,
    is_billing: values.is_billing,
  };
}

/* --------------------------------- Engagements --------------------------------- */

const isoDate = z
  .string()
  .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Enter a date');

export const engagementFormSchema = z
  .object({
    service_id: z.string().min(1, 'Choose a service'),
    fee: z
      .string()
      .trim()
      .refine((value) => value === '' || (parsePounds(value) ?? -1) >= 0, {
        message: 'Enter an amount in pounds, for example 1200 or 99.50',
      }),
    frequency: z.enum(FREQUENCIES),
    start_date: isoDate,
    end_date: isoDate,
    is_active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.start_date && values.end_date && values.end_date < values.start_date) {
      ctx.addIssue({
        code: 'custom',
        path: ['end_date'],
        message: 'The end date is before the start date',
      });
    }
  });

export type EngagementFormValues = z.input<typeof engagementFormSchema>;

export const ENGAGEMENT_FORM_FIELDS = [
  'service_id',
  'fee',
  'frequency',
  'start_date',
  'end_date',
  'is_active',
] as const satisfies ReadonlyArray<keyof EngagementFormValues>;

export const EMPTY_ENGAGEMENT_FORM: EngagementFormValues = {
  service_id: '',
  fee: '',
  frequency: 'annually',
  start_date: '',
  end_date: '',
  is_active: true,
};

export function engagementToForm(
  engagement: ClientServiceRead,
  toPounds: (pence: number | null) => string,
): EngagementFormValues {
  return {
    service_id: engagement.service_id,
    fee: toPounds(engagement.fee),
    frequency: asEnum<Frequency>(FREQUENCIES, engagement.frequency, 'annually'),
    start_date: engagement.start_date ?? '',
    end_date: engagement.end_date ?? '',
    is_active: engagement.is_active,
  };
}

/** Pounds typed in the form become whole pence; blank means "the service default". */
export function toEngagementPayload(values: EngagementFormValues): ClientServiceCreate {
  return {
    service_id: values.service_id,
    fee: values.fee.trim() === '' ? null : parsePounds(values.fee),
    frequency: values.frequency,
    start_date: values.start_date || null,
    end_date: values.end_date || null,
    is_active: values.is_active,
  };
}
