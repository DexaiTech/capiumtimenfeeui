import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api';

import type { LineValues } from '../schemas/line';
import { line } from '../test/fixtures';
import {
  mileageNet,
  parseMiles,
  rechargeFor,
  resolveAmounts,
  vatInGross,
  vatOnNet,
} from './amounts';
import { describeFailure, receiptProblems, toFormError } from './errors';
import { extensionOf, kindOfName, refusalFor } from './files';
import { claimLabel, dateSpan, formatFileSize, formatMiles } from './format';
import { hasChanges, toLineInput, toLineUpdate, type LineBodyContext } from './lineBody';

describe('the sums of an expense line', () => {
  it('works the VAT out of the net and out of the gross, rounding half up', () => {
    expect(vatOnNet(1000, 2000)).toBe(200);
    expect(vatOnNet(333, 2000)).toBe(67);
    expect(vatOnNet(25, 1000)).toBe(3);
    expect(vatOnNet(1000, 0)).toBe(0);
    expect(vatInGross(1200, 2000)).toBe(200);
    expect(vatInGross(1000, 2000)).toBe(167);
    expect(vatInGross(0, 2000)).toBe(0);
  });

  it('keeps whole pence even for the largest amount the API takes', () => {
    expect(vatOnNet(1_000_000_000_000, 2000)).toBe(200_000_000_000);
  });

  it('gives the third amount from any two, and the VAT of the rate from one', () => {
    expect(resolveAmounts({ net: 1000, vat: null, gross: null }, 2000)).toEqual({
      net: 1000,
      vat: 200,
      gross: 1200,
    });
    expect(resolveAmounts({ net: null, vat: null, gross: 1200 }, 2000)).toEqual({
      net: 1000,
      vat: 200,
      gross: 1200,
    });
    expect(resolveAmounts({ net: 1000, vat: 150, gross: null }, 2000)).toEqual({
      net: 1000,
      vat: 150,
      gross: 1150,
    });
    expect(resolveAmounts({ net: 1000, vat: null, gross: 1300 }, null)).toEqual({
      net: 1000,
      vat: 300,
      gross: 1300,
    });
    expect(resolveAmounts({ net: null, vat: 200, gross: 1200 }, 2000)).toEqual({
      net: 1000,
      vat: 200,
      gross: 1200,
    });
  });

  it('has no VAT without a code, and says nothing when nothing can be worked out', () => {
    expect(resolveAmounts({ net: 500, vat: null, gross: null }, null)).toEqual({
      net: 500,
      vat: 0,
      gross: 500,
    });
    expect(resolveAmounts({ net: null, vat: null, gross: null }, 2000)).toBeNull();
    expect(resolveAmounts({ net: null, vat: 100, gross: null }, 2000)).toBeNull();
    expect(resolveAmounts({ net: 1000, vat: null, gross: 900 }, 2000)).toBeNull();
  });

  it('prices miles at the practice rate and recharges net plus the markup', () => {
    expect(mileageNet('42.5', 45)).toBe(1913);
    expect(mileageNet('10', 45)).toBe(450);
    expect(mileageNet('0.01', 45)).toBe(0);
    expect(rechargeFor(4300, 1000)).toBe(4730);
    expect(rechargeFor(5, 1000)).toBe(6);
    expect(rechargeFor(4300, 0)).toBe(4300);
  });

  it('reads miles with at most two decimals, more than 0 and below a million', () => {
    expect(parseMiles('42.5')).toBe('42.5');
    expect(parseMiles(' 42.50 ')).toBe('42.50');
    expect(parseMiles('0.01')).toBe('0.01');
    for (const bad of ['', '0', '0.00', 'abc', '42.555', '-3', '1000000', '1,5']) {
      expect(parseMiles(bad), bad).toBeNull();
    }
  });
});

const base: LineValues = {
  expense_type_id: 'type-1',
  incurred_on: '2026-09-07',
  description: 'Train to Leeds',
  supplier: '',
  client_id: '',
  job_id: '',
  vat_rate_id: '',
  net: '',
  vat: '',
  gross: '',
  miles: '',
  is_billable: false,
  recharge_amount: '',
  payer: 'staff',
  reason: '',
};

const ctx: LineBodyContext = {
  isMileage: false,
  canSetRecharge: false,
  anchor: 'net',
  amountsTouched: true,
  vatTouched: false,
};

