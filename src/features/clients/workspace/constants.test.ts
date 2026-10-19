import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';

import { CLIENT_TABS, isClientTabId, visibleTabs } from './constants';
import { CLIENT_TAB_IDS } from './types';

const ids = (permissions: string[]) =>
  visibleTabs((permission) => permissions.includes(permission)).map((tab) => tab.id);

describe('the tabs of the client workspace', () => {
  it('are in the order the URL segments name them', () => {
    expect(CLIENT_TABS.map((tab) => tab.id)).toEqual([...CLIENT_TAB_IDS]);
    expect(CLIENT_TAB_IDS).toEqual([
      'overview',
      'jobs',
      'time',
      'expenses',
      'wip',
      'invoices',
      'payments',
      'contacts',
      'history',
      'settings',
    ]);
  });

  it('are all open to an owner', () => {
    expect(ids(OWNER_PERMISSIONS)).toEqual([...CLIENT_TAB_IDS]);
  });

  it('leave out WIP, invoices and payments for staff', () => {
    expect(ids(STAFF_PERMISSIONS)).toEqual([
      'overview',
      'jobs',
      'time',
      'expenses',
      'contacts',
      'settings',
    ]);
  });

  it('always include the overview, the contacts and the settings', () => {
    expect(ids([])).toEqual(['overview', 'contacts', 'settings']);
  });

  it('open Time to people who may log or read all time', () => {
    expect(ids(['time.log'])).toContain('time');
    expect(ids(['time.read_all'])).toContain('time');
    expect(ids(['job.read'])).not.toContain('time');
  });

  it('open Expenses to people who may log or manage disbursements, or read WIP', () => {
    expect(ids(['disbursement.log'])).toContain('expenses');
    expect(ids(['disbursement.manage'])).toContain('expenses');
    expect(ids(['wip.read'])).toEqual(expect.arrayContaining(['expenses', 'wip']));
    expect(ids(['job.read'])).not.toContain('expenses');
  });

  it('open Invoices and Payments on their own permissions', () => {
    expect(ids(['invoice.read'])).toContain('invoices');
    expect(ids(['invoice.read'])).not.toContain('payments');
    expect(ids(['payment.read'])).toContain('payments');
    expect(ids(['payment.read'])).not.toContain('invoices');
  });

  it('open History to people who read the audit log, and to nobody else', () => {
    expect(ids(['audit_log.read'])).toEqual(['overview', 'contacts', 'history', 'settings']);
    expect(ids(['client.read', 'audit_log.export'])).not.toContain('history');
    expect(ids(STAFF_PERMISSIONS)).not.toContain('history');
  });

  it('count their rows from the overview, where the caller may see them', () => {
    const counts = {
      jobs: 3,
      time_entries: 18,
      expenses: 2,
      wip: null,
      invoices: 4,
      payments: 3,
      contacts: 2,
    };
    const shown = Object.fromEntries(
      CLIENT_TABS.map((tab) => [tab.id, tab.count ? tab.count(counts) : undefined]),
    );
    expect(shown).toEqual({
      overview: undefined,
      jobs: 3,
      time: 18,
      expenses: 2,
      wip: null,
      invoices: 4,
      payments: 3,
      contacts: 2,
      settings: undefined,
    });
  });
});

describe('isClientTabId', () => {
  it('knows the tab segments', () => {
    for (const id of CLIENT_TAB_IDS) expect(isClientTabId(id)).toBe(true);
  });

  it('refuses anything else', () => {
    for (const value of ['', 'Overview', 'jobs/extra', 'services', 'rates', 'nonsense']) {
      expect(isClientTabId(value)).toBe(false);
    }
  });
});
