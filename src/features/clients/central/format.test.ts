import { describe, expect, it } from 'vitest';

import { techwaveDetail } from '../test/fixtures';
import { globex } from '../test/workspaceFixtures';
import type { CentralEnabled, CentralSyncAll, ClientSynced } from './types';
import {
  canSync,
  centralAddress,
  centralChip,
  describeEnabled,
  describeSync,
  describeSyncAll,
  isLinked,
  isMergedAway,
  managedFields,
} from './format';

const LONDON = 'Europe/London';

const link = (
  state: 'local' | 'synced' | 'stale' | 'failed',
  syncedAt: string | null = '2026-05-12T10:00:00Z',
) => ({
  central_client_id: state === 'local' ? null : 'cen-1',
  central_sync_state: state,
  central_synced_at: syncedAt,
});

describe('centralChip', () => {
  it('says Local for a client created in the practice', () => {
    expect(centralChip(link('local', null), LONDON)).toMatchObject({
      label: 'Local',
      tone: 'neutral',
    });
  });

  it('says when a linked client was last confirmed, as a date', () => {
    expect(centralChip(link('synced'), LONDON)).toMatchObject({
      label: 'Synced 12/05/2026',
      tone: 'success',
    });
  });

  it('reads the date in the practice time zone', () => {
    // 23:30 UTC is already the 13th in London (BST).
    expect(centralChip(link('synced', '2026-05-12T23:30:00Z'), LONDON).label).toBe(
      'Synced 13/05/2026',
    );
    expect(centralChip(link('synced', '2026-05-12T23:30:00Z'), 'UTC').label).toBe(
      'Synced 12/05/2026',
    );
  });

  it('says Linked when the date is not known', () => {
    expect(centralChip(link('synced', null), LONDON).label).toBe('Linked');
  });

  it('warns about a stale link and a client the service no longer knows', () => {
    expect(centralChip(link('stale'), LONDON)).toMatchObject({ label: 'Stale', tone: 'warning' });
    expect(centralChip(link('failed'), LONDON)).toMatchObject({
      label: 'Not found centrally',
      tone: 'danger',
    });
  });

  it('explains each state in its title', () => {
    expect(centralChip(link('local', null), LONDON).title).toContain('not linked');
    expect(centralChip(link('synced'), LONDON).title).toContain('managed there');
    expect(centralChip(link('stale'), LONDON).title).toContain('out of date');
  });
});

describe('link helpers', () => {
  const merged = { central_client_id: 'cen-1', merged_into_client_id: techwaveDetail.id };

  it('tells linked clients from local ones', () => {
    expect(isLinked({ central_client_id: 'cen-1' })).toBe(true);
    expect(isLinked({ central_client_id: null })).toBe(false);
  });

  it('tells merged-away clients', () => {
    expect(isMergedAway(merged)).toBe(true);
    expect(isMergedAway({ merged_into_client_id: null })).toBe(false);
  });

  it('only synchronises a linked client that was not merged away', () => {
    expect(canSync({ central_client_id: 'cen-1', merged_into_client_id: null })).toBe(true);
    expect(canSync({ central_client_id: null, merged_into_client_id: null })).toBe(false);
    expect(canSync(merged)).toBe(false);
  });
});

describe('managedFields', () => {
  it('lists the fields a 409 names', () => {
    expect(managedFields([{ field: 'name' }, { field: 'city', code: 'managed' }])).toEqual([
      'name',
      'city',
    ]);
  });

  it('ignores anything that is not a field entry', () => {
    expect(managedFields(null)).toEqual([]);
    expect(managedFields({ field: 'name' })).toEqual([]);
    expect(managedFields([{ field: 3 }, 'name', null, { other: 'x' }])).toEqual([]);
  });
});

describe('centralAddress', () => {
  it('joins what is there on one line', () => {
    expect(centralAddress(globex)).toBe('2 Mill Lane, Leeds, LS1 2AB');
  });

  it('is empty without an address', () => {
    expect(
      centralAddress({
        ...globex,
        address_line1: null,
        address_line2: null,
        city: null,
        postcode: null,
      }),
    ).toBe('');
  });
});