describe('the body of a new line', () => {
  it('sends the net and leaves out what is empty, so the API works out the VAT', () => {
    expect(toLineInput({ ...base, net: '43.00', vat: '0.00', gross: '43.00' }, ctx)).toEqual({
      expense_type_id: 'type-1',
      incurred_on: '2026-09-07',
      description: 'Train to Leeds',
      payer: 'staff',
      is_billable: false,
      net: 4300,
    });
  });

  it('sends the VAT only when it was set by hand, and the gross when that was typed', () => {
    const typed = { ...base, net: '10.00', vat: '1.99', gross: '11.99' };
    expect(toLineInput(typed, { ...ctx, vatTouched: true })).toMatchObject({ net: 1000, vat: 199 });
    expect(toLineInput(typed, { ...ctx, anchor: 'gross' })).toMatchObject({ gross: 1199 });
    expect(toLineInput(typed, { ...ctx, anchor: 'gross' })).not.toHaveProperty('net');
  });

  it('sends the client, job, supplier and VAT code when chosen', () => {
    const body = toLineInput(
      {
        ...base,
        net: '10',
        supplier: 'LNER',
        client_id: 'c-1',
        job_id: 'j-1',
        vat_rate_id: 'v-1',
        is_billable: true,
      },
      ctx,
    );
    expect(body).toMatchObject({
      supplier: 'LNER',
      client_id: 'c-1',
      job_id: 'j-1',
      vat_rate_id: 'v-1',
      is_billable: true,
    });
  });

  it('sends miles, never an amount, for a mileage type', () => {
    const body = toLineInput({ ...base, miles: '42.5', net: '99' }, { ...ctx, isMileage: true });
    expect(body.miles).toBe('42.5');
    expect(body).not.toHaveProperty('net');
    expect(body).not.toHaveProperty('gross');
  });

  it('sends the recharge only for a manager and a billable line', () => {
    const values = { ...base, net: '10', client_id: 'c-1', is_billable: true, recharge_amount: '12' };
    expect(toLineInput(values, ctx)).not.toHaveProperty('recharge_amount');
    expect(toLineInput(values, { ...ctx, canSetRecharge: true })).toMatchObject({
      recharge_amount: 1200,
    });
    expect(
      toLineInput({ ...values, is_billable: false }, { ...ctx, canSetRecharge: true }),
    ).not.toHaveProperty('recharge_amount');
  });
});

describe('the body of a change', () => {
  const stored = line({ id: 'l-1' });
  const same: LineValues = {
    ...base,
    expense_type_id: stored.expense_type_id,
    incurred_on: stored.incurred_on,
    description: stored.description,
    supplier: stored.supplier ?? '',
    client_id: stored.client_id ?? '',
    vat_rate_id: stored.vat_rate_id ?? '',
    net: '43.00',
    vat: '0.00',
    gross: '43.00',
    is_billable: true,
    recharge_amount: '47.30',
  };
  const untouched: LineBodyContext = { ...ctx, amountsTouched: false };

  it('sends nothing when nothing changed', () => {
    expect(toLineUpdate(same, stored, untouched)).toEqual({});
    expect(hasChanges({})).toBe(false);
  });

  it('sends only the fields that changed, and null for what was cleared', () => {
    const changes = toLineUpdate(
      { ...same, description: 'Train to York', supplier: '', client_id: '', vat_rate_id: '' },
      stored,
      untouched,
    );
    expect(changes).toEqual({
      description: 'Train to York',
      supplier: null,
      client_id: null,
      vat_rate_id: null,
    });
  });

  it('sends the amounts only when they were typed', () => {
    expect(toLineUpdate({ ...same, net: '50.00' }, stored, untouched)).toEqual({});
    expect(toLineUpdate({ ...same, net: '50.00' }, stored, ctx)).toEqual({ net: 5000 });
    expect(toLineUpdate({ ...same, net: '50.00', vat: '1.00' }, stored, { ...ctx, vatTouched: true })).toEqual({
      net: 5000,
      vat: 100,
    });
  });

  it('sends the recharge of a manager when it changed, and null when it was emptied', () => {
    const manager = { ...untouched, canSetRecharge: true };
    expect(toLineUpdate({ ...same, recharge_amount: '50.00' }, stored, manager)).toEqual({
      recharge_amount: 5000,
    });
    expect(toLineUpdate({ ...same, recharge_amount: '' }, stored, manager)).toEqual({
      recharge_amount: null,
    });
    expect(toLineUpdate(same, stored, manager)).toEqual({});
  });

  it('adds the reason of a correction, which is not a change by itself', () => {
    const changes = toLineUpdate(same, stored, untouched, 'Wrong date');
    expect(changes).toEqual({ reason: 'Wrong date' });
    expect(hasChanges(changes)).toBe(false);
    expect(hasChanges({ ...changes, description: 'x' })).toBe(true);
  });

  it('prices a mileage line again only when the miles changed', () => {
    const drive = line({ miles: '42.50', mileage_rate_applied: 45 });
    const values = { ...same, miles: '42.5' };
    const mileage = { ...untouched, isMileage: true };
    expect(toLineUpdate(values, drive, mileage).miles).toBeUndefined();
    expect(toLineUpdate({ ...values, miles: '50' }, drive, mileage)).toMatchObject({ miles: '50' });
  });
});

