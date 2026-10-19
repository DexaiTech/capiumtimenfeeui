import { beforeEach, describe, expect, it } from 'vitest';

import {
  INITIAL_RECENT_CLIENTS,
  RECENT_CLIENTS_KEY,
  RECENT_CLIENTS_LIMIT,
  useRecentClientsStore,
} from './recents';

const client = (n: number) => ({
  id: `id-${String(n)}`,
  name: `Client ${String(n)}`,
  code: `C${String(n)}`,
});
const state = () => useRecentClientsStore.getState();
const ids = (organizationId: string) =>
  (state().byOrganization[organizationId] ?? []).map((entry) => entry.id);

beforeEach(() => {
  window.localStorage.clear();
  useRecentClientsStore.setState(INITIAL_RECENT_CLIENTS);
});

describe('recently viewed clients', () => {
  it('puts the client opened last first', () => {
    state().remember('org-1', client(1));
    state().remember('org-1', client(2));
    expect(ids('org-1')).toEqual(['id-2', 'id-1']);
  });

  it('moves a client opened again to the front, once', () => {
    state().remember('org-1', client(1));
    state().remember('org-1', client(2));
    state().remember('org-1', client(1));
    expect(ids('org-1')).toEqual(['id-1', 'id-2']);
  });

  it(`keeps at most ${String(RECENT_CLIENTS_LIMIT)}, dropping the oldest`, () => {
    for (let n = 1; n <= RECENT_CLIENTS_LIMIT + 3; n += 1) state().remember('org-1', client(n));
    expect(RECENT_CLIENTS_LIMIT).toBe(8);
    expect(ids('org-1')).toHaveLength(8);
    expect(ids('org-1')[0]).toBe('id-11');
    expect(ids('org-1')).not.toContain('id-1');
    expect(ids('org-1')).not.toContain('id-3');
    expect(ids('org-1')).toContain('id-4');
  });

  it('keeps one list for each practice', () => {
    state().remember('org-1', client(1));
    state().remember('org-2', client(2));
    expect(ids('org-1')).toEqual(['id-1']);
    expect(ids('org-2')).toEqual(['id-2']);
    expect(ids('org-3')).toEqual([]);
  });

  it('changes nothing when the first client is opened again', () => {
    state().remember('org-1', client(1));
    const before = state();
    state().remember('org-1', client(1));
    expect(state()).toBe(before);
  });

  it('follows a rename of the client', () => {
    state().remember('org-1', client(1));
    state().remember('org-1', { ...client(1), name: 'Renamed Ltd' });
    expect(state().byOrganization['org-1']).toEqual([
      { id: 'id-1', name: 'Renamed Ltd', code: 'C1' },
    ]);
  });

  it('forgets one client or all of a practice, and no other practice', () => {
    state().remember('org-1', client(1));
    state().remember('org-1', client(2));
    state().remember('org-2', client(3));

    state().forget('org-1', 'id-1');
    expect(ids('org-1')).toEqual(['id-2']);

    state().clear('org-1');
    expect(ids('org-1')).toEqual([]);
    expect(ids('org-2')).toEqual(['id-3']);
  });

  it('is kept in this browser', () => {
    state().remember('org-1', client(1));
    const stored: unknown = JSON.parse(window.localStorage.getItem(RECENT_CLIENTS_KEY) ?? 'null');
    expect(stored).toEqual({
      state: { byOrganization: { 'org-1': [{ id: 'id-1', name: 'Client 1', code: 'C1' }] } },
      version: 1,
    });
  });

  it('keeps only the id, the name and the code', () => {
    state().remember('org-1', { ...client(1), email: 'private@example.com' } as ReturnType<
      typeof client
    >);
    expect(state().byOrganization['org-1']?.[0]).toEqual(client(1));
  });
});
