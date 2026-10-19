import { describe, expect, it } from 'vitest';

import { techwaveDetail } from '../../test/fixtures';
import { ADA_ID, GRACE_ID } from '../../test/workspaceFixtures';
import type { ClientDetail, ClientRateRead, ContactRead } from '../../types';
import {
  billingFlagChanges,
  billingFormSchema,
  billingToForm,
  changedFields,
  clientRateFormSchema,
  clientRateToForm,
  EMPTY_CLIENT_RATE_FORM,
  rateEndFormSchema,
  teamFormSchema,
  teamToForm,
  toBillingPatch,
  toClientRateCreate,
  toTeamPatch,
} from './schemas';

const RAMYA = techwaveDetail.contacts[0] as ContactRead;
const TARAK = techwaveDetail.contacts[1] as ContactRead;
const UUID = '0198c1f2-0000-7000-8000-00000000e001';

describe('changedFields', () => {
  it('keeps only the keys whose value differs', () => {
    expect(changedFields({ a: 1, b: 'x', c: null }, { a: 1, b: 'y', c: null })).toEqual({ b: 'x' });
  });

  it('keeps a value that became null', () => {
    expect(changedFields({ a: null }, { a: 'x' })).toEqual({ a: null });
  });

  it('is empty when nothing differs', () => {
    expect(changedFields({ a: 1 }, { a: 1 })).toEqual({});
  });
});

describe('billingToForm', () => {
  it('turns what the API holds into form text, with blanks for null', () => {
    expect(billingToForm(techwaveDetail)).toEqual({
      invoice_email: '',
      billing_contact_id: TARAK.id,
      payment_terms_days: '30',
      default_vat_rate_id: '',
      default_service_id: '',
      invoice_template_id: '',
      billing_notes: '',
    });
  });

  it('leaves the payment terms blank when the practice default applies', () => {
    expect(billingToForm({ ...techwaveDetail, payment_terms_days: null }).payment_terms_days).toBe(
      '',
    );
  });

  it('has no billing contact when none is flagged', () => {
    const none: ClientDetail = {
      ...techwaveDetail,
      contacts: techwaveDetail.contacts.map((contact) => ({ ...contact, is_billing: false })),
    };
    expect(billingToForm(none).billing_contact_id).toBe('');
  });
});

describe('toBillingPatch', () => {
  const saved = billingToForm(techwaveDetail);

  it('is empty when nothing changed', () => {
    expect(toBillingPatch(saved, techwaveDetail)).toEqual({});
  });

  it('sends only what changed, with the right types', () => {
    expect(
      toBillingPatch(
        {
          ...saved,
          invoice_email: ' billing@x.example ',
          payment_terms_days: '14',
          billing_notes: 'Hi',
        },
        techwaveDetail,
      ),
    ).toEqual({ invoice_email: 'billing@x.example', payment_terms_days: 14, billing_notes: 'Hi' });
  });

  it('sends null for a field that was emptied', () => {
    const client: ClientDetail = { ...techwaveDetail, invoice_email: 'old@x.example' };
    expect(
      toBillingPatch(
        { ...billingToForm(client), invoice_email: '', payment_terms_days: '' },
        client,
      ),
    ).toEqual({ invoice_email: null, payment_terms_days: null });
  });

  it('sends the ids of the choices', () => {
    expect(
      toBillingPatch(
        {
          ...saved,
          default_vat_rate_id: UUID,
          default_service_id: UUID,
          invoice_template_id: UUID,
        },
        techwaveDetail,
      ),
    ).toEqual({
      default_vat_rate_id: UUID,
      default_service_id: UUID,
      invoice_template_id: UUID,
    });
  });

  it('never sends the billing contact: that is a flag of the contact', () => {
    expect(toBillingPatch({ ...saved, billing_contact_id: RAMYA.id }, techwaveDetail)).toEqual({});
  });
});