const synced = (fields: Partial<ClientSynced>): ClientSynced => ({
  client_id: 'c1',
  code: 'APX1',
  name: 'Globex Holdings plc',
  central_id: 'cen-1',
  state: 'synced',
  changed: false,
  changes: {},
  from_cache: false,
  message: null,
  synced_at: null,
  ...fields,
});

describe('describeSync', () => {
  it('names what changed', () => {
    expect(describeSync(synced({ changed: true, message: 'Address updated.' }))).toEqual({
      tone: 'success',
      title: 'Synchronised with central',
      description: 'Globex Holdings plc: Address updated.',
    });
  });

  it('has a default message when the service gave none', () => {
    expect(describeSync(synced({ changed: true })).description).toBe(
      'Globex Holdings plc: Name and address updated.',
    );
  });

  it('says nothing changed', () => {
    expect(describeSync(synced({}))).toEqual({
      tone: 'success',
      title: 'Already up to date',
      description: 'Globex Holdings plc',
    });
  });

  it('warns when the service was unavailable', () => {
    expect(describeSync(synced({ state: 'stale' }))).toMatchObject({
      tone: 'warning',
      title: 'Central service unavailable',
    });
  });

  it('reports a client the service does not know', () => {
    expect(describeSync(synced({ state: 'failed', message: 'Gone.' }))).toEqual({
      tone: 'error',
      title: 'Not found centrally',
      description: 'Gone.',
    });
  });
});

const all = (fields: Partial<CentralSyncAll>): CentralSyncAll => ({
  available: true,
  processed: 3,
  synced: 3,
  stale: 0,
  failed: 0,
  changed: 0,
  remaining: 0,
  results: [],
  ...fields,
});

describe('describeSyncAll', () => {
  it('says there was nothing to do', () => {
    expect(describeSyncAll(all({ processed: 0, synced: 0 }))).toEqual({
      tone: 'info',
      title: 'No linked clients to synchronise',
    });
  });

  it('says the service was unavailable and the clients were marked stale', () => {
    expect(describeSyncAll(all({ available: false, synced: 0, stale: 3 }))).toEqual({
      tone: 'warning',
      title: 'Central service unavailable',
      description: '3 linked clients were kept as they are and marked stale.',
    });
    expect(describeSyncAll(all({ available: false, processed: 1 })).description).toContain(
      '1 linked client was kept',
    );
  });

  it('counts what was synchronised and what changed', () => {
    expect(describeSyncAll(all({ changed: 1 }))).toEqual({
      tone: 'success',
      title: 'Synchronised 3 of 3 linked clients',
      description: '1 client changed.',
    });
  });

  it('warns about clients the service no longer knows and about the rest left over', () => {
    expect(describeSyncAll(all({ synced: 1, failed: 2, changed: 2, remaining: 4 }))).toEqual({
      tone: 'warning',
      title: 'Synchronised 1 of 3 linked clients',
      description: '2 clients changed · 2 not found centrally · 4 left: synchronise again.',
    });
  });
});

const enabled = (result: CentralEnabled['result'], fromCache = false): CentralEnabled => ({
  result,
  from_cache: fromCache,
  client: { ...techwaveDetail, name: 'Northwind Traders Ltd', code: 'APX200' },
});

describe('describeEnabled', () => {
  it('says a client was created', () => {
    expect(describeEnabled(enabled('created'))).toEqual({
      tone: 'success',
      title: 'Client created',
      description: 'Northwind Traders Ltd (APX200) was added to this practice.',
    });
  });

  it('says an existing client was linked', () => {
    expect(describeEnabled(enabled('linked_existing'))).toMatchObject({
      tone: 'success',
      title: 'Linked to your existing client',
    });
  });

  it('says the client was already enabled', () => {
    expect(describeEnabled(enabled('already_enabled'))).toEqual({
      tone: 'info',
      title: 'Already enabled',
      description: 'Northwind Traders Ltd (APX200) is already in this practice.',
    });
  });

  it('warns when cached details were used', () => {
    const notice = describeEnabled(enabled('created', true));
    expect(notice.tone).toBe('warning');
    expect(notice.description).toContain('cached details were used');
    expect(describeEnabled(enabled('linked_existing', true)).tone).toBe('warning');
  });
});
