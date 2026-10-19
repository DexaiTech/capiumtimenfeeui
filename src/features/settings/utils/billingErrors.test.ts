import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api';

import { dialogError, toBillingFormError } from './billingErrors';

const apiError = (status: number, code: string, message: string, details?: unknown) =>
  new ApiError({ status, code, message, details, requestId: 'req-1' });

function fieldsOf(error: unknown) {
  expect(error).toBeInstanceOf(ApiError);
  return (error as ApiError).details;
}

describe('toBillingFormError', () => {
  it('leaves other errors alone', () => {
    const plain = new Error('boom');
    expect(toBillingFormError(plain)).toBe(plain);
    const server = apiError(500, 'INTERNAL_ERROR', 'Boom.');
    expect(toBillingFormError(server)).toBe(server);
    const forbidden = apiError(403, 'PERMISSION_DENIED', 'No.');
    expect(toBillingFormError(forbidden)).toBe(forbidden);
    const other = apiError(409, 'TEMPLATE_INACTIVE', 'An inactive template cannot be the default.');
    expect(toBillingFormError(other)).toBe(other);
  });

  it('turns a duplicate with a field list into a 422 on the form fields, renaming them', () => {
    const converted = toBillingFormError(
      apiError(409, 'VAT_RATE_NAME_TAKEN', 'A VAT rate with this name exists.', [
        { field: 'name', code: 'duplicate', message: 'A VAT rate with this name exists.' },
        { field: 'rate_bp', code: 'invalid', message: 'Too high.' },
      ]),
      { rate_bp: 'rate' },
    ) as ApiError;
    expect(converted.status).toBe(422);
    expect(converted.code).toBe('VAT_RATE_NAME_TAKEN');
    expect(converted.requestId).toBe('req-1');
    expect(fieldsOf(converted)).toEqual([
      { field: 'name', code: 'duplicate', message: 'A VAT rate with this name exists.' },
      { field: 'rate', code: 'invalid', message: 'Too high.' },
    ]);
  });

  it('puts a duplicate name on the name field even when the API sends no field list', () => {
    expect(
      fieldsOf(
        toBillingFormError(apiError(409, 'TEMPLATE_NAME_TAKEN', 'A template has this name.')),
      ),
    ).toEqual([{ field: 'name', code: 'duplicate', message: 'A template has this name.' }]);
  });

  it('puts the refusal of a lower next number on the field and names the current number', () => {
    expect(
      fieldsOf(
        toBillingFormError(
          apiError(409, 'SEQUENCE_BACKWARDS', 'Numbers can only move forward.', {
            current_next_number: 50,
          }),
        ),
      ),
    ).toEqual([
      {
        field: 'next_number',
        code: 'SEQUENCE_BACKWARDS',
        message: 'Numbers only move forward. The next number is already 50: enter 50 or higher.',
      },
    ]);
  });

  it('puts the refusal of a number that is already used on the field and names it', () => {
    expect(
      fieldsOf(
        toBillingFormError(
          apiError(409, 'SEQUENCE_NUMBER_TAKEN', 'The number INV-00050 is already used.', {
            preview: 'INV-00050',
          }),
        ),
      ),
    ).toEqual([
      {
        field: 'next_number',
        code: 'SEQUENCE_NUMBER_TAKEN',
        message:
          'INV-00050 is already used and a number is never issued twice. Enter a higher number.',
      },
    ]);
  });

  it('falls back to the server message when the numbers are not in the details', () => {
    expect(
      fieldsOf(toBillingFormError(apiError(409, 'SEQUENCE_BACKWARDS', 'Only forward.'))),
    ).toEqual([{ field: 'next_number', code: 'SEQUENCE_BACKWARDS', message: 'Only forward.' }]);
    expect(
      fieldsOf(toBillingFormError(apiError(409, 'SEQUENCE_NUMBER_TAKEN', 'Already used.'))),
    ).toEqual([{ field: 'next_number', code: 'SEQUENCE_NUMBER_TAKEN', message: 'Already used.' }]);
  });
});

describe('dialogError', () => {
  it('counts the clients of a template that cannot be deleted', () => {
    expect(
      dialogError(apiError(409, 'TEMPLATE_IN_USE', 'Clients use this template.', { clients: 1 }))
        .message,
    ).toBe(
      '1 client uses this template, so it cannot be deleted. Deactivate it instead: clients keep an inactive template.',
    );
    expect(
      dialogError(apiError(409, 'TEMPLATE_IN_USE', 'Clients use this template.', { clients: 3 }))
        .message,
    ).toBe(
      '3 clients use this template, so it cannot be deleted. Deactivate it instead: clients keep an inactive template.',
    );
    expect(
      dialogError(apiError(409, 'TEMPLATE_IN_USE', 'Clients use this template.')).message,
    ).toBe('Clients use this template.');
  });

  it('shows the server message, and the request id only for a failure that may be repeated', () => {
    expect(dialogError(apiError(403, 'PERMISSION_DENIED', 'Not allowed.'))).toEqual({
      message: 'Not allowed.',
      requestId: undefined,
    });
    expect(dialogError(apiError(500, 'INTERNAL_ERROR', 'Boom.'))).toEqual({
      message: 'Boom.',
      requestId: 'req-1',
    });
    expect(dialogError(new Error('x'))).toEqual({
      message: 'An unexpected error occurred. Please try again.',
    });
  });
});
