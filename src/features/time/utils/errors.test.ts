import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api';

import { dialogError } from './errors';

describe('dialogError', () => {
  it('says what is wrong with the field of a refusal, not the generic text', () => {
    const refusal = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Some fields are invalid.',
      details: [
        { field: 'job_id', code: 'required', message: 'Time must be recorded against a job.' },
      ],
    });
    expect(dialogError(refusal)).toEqual({ message: 'Time must be recorded against a job.' });
  });

  it('keeps the message of a refusal without field details', () => {
    const refusal = new ApiError({
      status: 409,
      code: 'JOB_CLOSED',
      message: 'Time cannot be logged on a completed, closed or cancelled job.',
      details: { job_id: 'j1', status: 'completed' },
    });
    expect(dialogError(refusal).message).toBe(
      'Time cannot be logged on a completed, closed or cancelled job.',
    );
  });
});
