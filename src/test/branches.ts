import { http, type HttpHandler } from 'msw';

import type { Branch } from '@/features/settings';
import type { OrganizationContext } from '@/types/organization';

import { ownerContext } from './orgFixtures';
import { orgApiPath } from './renderInOrg';
import { fail, ok } from './server';

export { orgApiPath };

const STAMP = '2026-10-01T09:00:00Z';

export function branch(id: string, name: string, extra: Partial<Branch> = {}): Branch {
  return {
    id,
    name,
    is_active: true,
    client_count: 0,
    can_delete: true,
    created_at: STAMP,
    updated_at: STAMP,
    ...extra,
  };
}

export const london = branch('0198c1f2-0000-7000-8000-0000000b0001', 'London', {
  client_count: 2,
  can_delete: false,
});
export const leeds = branch('0198c1f2-0000-7000-8000-0000000b0002', 'Leeds');
export const bath = branch('0198c1f2-0000-7000-8000-0000000b0003', 'Bath', { is_active: false });

export const testBranches: Branch[] = [bath, leeds, london];

/** The owner's context in a practice that uses branches (APT74). */
export const branchesOnContext: OrganizationContext = {
  ...ownerContext,
  organization: { ...ownerContext.organization, branches_enabled: true },
};

/** The requests the fake API has seen, for assertions on exact bodies. */
export interface BranchCalls {
  creates: Array<{ name: string }>;
  updates: Array<{ id: string; body: Partial<Pick<Branch, 'name' | 'is_active'>> }>;
  deletes: string[];
}

export function newBranchCalls(): BranchCalls {
  return { creates: [], updates: [], deletes: [] };
}

/**
 * A fake of the branch endpoints that keeps its own state: what a test creates, renames or deletes
 * shows up in the next list.
 */
export function branchHandlers(
  initial: Branch[] = testBranches,
  calls: BranchCalls = newBranchCalls(),
): HttpHandler[] {
  let branches = initial.map((entry) => ({ ...entry }));
  return [
    http.get(orgApiPath('/branches'), () => ok(branches)),
    http.post(orgApiPath('/branches'), async ({ request }) => {
      const body = (await request.json()) as { name: string };
      calls.creates.push(body);
      if (branches.some((entry) => entry.name.toLowerCase() === body.name.toLowerCase())) {
        const message = 'A branch with this name already exists.';
        return fail(409, 'BRANCH_NAME_TAKEN', message, {
          details: [{ field: 'name', code: 'duplicate', message }],
        });
      }
      const created = branch(`br-${branches.length + 1}`, body.name);
      branches = [...branches, created];
      return ok(created, { status: 201 });
    }),
    http.patch(orgApiPath('/branches/:id'), async ({ params, request }) => {
      const body = (await request.json()) as Partial<Pick<Branch, 'name' | 'is_active'>>;
      const id = String(params.id);
      calls.updates.push({ id, body });
      const current = branches.find((entry) => entry.id === id);
      if (!current) return fail(404, 'NOT_FOUND', 'Branch not found.');
      const next = { ...current, ...body };
      branches = branches.map((entry) => (entry.id === id ? next : entry));
      return ok(next);
    }),
    http.delete(orgApiPath('/branches/:id'), ({ params }) => {
      const id = String(params.id);
      calls.deletes.push(id);
      const current = branches.find((entry) => entry.id === id);
      if (!current) return fail(404, 'NOT_FOUND', 'Branch not found.');
      if (current.client_count) {
        branches = branches.map((entry) =>
          entry.id === id ? { ...entry, is_active: false } : entry,
        );
        return ok({ outcome: 'deactivated', id });
      }
      branches = branches.filter((entry) => entry.id !== id);
      return ok({ outcome: 'deleted', id });
    }),
  ];
}
