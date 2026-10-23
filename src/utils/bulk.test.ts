import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api';

import { bulkSummary, describeBulkError } from './bulk';

const conflict = (details: unknown) =>
  new ApiError({ status: 409, code: 'JOB_IN_USE', message: 'Nothing was deleted.', details });

describe('describeBulkError', () => {
  it('turns the details of a 409 into one line per offending row', () => {
    const refusal = describeBulkError(
      conflict([
        { job_id: 'a', number: 'J00001', reason: 'Has time.' },
        { client_id: 'b', code: 'C0001', name: 'Acme', reason: 'Has jobs.' },
        { invoice_id: 'c', number: 'INV-1', message: 'Not a draft.' },
        { job_id: 'd' },
        'text',
      ]),
    );
    expect(refusal.message).toBe('Nothing was deleted.');
    expect(refusal.items).toEqual([
      { label: 'J00001', reason: 'Has time.' },
      { label: 'C0001', reason: 'Has jobs.' },
      { label: 'INV-1', reason: 'Not a draft.' },
    ]);
  });

  it('has no items for other failures, and a plain message for a stranger', () => {
    const notFound = new ApiError({
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: 'Some of the jobs were not found.',
      details: { job_ids: ['x'] },
    });
    expect(describeBulkError(notFound)).toEqual({
      message: 'Some of the jobs were not found.',
      requestId: undefined,
      items: [],
    });
    expect(describeBulkError(new Error('boom')).message).toMatch(/unexpected error/);
  });
});

describe('bulkSummary', () => {
  const noun = ['job', 'jobs'] as const;
  it('names how many changed', () => {
    expect(bulkSummary({ affected: 3, changed: 3 }, noun, 'updated')).toEqual({
      title: '3 jobs updated',
    });
    expect(bulkSummary({ affected: 1, changed: 1 }, noun, 'deleted')).toEqual({
      title: '1 job deleted',
    });
  });

  it('says how many already had the value', () => {
    expect(bulkSummary({ affected: 3, changed: 1 }, noun, 'updated')).toEqual({
      title: '1 job updated',
      description: '2 of the 3 selected jobs already had that value.',
    });
  });
});
