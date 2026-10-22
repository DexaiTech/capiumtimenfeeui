import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api';

import {
  defaultOrder,
  STATUS_META,
  PRIORITY_META,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../constants';
import { describeFailure, dialogError, fieldDetails, isNotFound, uploadFailure } from './errors';
import {
  ACCEPT_ATTRIBUTE,
  extensionOf,
  filesOf,
  kindOfAttachment,
  kindOfName,
  MAX_FILE_BYTES,
  refusalFor,
} from './files';
import { filtersFromParams, isFiltered } from './filters';
import { changeLine, formatFileSize, formatShare, pluralize, ticketLabel } from './format';
import { isoDateOrUndefined, MAX_RANGE_DAYS, RANGE_PRESETS, rangeProblem } from './range';

const apiError = (status: number, code: string, message: string, extra: object = {}) =>
  new ApiError({ status, code, message, ...extra });

describe('format', () => {
  it('writes a file size the way the API document does', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(69)).toBe('69 B');
    expect(formatFileSize(1023)).toBe('1023 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(142_000)).toBe('138.7 KB');
    expect(formatFileSize(1_048_575)).toBe('1024.0 KB');
    expect(formatFileSize(MAX_FILE_BYTES)).toBe('2.0 MB');
    expect(formatFileSize(1_992_294)).toBe('1.9 MB');
  });

  it('turns the API\'s change into the "vs last period" line', () => {
    expect(changeLine({ kind: 'new', percent: null })).toEqual({ direction: 'up', text: 'New' });
    expect(changeLine({ kind: 'percent', percent: 60 })).toEqual({ direction: 'up', text: '60%' });
    expect(changeLine({ kind: 'percent', percent: 300 })).toEqual({
      direction: 'up',
      text: '300%',
    });
    expect(changeLine({ kind: 'percent', percent: 0 })).toEqual({ direction: 'up', text: '0%' });
    // The arrow carries the sign: a fall is a down arrow and the size of the fall.
    expect(changeLine({ kind: 'percent', percent: -50 })).toEqual({
      direction: 'down',
      text: '50%',
    });
    expect(changeLine({ kind: 'none', percent: null })).toEqual({ direction: 'up', text: '0%' });
    expect(changeLine({ kind: 'percent', percent: null })).toEqual({ direction: 'up', text: '0%' });
  });

  it('writes a share with one decimal, and 0.0% for an empty range', () => {
    expect(formatShare(37.5)).toBe('37.5%');
    expect(formatShare(25)).toBe('25.0%');
    expect(formatShare(18.8)).toBe('18.8%');
    expect(formatShare(null)).toBe('0.0%');
  });

  it('counts with the right noun and names a ticket by code and subject', () => {
    expect(pluralize(1, 'ticket')).toBe('1 ticket');
    expect(pluralize(0, 'ticket')).toBe('0 tickets');
    expect(pluralize(2, 'ticket')).toBe('2 tickets');
    expect(ticketLabel({ code: 'APT271', subject: 'Notification bell count' })).toBe(
      'APT271 Notification bell count',
    );
  });
});

