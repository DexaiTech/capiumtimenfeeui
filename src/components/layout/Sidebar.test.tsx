import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildShellData } from '@/app/router/shellData';
import { useShellStore } from '@/app/store';
import { testUser } from '@/test/fixtures';
import { contextWith, memberContext, ownerContext } from '@/test/orgFixtures';
import { renderWithProviders } from '@/test/render';

import { AppShell } from './AppShell';

/** Makes the viewport a desktop one, so the shell shows the sidebar. */
function useDesktop() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('min-width: 64rem'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  useShellStore.setState({ drawerOpen: false, searchOpen: false, sidebarCollapsed: false });
  useDesktop();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderShell(route = '/acme/dashboard/overview') {
  const context = contextWith(ownerContext.permissions);
  const shell = buildShellData({
    context,
    organizations: [context, memberContext],
    roleName: (role) => role.name,
    canSwitchPractice: true,
    canCreatePractice: false,
  });
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell user={testUser} onLogout={vi.fn()} shell={shell} />}>
        <Route path="*" element={<p>page</p>} />
      </Route>
    </Routes>,
    { route },
  );
}

const sidebar = () => screen.getByRole('complementary', { name: 'Sidebar' });

describe('Sidebar', () => {
  it('lists the modules on the left and not in the top bar', () => {
    renderShell();
    const nav = within(sidebar()).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('button', { name: /Dashboard/ })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Clients/ })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });

  it('opens a module to its pages and marks the current page', async () => {
    const user = userEvent.setup();
    renderShell('/acme/clients/list');
    const group = within(sidebar()).getByRole('button', { name: /Clients/ });
    expect(group).toHaveAttribute('aria-expanded', 'true');
    const current = within(sidebar())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);

    await user.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses to icons, keeps every link named, and remembers the choice', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(within(sidebar()).getByRole('button', { name: 'Collapse the sidebar' }));
    expect(useShellStore.getState().sidebarCollapsed).toBe(true);
    expect(window.localStorage.getItem('capium.sidebar.collapsed')).toBe('1');
    expect(within(sidebar()).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();

    await user.click(within(sidebar()).getByRole('button', { name: 'Expand the sidebar' }));
    expect(useShellStore.getState().sidebarCollapsed).toBe(false);
  });
});
