import type { ReactNode } from 'react';

import type { OrganizationContext } from '@/types/organization';

import { OrgReactContext, useOrgContextValue } from '../orgContext';

export interface OrgProviderProps {
  value: OrganizationContext;
  children: ReactNode;
}

/**
 * Provides the organization context. The organization route renders it with the
 * resolved organization; unit tests render it directly, without the router.
 */
export function OrgProvider({ value, children }: OrgProviderProps) {
  const contextValue = useOrgContextValue(value);
  return <OrgReactContext.Provider value={contextValue}>{children}</OrgReactContext.Provider>;
}
