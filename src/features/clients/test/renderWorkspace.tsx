import { screen } from '@testing-library/react';
import type { HttpHandler } from 'msw';
import { Route, Routes } from 'react-router';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { server } from '@/test/server';

import ClientDetailPage from '../pages/ClientDetailPage';
import { Where } from './Where';
import { workspaceHandlers, type WorkspaceData } from './workspaceHandlers';

export interface RenderWorkspaceOptions extends WorkspaceData {
  permissions?: string[];
  /** Handlers that win over the workspace ones, for one test's scenario. */
  handlers?: HttpHandler[];
}

/** The Client 360 page at `route`, on the practice route and with the workspace's API mocked. */
export function renderWorkspace(
  route: string,
  { permissions = OWNER_PERMISSIONS, handlers = [], ...data }: RenderWorkspaceOptions = {},
) {
  server.use(...handlers, ...workspaceHandlers(data));
  return renderInOrg(
    <Routes>
      <Route
        path="/acme/clients/:clientId/*"
        element={
          <>
            <ClientDetailPage />
            <Where />
          </>
        }
      />
      <Route path="/acme/clients" element={<p>Client list</p>} />
    </Routes>,
    { route, context: contextWith(permissions) },
  );
}

/** The path the router is at (the tab is its last segment). */
export const where = () => screen.getByTestId('where');

/** The client card: other `<header>`s of the page (card headings) are banners too. */
export const header = () => {
  const found = screen.getByRole('heading', { level: 1 }).closest('header');
  if (!found) throw new Error('The client header is missing');
  return found;
};

export const heading = (name: string) => screen.findByRole('heading', { level: 1, name });

/** What the API client says for any 5xx, whatever the server wrote. */
export const SERVER_PROBLEM = 'Something went wrong on our side. Please try again.';
