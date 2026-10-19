import { useMemo } from 'react';

import type { OrganizationContext } from '@/types/organization';

export interface Permissions {
  /** The caller holds this permission code in the practice. */
  can: (permission: string) => boolean;
  /** The caller holds at least one of the codes (true for an empty list). */
  canAny: (permissions: ReadonlyArray<string>) => boolean;
  /** The caller holds every one of the codes. */
  canAll: (permissions: ReadonlyArray<string>) => boolean;
}

/** Builds the permission checks of a practice context; pure, for use outside React too. */
export function createPermissions(
  context: Pick<OrganizationContext, 'permissions'> | null | undefined,
): Permissions {
  const held = new Set(context?.permissions ?? []);
  const can = (permission: string) => held.has(permission);
  return {
    can,
    canAny: (permissions) => permissions.length === 0 || permissions.some(can),
    canAll: (permissions) => permissions.every(can),
  };
}

/**
 * Permission checks of a practice context (the response of `GET /organizations/by-slug/{slug}`).
 * UI gating only: the API checks every permission again. Memoised on the context's identity.
 */
export function usePermissions(
  context: Pick<OrganizationContext, 'permissions'> | null | undefined,
): Permissions {
  return useMemo(() => createPermissions(context), [context]);
}
