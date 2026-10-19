import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

// Test wiring only: the context object is not part of the auth feature's public surface.
// eslint-disable-next-line no-restricted-imports
import { AuthContext } from '@/features/auth/authContext';
import { OrgProvider, type OrganizationContext } from '@/features/organizations';
import { testUser } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import type { User } from '@/types/models';

import { orgContext } from './fixtures';

export interface RenderSettingsOptions {
  /** The caller's organization context; the Owner with every permission by default. */
  context?: OrganizationContext;
  user?: User;
  route?: string;
}

/** Renders a settings page the way the shell does: signed in, inside an organization. */
export function renderSettings(
  ui: ReactElement,
  { context = orgContext(), user = testUser, route = '/' }: RenderSettingsOptions = {},
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

/**
 * jsdom reports no media query as matching, which is the mobile (card and bottom-sheet)
 * layout. Call this to render the md-and-up layout instead; `restoreMocks` undoes it.
 */
export function mockDesktopViewport() {
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
