import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';

import { OWNER_PERMISSIONS, contextWith } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';

import TicketsListPage from '../pages/TicketsListPage';
import { Where } from './Where';

export const LIST = '/acme/application-testing/tickets';

/** The list page at `route`, with a stand-in for the ticket page it links to. */
export function renderList(permissions: string[] = OWNER_PERMISSIONS, route = LIST) {
  return renderInOrg(
    <Routes>
      <Route
        path={LIST}
        element={
          <>
            <TicketsListPage />
            <Where />
          </>
        }
      />
      <Route
        path={`${LIST}/:ticketId`}
        element={
          <>
            <p>Ticket page</p>
            <Where />
          </>
        }
      />
    </Routes>,
    { context: contextWith(permissions), route },
  );
}

export const where = () => screen.getByTestId('where').textContent;

/** The codes of the rows, in the order they are shown. */
export const codes = () =>
  screen.getAllByRole('link', { name: /^APT\d+$/ }).map((link) => link.textContent);

export function rowOf(code: string): HTMLElement {
  const row = screen.getByRole('link', { name: code }).closest('tr');
  if (!row) throw new Error(`No row for ${code}`);
  return row;
}