describe('what the screens say about a failure', () => {
  it('lists the lines a submission was refused for', () => {
    const error = new ApiError({
      status: 422,
      code: 'RECEIPT_REQUIRED',
      message: 'Some expenses need a receipt.',
      details: [
        { field: 'lines', code: 'receipt_required', message: 'A needs one.', line_id: 'l-1' },
        { field: 'lines', code: 'receipt_required', message: 'B needs one.', line_id: 'l-2' },
        { field: 'lines', code: 'receipt_required', message: 'No id.' },
      ],
    });
    expect(receiptProblems(error)).toEqual([
      { lineId: 'l-1', message: 'A needs one.' },
      { lineId: 'l-2', message: 'B needs one.' },
    ]);
    expect(receiptProblems(new ApiError({ status: 422, code: 'OTHER', message: 'x' }))).toEqual([]);
    expect(receiptProblems(new Error('boom'))).toEqual([]);
  });

  it('turns a duplicate (409 with field details) into a field error for the form', () => {
    const duplicate = new ApiError({
      status: 409,
      code: 'EXPENSE_TYPE_NAME_TAKEN',
      message: 'Taken.',
      details: [{ field: 'name', code: 'duplicate', message: 'That name is taken.' }],
    });
    const converted = toFormError(duplicate);
    expect(converted).toBeInstanceOf(ApiError);
    expect((converted as ApiError).status).toBe(422);
    const other = new ApiError({ status: 409, code: 'EXPENSE_CLAIM_LOCKED', message: 'Locked.' });
    expect(toFormError(other)).toBe(other);
  });

  it('words a refusal for a toast', () => {
    expect(describeFailure(new ApiError({ status: 403, code: 'X', message: 'No.' }), 'Failed')).toEqual({
      title: "You don't have permission to do that",
      description: 'No.',
    });
    expect(
      describeFailure(
        new ApiError({ status: 404, code: 'RECEIPT_FILE_MISSING', message: 'The file is gone.' }),
        'Could not download a.pdf',
      ),
    ).toEqual({ title: 'Could not download a.pdf', description: 'The file is gone.' });
  });
});

describe('receipt files and the words around them', () => {
  it('accepts a PDF, JPG or PNG up to 10 MB and refuses the rest before sending it', () => {
    expect(refusalFor({ name: 'a.png', size: 69 })).toBeNull();
    expect(refusalFor({ name: 'A.JPEG', size: 10_485_760 })).toBeNull();
    expect(refusalFor({ name: 'scan.pdf', size: 1 })).toBeNull();
    expect(refusalFor({ name: 'a.png', size: 0 })).toBe('a.png is empty.');
    expect(refusalFor({ name: 'big.pdf', size: 10_485_761 })).toBe(
      'big.pdf is larger than 10 MB (10.0 MB).',
    );
    expect(refusalFor({ name: 'notes.docx', size: 10 })).toBe(
      'notes.docx is not an accepted type. Use a PDF, JPG or PNG file.',
    );
    expect(refusalFor({ name: 'noextension', size: 10 })).toContain('not an accepted type');
  });

  it('reads the extension and the kind of a file name', () => {
    expect(extensionOf('Photo.JPG')).toBe('jpg');
    expect(extensionOf('.hidden')).toBe('');
    expect(kindOfName('x.pdf')?.key).toBe('pdf');
    expect(kindOfName('x.gif')).toBeNull();
  });

  it('formats sizes, periods, claim labels and miles', () => {
    expect(formatFileSize(69)).toBe('69 B');
    expect(formatFileSize(142_000)).toBe('138.7 KB');
    expect(formatFileSize(2_097_152)).toBe('2.0 MB');
    expect(dateSpan('2026-09-07', '2026-09-07')).toBe('07/09/2026');
    expect(dateSpan('2026-09-07', '2026-09-10')).toBe('07/09/2026 – 10/09/2026');
    expect(dateSpan(null, null)).toBe('');
    expect(
      claimLabel({ title: null, user_name: 'Ada Lovelace', first_date: '2026-09-07', line_count: 1 }),
    ).toBe('Ada Lovelace, 07/09/2026');
    expect(
      claimLabel({ title: 'Leeds', user_name: 'Ada Lovelace', first_date: null, line_count: 0 }),
    ).toBe('Leeds');
    expect(formatMiles('42.50')).toBe('42.5 miles');
    expect(formatMiles('1.00')).toBe('1 mile');
  });
});