describe('files', () => {
  it('reads the extension in lower case, and none from a dotfile or a trailing dot', () => {
    expect(extensionOf('Screenshot.PNG')).toBe('png');
    expect(extensionOf('archive.tar.gz')).toBe('gz');
    expect(extensionOf('.csv')).toBe('');
    expect(extensionOf('notes.')).toBe('');
    expect(extensionOf('README')).toBe('');
  });

  it('knows the five accepted kinds', () => {
    expect(kindOfName('a.png')?.key).toBe('image');
    expect(kindOfName('a.jpeg')?.key).toBe('image');
    expect(kindOfName('a.webp')?.key).toBe('image');
    expect(kindOfName('a.pdf')?.key).toBe('pdf');
    expect(kindOfName('a.docx')?.key).toBe('doc');
    expect(kindOfName('a.xls')?.key).toBe('xls');
    expect(kindOfName('a.CSV')?.key).toBe('csv');
    expect(kindOfName('a.svg')).toBeNull();
    expect(kindOfName('a.html')).toBeNull();
    expect(kindOfName('virus.exe')).toBeNull();
    expect(ACCEPT_ATTRIBUTE).toBe('.png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv');
  });

  it('takes the kind of a stored file from its detected type first', () => {
    expect(kindOfAttachment('whatever', 'image/png')?.key).toBe('image');
    expect(kindOfAttachment('report.xlsx', 'application/octet-stream')?.key).toBe('xls');
    expect(kindOfAttachment('mystery', 'application/octet-stream')).toBeNull();
  });

  describe('refusalFor', () => {
    const file = (name: string, size: number) => ({ name, size });

    it('accepts a file of an accepted type up to 2 MB, the limit included', () => {
      expect(refusalFor(file('a.png', 1))).toBeNull();
      expect(refusalFor(file('a.csv', MAX_FILE_BYTES))).toBeNull();
    });

    it('refuses what is empty, too big or of another type, naming the file', () => {
      expect(refusalFor(file('empty.csv', 0))).toBe('empty.csv is empty.');
      expect(refusalFor(file('big.png', MAX_FILE_BYTES + 1))).toBe(
        'big.png is larger than 2 MB (2.0 MB).',
      );
      expect(refusalFor(file('virus.exe', 10))).toBe(
        'virus.exe is not an accepted type. Use an image, PDF, Word, Excel or CSV file.',
      );
    });

    it('checks emptiness first, then size, then the type', () => {
      expect(refusalFor(file('empty.exe', 0))).toBe('empty.exe is empty.');
      expect(refusalFor(file('big.exe', MAX_FILE_BYTES + 1))).toContain('is larger than 2 MB');
    });
  });

  describe('filesOf', () => {
    const png = new File(['x'], 'a.png', { type: 'image/png' });
    const data = (files: File[], text = ''): DataTransfer =>
      ({ files, getData: () => text }) as unknown as DataTransfer;

    it('lists the files of a clipboard or a drop, none without any', () => {
      expect(filesOf(null)).toEqual([]);
      expect(filesOf(data([]))).toEqual([]);
      expect(filesOf(data([png]))).toEqual([png]);
    });

    it('can let a paste that carries text be a text paste', () => {
      expect(filesOf(data([png], '1\t2'), { ignoreWithText: true })).toEqual([]);
      expect(filesOf(data([png], '1\t2'))).toEqual([png]);
      expect(filesOf(data([png], ''), { ignoreWithText: true })).toEqual([png]);
    });
  });
});

describe('filters', () => {
  it('reads the filters from the address and drops what is not a status, a priority or a sort', () => {
    const filters = filtersFromParams(
      new URLSearchParams(
        'q=%20trial%20&status=open&status=done&status=reopened&priority=high&priority=urgent&tag=t1&tag=&sort=subject&order=asc',
      ),
    );
    expect(filters).toEqual({
      q: 'trial',
      status: ['open', 'reopened'],
      priority: ['high'],
      tag_id: ['t1'],
      sort: 'subject',
      order: 'asc',
    });
  });

  it("defaults to the newest first, and to the API's order of the chosen sort", () => {
    expect(filtersFromParams(new URLSearchParams())).toEqual({
      q: undefined,
      status: [],
      priority: [],
      tag_id: [],
      sort: 'created_at',
      order: 'desc',
    });
    expect(filtersFromParams(new URLSearchParams('sort=number')).order).toBe('desc');
    expect(filtersFromParams(new URLSearchParams('sort=subject')).order).toBe('asc');
    expect(filtersFromParams(new URLSearchParams('sort=status&order=sideways')).order).toBe('asc');
    expect(filtersFromParams(new URLSearchParams('sort=colour')).sort).toBe('created_at');
    expect(defaultOrder('priority')).toBe('asc');
    expect(defaultOrder('created_at')).toBe('desc');
  });

  it('counts a search and any filter as filtering, and the sort as none', () => {
    const none = filtersFromParams(new URLSearchParams('sort=subject&order=desc'));
    expect(isFiltered(none)).toBe(false);
    expect(isFiltered(filtersFromParams(new URLSearchParams('q=a')))).toBe(true);
    expect(isFiltered(filtersFromParams(new URLSearchParams('status=open')))).toBe(true);
    expect(isFiltered(filtersFromParams(new URLSearchParams('priority=low')))).toBe(true);
    expect(isFiltered(filtersFromParams(new URLSearchParams('tag=t1')))).toBe(true);
    expect(isFiltered(filtersFromParams(new URLSearchParams('q=%20%20')))).toBe(false);
  });
});

