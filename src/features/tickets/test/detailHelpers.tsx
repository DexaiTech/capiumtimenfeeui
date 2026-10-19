import { fireEvent } from '@testing-library/react';
import { http } from 'msw';
import { Route, Routes } from 'react-router';
import { vi } from 'vitest';

import { contextWith, OWNER_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';
import { ok } from '@/test/server';

import TicketDetailPage from '../pages/TicketDetailPage';
import type { TicketAttachment, TicketDetail } from '../types';
import { ada, apt1, apt1Detail } from './fixtures';
import { orgApiPath } from './handlers';

export const TICKETS = '/acme/application-testing/tickets';

/** The ticket page at `/acme/application-testing/tickets/:ticketId`, with a stand-in for the list. */
export function renderDetail(permissions: string[] = OWNER_PERMISSIONS, ticketId = apt1.id) {
  return renderInOrg(
    <Routes>
      <Route path={`${TICKETS}/:ticketId`} element={<TicketDetailPage />} />
      <Route path={TICKETS} element={<p>Ticket list</p>} />
    </Routes>,
    { context: contextWith(permissions), route: `${TICKETS}/${ticketId}` },
  );
}

/** A copy of the detail, so that a handler can change it the way the API would. */
export const freshDetail = (): TicketDetail => structuredClone(apt1Detail);

/** `PATCH /tickets/{id}`: records the body, applies it to `detail` and answers with the result. */
export function patchTicket(detail: TicketDetail, bodies: unknown[] = []) {
  return http.patch(orgApiPath('/tickets/:ticketId'), async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    bodies.push(body);
    Object.assign(detail, body);
    return ok(detail);
  });
}

/** The attachment a test uploads: a small CSV of the signed-in person. */
export const notesCsv: TicketAttachment = {
  id: '01a14ced-fe5d-71f8-a620-e9700fdbf378',
  ticket_id: apt1.id,
  comment_id: null,
  file_name: 'notes.csv',
  content_type: 'text/csv',
  size_bytes: 7,
  is_image: false,
  uploaded_by: ada.id,
  uploaded_by_name: ada.full_name,
  created_at: '2026-10-18T11:00:00Z',
};

export const csvFile = () => new File(['a,b\n1,2'], 'notes.csv', { type: 'text/csv' });
export const pngFile = (name = 'image.png') =>
  new File([new Uint8Array(69)], name, { type: 'image/png' });

/** Chooses files in the hidden input of the drop zone (the way the file dialog would hand them over). */
export function chooseFiles(...files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('There is no file input on the page');
  fireEvent.change(input, { target: { files } });
}

/** jsdom has no blob URLs: records what the page creates and releases. */
export function installObjectUrls() {
  const created: string[] = [];
  const revoked: string[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => {
      const url = `blob:test/${String(created.length + 1)}`;
      created.push(url);
      return url;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn((url: string) => {
      revoked.push(url);
    }),
  });
  return {
    created,
    revoked,
    restore: () => {
      Reflect.deleteProperty(URL, 'createObjectURL');
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    },
  };
}