describe('billingFormSchema', () => {
  const valid = billingToForm(techwaveDetail);

  it('accepts the saved values', () => {
    expect(billingFormSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['invoice_email', 'nope', 'Enter a valid email address'],
    ['payment_terms_days', '-1', 'Enter a number of days from 0 to 365'],
    ['payment_terms_days', '366', 'Enter a number of days from 0 to 365'],
    ['payment_terms_days', '1.5', 'Enter a number of days from 0 to 365'],
    ['default_vat_rate_id', 'not-a-uuid', 'Choose from the list'],
    ['billing_notes', 'x'.repeat(2001), 'Use at most 2000 characters'],
  ] as const)('rejects %s = %j', (field, value, message) => {
    const result = billingFormSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it('accepts the limits of the payment terms', () => {
    expect(billingFormSchema.safeParse({ ...valid, payment_terms_days: '0' }).success).toBe(true);
    expect(billingFormSchema.safeParse({ ...valid, payment_terms_days: '365' }).success).toBe(true);
    expect(billingFormSchema.safeParse({ ...valid, payment_terms_days: '' }).success).toBe(true);
  });
});

describe('billingFlagChanges', () => {
  const contacts = techwaveDetail.contacts;

  it('does nothing when the choice did not change', () => {
    expect(billingFlagChanges(TARAK.id, contacts, TARAK.id)).toEqual([]);
    expect(
      billingFlagChanges(
        '',
        contacts.map((c) => ({ ...c, is_billing: false })),
        '',
      ),
    ).toEqual([]);
  });

  it('flags the new contact before clearing the old one', () => {
    expect(billingFlagChanges(RAMYA.id, contacts, TARAK.id)).toEqual([
      { contactId: RAMYA.id, is_billing: true },
      { contactId: TARAK.id, is_billing: false },
    ]);
  });

  it('only clears the flag when the billing contact is removed', () => {
    expect(billingFlagChanges('', contacts, TARAK.id)).toEqual([
      { contactId: TARAK.id, is_billing: false },
    ]);
  });

  it('only flags the contact when there was none', () => {
    const none = contacts.map((contact) => ({ ...contact, is_billing: false }));
    expect(billingFlagChanges(RAMYA.id, none, '')).toEqual([
      { contactId: RAMYA.id, is_billing: true },
    ]);
  });

  it('clears every other flag when several were set', () => {
    const both = contacts.map((contact) => ({ ...contact, is_billing: true }));
    expect(billingFlagChanges(RAMYA.id, both, RAMYA.id)).toEqual([]);
    expect(billingFlagChanges(TARAK.id, both, RAMYA.id)).toEqual([
      { contactId: RAMYA.id, is_billing: false },
    ]);
  });
});

describe('team form', () => {
  it('starts from the people the client has', () => {
    expect(teamToForm({ ...techwaveDetail, partner_user_id: ADA_ID })).toEqual({
      partner_user_id: ADA_ID,
      manager_user_id: techwaveDetail.manager_user_id,
    });
    expect(teamToForm({ ...techwaveDetail, manager_user_id: null }).manager_user_id).toBe('');
  });

  it('sends only the person that changed, null for nobody', () => {
    const saved = teamToForm(techwaveDetail);
    expect(toTeamPatch(saved, techwaveDetail)).toEqual({});
    expect(toTeamPatch({ ...saved, partner_user_id: GRACE_ID }, techwaveDetail)).toEqual({
      partner_user_id: GRACE_ID,
    });
    expect(toTeamPatch({ ...saved, manager_user_id: '' }, techwaveDetail)).toEqual({
      manager_user_id: null,
    });
  });

  it('only accepts an id or nobody', () => {
    expect(teamFormSchema.safeParse({ partner_user_id: '', manager_user_id: UUID }).success).toBe(
      true,
    );
    expect(teamFormSchema.safeParse({ partner_user_id: 'x', manager_user_id: '' }).success).toBe(
      false,
    );
  });
});

describe('client rate form', () => {
  const rate: ClientRateRead = {
    id: UUID,
    client_id: techwaveDetail.id,
    user_id: GRACE_ID,
    user_name: 'Grace Hopper',
    hourly_rate: 12050,
    effective_from: '2026-07-01',
    effective_to: null,
    created_at: '2026-01-10T09:00:00Z',
    updated_at: '2026-01-10T09:00:00Z',
  };

  it('writes a rate as pounds', () => {
    expect(clientRateToForm(rate)).toEqual({
      user_id: GRACE_ID,
      hourly_rate: '120.50',
      effective_from: '2026-07-01',
      effective_to: '',
    });
    expect(clientRateToForm({ ...rate, user_id: null, effective_to: '2026-12-31' })).toMatchObject({
      user_id: '',
      effective_to: '2026-12-31',
    });
  });

  it('sends pence, and leaves out a period that is blank', () => {
    expect(toClientRateCreate({ ...EMPTY_CLIENT_RATE_FORM, hourly_rate: '95' })).toEqual({
      user_id: null,
      hourly_rate: 9500,
    });
    expect(
      toClientRateCreate({
        user_id: GRACE_ID,
        hourly_rate: '£1,234.5',
        effective_from: '2026-07-01',
        effective_to: '2026-12-31',
      }),
    ).toEqual({
      user_id: GRACE_ID,
      hourly_rate: 123450,
      effective_from: '2026-07-01',
      effective_to: '2026-12-31',
    });
  });

  it.each(['', 'abc', '-5', '1.234', '1.2.3', '£'])('rejects the amount %j', (amount) => {
    const result = clientRateFormSchema.safeParse({
      ...EMPTY_CLIENT_RATE_FORM,
      hourly_rate: amount,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['hourly_rate']);
  });

  it('accepts a free rate and common spellings of an amount', () => {
    for (const amount of ['0', '95', '95.5', '£95.50', '1,234.00']) {
      expect(
        clientRateFormSchema.safeParse({ ...EMPTY_CLIENT_RATE_FORM, hourly_rate: amount }).success,
      ).toBe(true);
    }
  });

  it('rejects an end date before the start date, on the end date', () => {
    const result = clientRateFormSchema.safeParse({
      ...EMPTY_CLIENT_RATE_FORM,
      hourly_rate: '95',
      effective_from: '2026-07-01',
      effective_to: '2026-06-30',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['effective_to'],
      message: 'The end date is before the start date',
    });
  });

  it('accepts a one-day rate', () => {
    expect(
      clientRateFormSchema.safeParse({
        ...EMPTY_CLIENT_RATE_FORM,
        hourly_rate: '95',
        effective_from: '2026-07-01',
        effective_to: '2026-07-01',
      }).success,
    ).toBe(true);
  });

  it('needs a real date for the end-date dialog', () => {
    expect(rateEndFormSchema.safeParse({ effective_to: '2026-12-31' }).success).toBe(true);
    expect(rateEndFormSchema.safeParse({ effective_to: '' }).success).toBe(false);
    expect(rateEndFormSchema.safeParse({ effective_to: '31/12/2026' }).success).toBe(false);
  });
});
