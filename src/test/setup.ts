import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { tokenStore } from '@/services/api';

import { server } from './server';

// The default 1 s is too tight when every test file runs in parallel on a busy machine.
configure({ asyncUtilTimeout: 5000 });

// jsdom has no matchMedia; components only need a stable "does not match".
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

// jsdom has no layout. ProseMirror (the rich text editor) asks for client rects and for the
// element under a point while it handles a selection: an empty answer is enough for the tests.
const noRects = (): DOMRectList => {
  const list = Object.assign([] as DOMRect[], { item: () => null });
  return list;
};
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = noRects;
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
}
if (!Element.prototype.getClientRects) Element.prototype.getClientRects = noRects;
if (!document.elementFromPoint) document.elementFromPoint = () => null;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  tokenStore.clear();
});

afterAll(() => server.close());
