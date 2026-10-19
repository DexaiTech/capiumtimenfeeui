import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';

import { OWNER_PERMISSIONS, ownerContext } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';

import { Where } from './Where';

export const REPORTS = '/acme/reports';

export interface RenderOptions {
  permissions?: string[];
  /** The URL the page opens at. */
  route?: string;
  /** The route pattern the page is mounted on. */
  path?: string;
}

/** Renders a report inside the practice, with a stand-in for every page it links to. */
export function renderReportPage(
  page: ReactElement,
  { permissions = OWNER_PERMISSIONS, route = REPORTS, path = REPORTS }: RenderOptions = {},
) {
  return renderInOrg(
    <>
      <Routes>
        <Route path={path} element={page} />
        <Route path="*" element={<p>Another page</p>} />
      </Routes>
      <Where />
    </>,
    { context: { ...ownerContext, permissions }, route },
  );
}
