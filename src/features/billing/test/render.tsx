import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';

import { OWNER_PERMISSIONS, ownerContext } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import type { Organization } from '@/types/organization';

import { Where } from './Where';

export const BILLING = '/acme/billing';

export interface RenderOptions {
  permissions?: string[];
  /** Settings of the practice that differ from the test practice's. */
  organization?: Partial<Organization>;
  /** The URL the page opens at. */
  route?: string;
  /** The route pattern the page is mounted on. */
  path?: string;
}

/** Renders a page inside the practice, with a stand-in for every page it links to. */
export function renderBillingPage(
  page: ReactElement,
  {
    permissions = OWNER_PERMISSIONS,
    organization,
    route = BILLING,
    path = BILLING,
  }: RenderOptions = {},
) {
  return renderInOrg(
    <>
      <Routes>
        <Route path={path} element={page} />
        <Route path="*" element={<p>Another page</p>} />
      </Routes>
      <Where />
    </>,
    {
      context: {
        ...ownerContext,
        permissions,
        organization: { ...ownerContext.organization, ...organization },
      },
      route,
    },
  );
}
