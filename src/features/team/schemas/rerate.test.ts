import { describe, expect, it } from 'vitest';

import { EMPTY_SCOPE, initialScope } from './rerate';

describe('initialScope', () => {
  it('opens empty, or with the job of the link it was opened from', () => {
    expect(initialScope(new URLSearchParams())).toEqual(EMPTY_SCOPE);
    expect(initialScope(new URLSearchParams({ job_id: 'j1', job: 'J-0001 Accounts' }))).toEqual({
      ...EMPTY_SCOPE,
      jobs: [{ id: 'j1', label: 'J-0001 Accounts' }],
    });
  });
});
