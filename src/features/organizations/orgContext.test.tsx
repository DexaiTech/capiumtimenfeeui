import { render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/constants/queryKeys';
import { contextWith, ownerContext } from '@/test/orgFixtures';

import { Can, OrgProvider, useOptionalOrg, useOrg } from './index';

const wrapper =
  (permissions: string[]) =>
  ({ children }: { children: ReactNode }) => (
    <OrgProvider value={contextWith(permissions)}>{children}</OrgProvider>
  );

describe('useOrg', () => {
  it('throws outside the practice route', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useOrg())).toThrow(/practice route/);
    consoleError.mockRestore();
  });

  it('returns the practice, the role and the permission checks', () => {
    const { result } = renderHook(() => useOrg(), { wrapper: wrapper(['member.read']) });
    expect(result.current.organization).toEqual(ownerContext.organization);
    expect(result.current.role.name).toBe('Owner');
    expect(result.current.permissions).toEqual(['member.read']);
    expect(result.current.can('member.read')).toBe(true);
    expect(result.current.can('member.invite')).toBe(false);
    expect(result.current.canAny(['member.invite', 'member.read'])).toBe(true);
    expect(result.current.canAny([])).toBe(true);
  });
});

describe('useOptionalOrg', () => {
  it('is null outside a practice and the context inside one', () => {
    expect(renderHook(() => useOptionalOrg()).result.current).toBeNull();
    const inside = renderHook(() => useOptionalOrg(), { wrapper: wrapper([]) });
    expect(inside.result.current?.organization.slug).toBe('acme');
  });
});

describe('Can', () => {
  it('renders its children only with the permission, else the fallback', () => {
    render(
      <OrgProvider value={contextWith(['member.invite'])}>
        <Can permission="member.invite">
          <button type="button">Add staff</button>
        </Can>
        <Can permission="role.manage" fallback={<span>No access to roles</span>}>
          <button type="button">New role</button>
        </Can>
        <Can permission="audit_log.read">
          <span>Audit log</span>
        </Can>
      </OrgProvider>,
    );
    expect(screen.getByRole('button', { name: 'Add staff' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New role' })).not.toBeInTheDocument();
    expect(screen.getByText('No access to roles')).toBeInTheDocument();
    expect(screen.queryByText('Audit log')).not.toBeInTheDocument();
  });
});

describe('practice query keys', () => {
  it('starts every key with the practice id', () => {
    expect(queryKeys.org.all('org-1')).toEqual(['org', 'org-1']);
    for (const key of [
      queryKeys.org.detail('org-1'),
      queryKeys.org.members('org-1'),
      queryKeys.org.roles('org-1'),
      queryKeys.org.auditLogs('org-1'),
      queryKeys.org.clients('org-1'),
      queryKeys.org.invoices('org-1'),
    ]) {
      expect(key.slice(0, 2)).toEqual(['org', 'org-1']);
    }
  });
});
