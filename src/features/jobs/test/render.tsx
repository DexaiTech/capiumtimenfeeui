import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';

import { OWNER_PERMISSIONS, ownerContext } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';

import { Where } from './Where';

export const JOBS = '/acme/jobs';

export interface RenderOptions {
  permissions?: string[];
  /** The URL the page opens at. */
  route?: string;
  /** The route pattern the page is mounted on (needed for a page that reads `useParams`). */
  path?: string;
}

/**
 * Renders a page inside the practice at `route`, with stand-ins for the pages it links to, so
 * a click that navigates can be read from `Where`.
 */
export function renderJobPage(
  page: ReactElement,
  { permissions = OWNER_PERMISSIONS, route = JOBS, path = JOBS }: RenderOptions = {},
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
