import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

import { AuthContext } from '@/features/auth/authContext';
import { OrgProvider, type OrganizationContext } from '@/features/organizations';
import type { User } from '@/types/models';

import { testUser } from './fixtures';
import { ownerContext } from './orgFixtures';
import { renderWithProviders } from './render';
import { apiPath } from './server';

export interface RenderInOrgOptions {
  context?: OrganizationContext;
  user?: User;
  route?: string;
}

/** A path under the test practice, for MSW handlers. */
export const orgApiPath = (path: string, context: OrganizationContext = ownerContext) =>
  apiPath(`/organizations/${context.organization.id}${path}`);

/** Renders the way the practice route does: signed in, inside a practice. */
export function renderInOrg(
  ui: ReactElement,
  { context = ownerContext, user = testUser, route = '/' }: RenderInOrgOptions = {},
): RenderResult {
  return renderWithProviders(
    <AuthContext.Provider
      value={{
        status: 'authenticated',
        user,
        lastEndReason: null,
        bootstrapError: null,
        retryBootstrap: () => undefined,
        logout: () => Promise.resolve(),
        clearSession: () => undefined,
        refreshUser: () => Promise.resolve(),
      }}
    >
      <OrgProvider value={context}>{ui}</OrgProvider>
    </AuthContext.Provider>,
    { route },
  );
}
