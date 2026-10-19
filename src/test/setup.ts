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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  tokenStore.clear();
});

afterAll(() => server.close());
