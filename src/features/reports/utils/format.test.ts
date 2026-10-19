import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api';

import { describeFailure } from './errors';
import { linkTo, plural, weekOf, words } from './format';

describe('plural', () => {
  it('says one of a thing in the singular and any other count in the plural', () => {
    expect(plural(1, 'invoice', 'invoices')).toBe('1 invoice');
    expect(plural(0, 'invoice', 'invoices')).toBe('0 invoices');
    expect(plural(5, 'person', 'people')).toBe('5 people');
  });
});

describe('words', () => {
  it('turns a code into a sentence-case label', () => {
    expect(words('in_progress')).toBe('In progress');
    expect(words('hourly')).toBe('Hourly');
    expect(words(null)).toBe('—');
    expect(words('')).toBe('—');
  });
});

describe('linkTo', () => {
  it('adds the query that has a value, and leaves the rest out', () => {
    expect(linkTo('/acme/time/entries', { person: 'u-1', from: '2026-10-01', to: null })).toBe(
      '/acme/time/entries?person=u-1&from=2026-10-01',
    );
    expect(linkTo('/acme/wip/details', { client_id: undefined, job_id: '' })).toBe(
      '/acme/wip/details',
    );
  });
});

describe('weekOf', () => {
  it('names a week by its first day', () => {
    expect(weekOf('2026-10-12')).toBe('Week of 12/10/2026');
  });
});

describe('describeFailure', () => {
  it('uses the title of the action and the message of the API', () => {
    const error = new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Not that.' });
    expect(describeFailure(error, 'Could not download the report')).toEqual({
      title: 'Could not download the report',
      description: 'Not that.',
    });
  });

  it('says that the person may not, for a refusal', () => {
    const error = new ApiError({ status: 403, code: 'FORBIDDEN', message: 'No export.' });
    expect(describeFailure(error, 'Could not download the report')).toEqual({
      title: "You don't have permission to do that",
      description: 'No export.',
    });
  });

  it('says when to try again, for too many requests', () => {
    const error = new ApiError({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Slow down.',
      retryAfter: 30,
    });
    const notice = describeFailure(error, 'Could not download the report');
    expect(notice.title).toBe('Too many requests');
    expect(notice.description).toMatch(/^Try again in /);
  });

  it('does not guess at an error that did not come from the API', () => {
    expect(describeFailure(new Error('boom'), 'Could not download the report')).toEqual({
      title: 'Could not download the report',
      description: 'An unexpected error occurred. Please try again.',
    });
  });
});
