import { fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { vi } from 'vitest';

import { OWNER_PERMISSIONS, ownerContext } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';

import { expensePractice } from './fixtures';
import { Where } from './Where';

export const EXPENSES = '/acme/expenses';

export interface RenderOptions {
  permissions?: string[];
  /** The URL the page opens at. */
  route?: string;
  /** The route pattern the page is mounted on (needed for a page that reads `useParams`). */
  path?: string;
}

/** The practice context of the tests: the expense settings come with the practice. */
export const contextFor = (permissions: string[]) => ({
  ...ownerContext,
  organization: expensePractice,
  permissions,
});

/**
 * Renders a page inside the practice at `route`, with stand-ins for the pages it links to, so
 * a click that navigates can be read from `Where`.
 */
export function renderExpensePage(
  page: ReactElement,
  { permissions = OWNER_PERMISSIONS, route = EXPENSES, path = EXPENSES }: RenderOptions = {},
) {
  return renderInOrg(
    <>
      <Routes>
        <Route path={path} element={page} />
        <Route path="*" element={<p>Another page</p>} />
      </Routes>
      <Where />
    </>,
    { context: contextFor(permissions), route },
  );
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

export const pngFile = (name = 'taxi.png') =>
  new File([new Uint8Array(69)], name, { type: 'image/png' });
export const pdfFile = (name = 'invoice.pdf') =>
  new File(['%PDF-1.4'], name, { type: 'application/pdf' });

/** Chooses files in the hidden input of the upload zone, as the file dialog would hand them over. */
export function chooseReceipts(...files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('There is no file input on the page');
  fireEvent.change(input, { target: { files } });
}

/** The table of the Table primitive is a real table only from the md breakpoint up. */
export function useDesktopLayout() {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string): MediaQueryList => ({
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}
