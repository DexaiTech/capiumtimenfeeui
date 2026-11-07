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

function renderShell(route = '/acme/dashboard/overview', permissions = ownerContext.permissions) {
  const context = contextWith(permissions);
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
  it('lists the pages of the current module, while the modules stay in the top bar', () => {
    renderShell('/acme/billing/invoices');
    const pages = within(sidebar()).getByRole('navigation', { name: 'Billing & Fees pages' });
    expect(within(pages).getByRole('link', { name: /^Invoices$/ })).toBeInTheDocument();
    expect(within(pages).getByRole('link', { name: /^Payments$/ })).toBeInTheDocument();
    expect(within(pages).queryByRole('link', { name: /Clients/ })).not.toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(within(tabs).getByRole('link', { name: /Clients/ })).toBeInTheDocument();
  });

  it('marks the current page', () => {
    renderShell('/acme/billing/payments');
    const current = within(sidebar())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Payments');
  });

  it('has no sidebar for a module without pages to choose from', () => {
    renderShell('/acme/clients/list');
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).not.toBeInTheDocument();
  });

  it('has no sidebar for a module where the role may open one page only', () => {
    // Disbursements is the one Expenses page someone who only reads WIP may open.
    renderShell('/acme/expenses/disbursements', ['organization.read', 'wip.read']);
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).not.toBeInTheDocument();
  });

  it('marks one page only on a page below a module index', () => {
    // NavLink used to mark Expense Claims (the index, at /expenses) on every Expenses page too.
    renderShell('/acme/expenses/approvals');
    const marked = within(sidebar())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(marked.map((link) => link.textContent)).toEqual(['Expense Approvals']);
  });

  it('keeps Expense Claims marked on a claim', () => {
    renderShell('/acme/expenses/claims/claim-1');
    const pages = within(sidebar()).getByRole('navigation', { name: 'Expenses pages' });
    expect(within(pages).getByRole('link', { name: 'Expense Claims' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('collapses to icons, keeps every link named, and remembers the choice', async () => {
    const user = userEvent.setup();
    renderShell('/acme/billing/invoices');
    await user.click(within(sidebar()).getByRole('button', { name: 'Collapse the sidebar' }));
    expect(useShellStore.getState().sidebarCollapsed).toBe(true);
    expect(window.localStorage.getItem('capium.sidebar.collapsed')).toBe('1');
    expect(within(sidebar()).getByRole('link', { name: 'Invoices' })).toBeInTheDocument();

    await user.click(within(sidebar()).getByRole('button', { name: 'Expand the sidebar' }));
    expect(useShellStore.getState().sidebarCollapsed).toBe(false);
  });

  // Settings has two runs of pages headed "Practice": they once shared a key, and the menu
  // repeated its first pages as it re-rendered.
  it('lists each Settings page once while moving between pages', async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, 'error');
    renderShell('/acme/settings/general');
    const pages = () => within(sidebar()).getByRole('navigation', { name: 'Settings pages' });
    const headings = within(pages()).getAllByText('Practice', { exact: true }).length;

    for (const name of ['Branches', 'Roles & Permissions', 'Services', 'General Settings']) {
      await user.click(within(pages()).getByRole('link', { name }));
      const labels = within(pages())
        .getAllByRole('link')
        .map((link) => link.textContent);
      expect(new Set(labels).size).toBe(labels.length);
      expect(within(pages()).getAllByText('Practice', { exact: true })).toHaveLength(headings);
    }
    const keyWarnings = errors.mock.calls.filter((call) =>
      call.some((part) => String(part).includes('same key')),
    );
    expect(keyWarnings).toEqual([]);
  });
});
