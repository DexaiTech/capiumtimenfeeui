import { createContext, useContext, useMemo } from 'react';

import { createPermissions } from '@/hooks/usePermissions';
import type { Organization, OrganizationContext, RoleSummary } from '@/types/organization';

/** What `useOrg()` returns: the current practice and the caller's access in it. */
export interface OrgContextValue {
  organization: Organization;
  role: RoleSummary;
  permissions: readonly string[];
  /** UI gating only: the API checks every permission again. */
  can: (permission: string) => boolean;
  /** At least one of the codes (true for an empty list). */
  canAny: (permissions: ReadonlyArray<string>) => boolean;
}

export const OrgReactContext = createContext<OrgContextValue | null>(null);

/** Builds the context value from the API shape; memoised on the API object's identity. */
export function useOrgContextValue(context: OrganizationContext): OrgContextValue {
  return useMemo(() => {
    const { can, canAny } = createPermissions(context);
    return {
      organization: context.organization,
      role: context.role,
      permissions: context.permissions,
      can,
      canAny,
    };
  }, [context]);
}

/** The current practice, or null outside a practice route. */
export function useOptionalOrg(): OrgContextValue | null {
  return useContext(OrgReactContext);
}

/** The current practice. Throws outside the practice route (`/:orgSlug/...`). */
export function useOrg(): OrgContextValue {
  const value = useContext(OrgReactContext);
  if (!value) {
    throw new Error('useOrg must be used inside the practice route (or an <OrgProvider>)');
  }
  return value;
}