describe('range', () => {
  it('keeps a date of the address only when it is a plain day', () => {
    expect(isoDateOrUndefined('2026-09-01')).toBe('2026-09-01');
    expect(isoDateOrUndefined('2026-9-1')).toBeUndefined();
    expect(isoDateOrUndefined('2026-09-01T10:00:00Z')).toBeUndefined();
    expect(isoDateOrUndefined('abc')).toBeUndefined();
    expect(isoDateOrUndefined('')).toBeUndefined();
    expect(isoDateOrUndefined(null)).toBeUndefined();
  });

  it('explains a range that cannot be applied, and accepts the longest one', () => {
    expect(rangeProblem(null, '2026-09-30')).toBe('Choose both dates.');
    expect(rangeProblem('2026-09-01', null)).toBe('Choose both dates.');
    expect(rangeProblem('2026-10-01', '2026-09-30')).toBe(
      'The start date must be on or before the end date.',
    );
    expect(rangeProblem('2026-09-30', '2026-09-30')).toBeNull();
    // 2025-10-01 to 2026-09-30 is 365 days; 2023-10-01 to 2024-09-30 holds 29 February: 366 days,
    // the longest the API accepts. One day more is refused.
    expect(rangeProblem('2025-10-01', '2026-09-30')).toBeNull();
    expect(rangeProblem('2023-10-01', '2024-09-30')).toBeNull();
    expect(rangeProblem('2023-09-30', '2024-09-30')).toBe(
      `Choose at most ${String(MAX_RANGE_DAYS)} days.`,
    );
  });

  it('counts the quick ranges back from today, ending on it', () => {
    const today = '2026-10-18';
    const span = (id: string) => RANGE_PRESETS.find((preset) => preset.id === id)?.span(today);
    expect(span('last-7')).toEqual({ from: '2026-10-12', to: today });
    expect(span('last-14')).toEqual({ from: '2026-10-05', to: today });
    expect(span('last-19')).toEqual({ from: '2026-09-30', to: today });
    expect(span('last-30')).toEqual({ from: '2026-09-19', to: today });
    expect(span('this-month')).toEqual({ from: '2026-10-01', to: today });
    expect(span('last-month')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    // Across a year end, and in a leap February.
    expect(RANGE_PRESETS.find((preset) => preset.id === 'last-month')?.span('2026-01-05')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(RANGE_PRESETS.find((preset) => preset.id === 'last-month')?.span('2024-03-10')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
  });
});

describe('errors', () => {
  it('reads the field entries of a 422 and ignores anything else in details', () => {
    const entries = [
      { field: 'subject', code: 'too_long', message: 'Too long.' },
      { field: 'tag_ids', message: 'Unknown tag.' },
    ];
    expect(
      fieldDetails(apiError(422, 'VALIDATION_ERROR', 'Invalid.', { details: entries })),
    ).toEqual(entries);
    expect(
      fieldDetails(
        apiError(422, 'VALIDATION_ERROR', 'Invalid.', { details: [{ field: 1 }, 'x', null] }),
      ),
    ).toEqual([]);
    expect(fieldDetails(apiError(409, 'TAG_NAME_TAKEN', 'Taken.', { details: { a: 1 } }))).toEqual(
      [],
    );
    expect(fieldDetails(new Error('plain'))).toEqual([]);
  });

  it('recognises a 404', () => {
    expect(isNotFound(apiError(404, 'RESOURCE_NOT_FOUND', 'Gone.'))).toBe(true);
    expect(isNotFound(apiError(403, 'PERMISSION_DENIED', 'No.'))).toBe(false);
    expect(isNotFound(new Error('x'))).toBe(false);
  });

  it('words a refusal for the line of a confirmation dialog, with the request id only when it may be a fault', () => {
    expect(dialogError(apiError(409, 'CONFLICT', 'In use.', { requestId: 'r-1' }))).toEqual({
      message: 'In use.',
      requestId: undefined,
    });
    expect(dialogError(apiError(500, 'INTERNAL_ERROR', 'Boom.', { requestId: 'r-2' }))).toEqual({
      message: 'Boom.',
      requestId: 'r-2',
    });
    expect(dialogError(new Error('x'))).toEqual({
      message: 'An unexpected error occurred. Please try again.',
    });
  });

  describe('describeFailure', () => {
    const title = 'Could not change APT1';

    it('names the problem for each kind of failure', () => {
      expect(describeFailure(apiError(0, 'network_error', 'Offline.'), title)).toEqual({
        title: 'Could not reach the server',
        description: 'Offline.',
      });
      expect(describeFailure(apiError(403, 'PERMISSION_DENIED', 'No.'), title)).toEqual({
        title: "You don't have permission to do that",
        description: 'No.',
      });
      expect(describeFailure(apiError(404, 'RESOURCE_NOT_FOUND', 'Gone.'), title)).toEqual({
        title: 'That ticket no longer exists',
        description: 'It may have been deleted by someone else. The list has been refreshed.',
      });
      expect(
        describeFailure(apiError(429, 'RATE_LIMITED', 'Slow.', { retryAfter: 90 }), title),
      ).toEqual({
        title: 'Too many requests',
        description: 'Try again in 2 minutes.',
      });
      expect(describeFailure(apiError(429, 'RATE_LIMITED', 'Slow.'), title).description).toBe(
        'Try again in 1 minute.',
      );
    });

    it("keeps the action's own title for a missing file and for anything else", () => {
      expect(
        describeFailure(
          apiError(404, 'ATTACHMENT_FILE_MISSING', 'Lost.'),
          'Could not download a.pdf',
        ),
      ).toEqual({ title: 'Could not download a.pdf', description: 'Lost.' });
      expect(describeFailure(apiError(422, 'VALIDATION_ERROR', 'Bad.'), title)).toEqual({
        title,
        description: 'Bad.',
      });
      expect(
        describeFailure(apiError(500, 'INTERNAL_ERROR', 'Boom.', { requestId: 'r-9' }), title),
      ).toEqual({
        title,
        description: 'Boom. (Request ID: r-9)',
      });
      expect(describeFailure(new Error('x'), title)).toEqual({
        title,
        description: 'An unexpected error occurred. Please try again.',
      });
    });
  });

  it("gives the API's message for a failed upload, and a general one otherwise", () => {
    expect(
      uploadFailure(apiError(413, 'ATTACHMENT_TOO_LARGE', 'The file is larger than 2 MB.')),
    ).toBe('The file is larger than 2 MB.');
    expect(uploadFailure(new Error('x'))).toBe('The upload failed. Please try again.');
  });
});

describe('constants', () => {
  it('has a label, a tone and a chart colour for every status and priority, in the order of the API', () => {
    expect(TICKET_STATUSES).toEqual([
      'open',
      'in_progress',
      'requirement_pending',
      'clarification_required',
      'blocked',
      'ready_for_ba_review',
      'reopened',
      'closed',
      'invalid',
      'on_hold',
    ]);
    expect(TICKET_STATUSES.map((status) => STATUS_META[status].label)).toEqual([
      'Open',
      'In Progress',
      'Requirement Pending',
      'Clarification Required',
      'Blocked',
      'Ready for BA Review',
      'Reopened',
      'Closed',
      'Invalid',
      'On Hold',
    ]);
    expect(TICKET_PRIORITIES).toEqual(['high', 'medium', 'low', 'not_set']);
    expect(TICKET_PRIORITIES.map((priority) => PRIORITY_META[priority].label)).toEqual([
      'High',
      'Medium',
      'Low',
      'Not Set',
    ]);
    // Colour is never the only carrier: every tone brings its own text, tint and chart colour.
    for (const status of TICKET_STATUSES) {
      expect(STATUS_META[status].tone.text).toMatch(/^text-/);
      expect(STATUS_META[status].tone.soft).toMatch(/^bg-/);
      expect(STATUS_META[status].chart).toBeTruthy();
    }
  });
});
