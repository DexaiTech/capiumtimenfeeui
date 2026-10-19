import { ownerContext } from '@/test/orgFixtures';

import type { HistoryEntry } from '../types';

export const ORG_ID = ownerContext.organization.id;
export const CLIENT_ID = '0198c1f2-0000-7000-8000-00000000c001';

/** A client update by Ada, as `GET …/audit-logs/history` returns it. */
export const historyEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'entry-1',
  action: 'client.updated',
  label: 'Client details updated',
  actor: { id: 'user-ada', name: 'Ada Lovelace' },
  at: '2026-10-05T09:14:07Z',
  ip_address: '203.0.113.7',
  target_type: 'client',
  target_id: CLIENT_ID,
  changes: [{ field: 'name', before: 'Acme Ltd', after: 'Acme Group' }],
  summary: 'Client details updated: C00012 · Acme Group',
  ...overrides,
});

/** The creation that came before it: no changes, nothing to compare. */
export const createdEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry =>
  historyEntry({
    id: 'entry-0',
    action: 'client.created',
    label: 'Client created',
    at: '2026-10-01T08:00:00Z',
    changes: [],
    summary: 'Client created: C00012 · Acme Ltd',
    ...overrides,
  });
