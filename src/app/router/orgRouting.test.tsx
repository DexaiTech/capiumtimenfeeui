import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOrgPreferenceStore } from '@/app/store';
import {
  contextWith,
  memberContext,
  mockOrganizations,
  ownerContext,
  STAFF_PERMISSIONS,
} from '@/test/orgFixtures';
import { renderApp, resetAppStores } from '@/test/renderApp';

// The pages are built and tested in their features; here only the routing matters, so every page
// of the navigation is a stub that shows its title (no page needs a mock of its own).
vi.mock('./pageLoaders', async () => {
  const { NAV_MODULES } = await import('@/constants/navigation');
  const stub = (title: string) => () => Promise.resolve({ default: () => <h1>{title}</h1> });
  const titles: Record<string, string> = {
    'clients/list': 'Clients',
    'dashboard/overview': 'Dashboard',
  };
  return {
    PAGE_LOADERS: Object.fromEntries(
      NAV_MODULES.map((module) => [
        module.id,
        Object.fromEntries(
          module.pages.map((entry) => [
            entry.id,
            stub(titles[`${module.id}/${entry.id}`] ?? entry.label),
          ]),
        ),
      ]),
    ),
    DETAIL_ROUTES: {
      clients: [{ path: ':clientId/*', pageId: 'client-360', load: stub('Client detail') }],
      jobs: [{ path: ':jobId', pageId: 'job-details', load: stub('Job') }],
      billing: [{ path: 'invoices/:invoiceId', pageId: 'invoices', load: stub('Invoice') }],
    },
  };
});

beforeEach(resetAppStores);

const mainNav = () => {
  const nav = screen.getAllByRole('navigation', { name: 'Main' })[0];
  if (!nav) throw new Error('no main navigation');
  return nav;
};

const topBarLinks = () =>
  within(mainNav())
    .queryAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);

describe('post-login practice resolution (/app)', () => {
  it('opens the practice used last', async () => {
    mockOrganizations([ownerContext, memberContext]);
    useOrgPreferenceStore.setState({ lastOrgSlug: 'globex' });
    const { router } = renderApp('/app');

    await waitFor(() => expect(router.state.location.pathname).toBe('/globex/dashboard/overview'));
    expect(await screen.findByText('Globex Tax', { selector: 'span' })).toBeInTheDocument();
  });

  it('opens the first practice when the remembered one is not among the memberships', async () => {
    mockOrganizations([ownerContext, memberContext]);
    useOrgPreferenceStore.setState({ lastOrgSlug: 'somebody-elses' });
    const { router } = renderApp('/app');

    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/dashboard/overview'));
    // Opening a practice remembers it for next time.
    await waitFor(() => expect(useOrgPreferenceStore.getState().lastOrgSlug).toBe('acme'));
  });

  it('sends a user without practices to onboarding', async () => {
    mockOrganizations([]);
    const { router } = renderApp('/app');

    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
    expect(await screen.findByRole('heading', { name: 'Create a practice' })).toBeInTheDocument();
  });

  it('asks an anonymous visitor to sign in and remembers the page', async () => {
    const { router } = renderApp('/acme/settings/practice', { user: null });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Facme%2Fsettings%2Fpractice');
  });
});

describe('practice route (/:orgSlug)', () => {
  it('shows a not-found state for an unknown practice or a non-member', async () => {
    mockOrganizations([ownerContext]);
    useOrgPreferenceStore.setState({ lastOrgSlug: 'nope' });
    renderApp('/nope/clients');

    expect(await screen.findByRole('heading', { name: 'Practice not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your practice' })).toHaveAttribute(
      'href',
      '/app',
    );
    // No practice navigation is offered for a practice that could not be opened.
    expect(screen.queryByRole('link', { name: 'Clients' })).not.toBeInTheDocument();
    // A remembered practice that is gone is forgotten.
    await waitFor(() => expect(useOrgPreferenceStore.getState().lastOrgSlug).toBeNull());
  });

  it('opens the dashboard at the practice root', async () => {
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/acme');
    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/dashboard/overview'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('shows the ten modules with the slug and marks the current one', async () => {
    mockOrganizations([ownerContext]);
    renderApp('/acme/clients');
    await screen.findByRole('heading', { level: 1, name: 'Clients' });

    expect(topBarLinks().map(([label]) => label)).toEqual([
      'Dashboard',
      'Clients',
      'Time',
      'Jobs',
      'Expenses',
      'Work in Progress',
      'Billing & Fees',
      'Reports',
      'Team & Rates',
      'Settings',
    ]);
    expect(within(mainNav()).getByRole('link', { name: 'Clients' })).toHaveAttribute(
      'href',
      '/acme/clients',
    );
    expect(within(mainNav()).getByRole('link', { name: 'Clients' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Clients opens straight on its list: no secondary bar.
    expect(screen.queryByRole('navigation', { name: 'Clients pages' })).not.toBeInTheDocument();
  });

  it('opens a client inside the Clients module', async () => {
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/acme/clients/c-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Client detail' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/acme/clients/c-1');
    expect(within(mainNav()).getByRole('link', { name: 'Clients' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('tells a role without client.read that Clients is not included, and hides it', async () => {
    mockOrganizations([contextWith(['organization.read', 'member.read'])]);
    renderApp('/acme/clients');

    expect(
      await screen.findByRole('heading', { name: 'Your role does not include this page' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the dashboard' })).toHaveAttribute(
      'href',
      '/acme/dashboard',
    );
    expect(topBarLinks().map(([label]) => label)).not.toContain('Clients');
    // It says which permission the page needs, so the person can ask for exactly that.
    expect(screen.getByText(/needs permission to: View client/)).toBeInTheDocument();
  });

  it('guards a page with the rule its secondary bar uses', async () => {
    // The Staff role does not include the audit log.
    mockOrganizations([contextWith(STAFF_PERMISSIONS)]);
    renderApp('/acme/settings/audit-logs');

    expect(
      await screen.findByRole('heading', { name: 'Your role does not include this page' }),
    ).toBeInTheDocument();
    expect(topBarLinks().map(([label]) => label)).toContain('Clients');
  });

  it('turns away a role without access to a module', async () => {
    mockOrganizations([contextWith(['client.read'])]);
    renderApp('/acme/settings/vat-codes');
    expect(
      await screen.findByRole('heading', { name: 'Your role does not include this page' }),
    ).toBeInTheDocument();
  });

  it('leads a module index to the first page the role may open', async () => {
    mockOrganizations([contextWith(['settings.manage', 'rate.read'])]);
    const { router } = renderApp('/acme/settings');
    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/settings/period-lock'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lock Past Periods' }),
    ).toBeInTheDocument();
  });

  it('moves between the pages of a module with the secondary bar', async () => {
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/acme/settings/general');
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'General Settings' });

    const bar = screen.getByRole('navigation', { name: 'Settings pages' });
    await user.click(within(bar).getByRole('link', { name: 'VAT Codes' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/settings/vat-codes'));
    expect(await screen.findByRole('heading', { level: 1, name: 'VAT Codes' })).toBeInTheDocument();
    expect(within(bar).getByRole('link', { name: 'VAT Codes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the reports of the caller in a grouped sidebar instead of the secondary bar', async () => {
    mockOrganizations([contextWith(['report.read'])]);
    const { router } = renderApp('/acme/reports');
    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/reports/time-analysis'));

    const sidebar = await screen.findByRole('navigation', { name: 'Reports pages' });
    expect(within(sidebar).getByRole('link', { name: 'Time Analysis Report' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar).getByRole('link', { name: 'Utilisation' })).toBeInTheDocument();
    // Financial reports need report.financial, which this role does not hold.
    expect(within(sidebar).queryByRole('link', { name: 'Billing Report' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Reports pages' })).toHaveLength(1);
  });

  it('shows the billing pages of the caller in a grouped sidebar', async () => {
    mockOrganizations([contextWith(['invoice.read'])]);
    const { router } = renderApp('/acme/billing');
    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/billing/invoices'));

    const sidebar = await screen.findByRole('navigation', { name: 'Billing & Fees pages' });
    expect(within(sidebar).getByRole('link', { name: 'Invoices' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar).getByRole('link', { name: 'Credit Notes' })).toBeInTheDocument();
    // Preparing an invoice needs invoice.create, which this role does not hold.
    expect(within(sidebar).queryByRole('link', { name: 'Create Invoice' })).not.toBeInTheDocument();
  });

  it('has no Create Invoice entry in the Billing menu; Invoices stays marked while one is created', async () => {
    mockOrganizations([contextWith(['invoice.read', 'invoice.create', 'client.read', 'wip.read'])]);
    renderApp('/acme/billing/prepare');

    const sidebar = await screen.findByRole('navigation', { name: 'Billing & Fees pages' });
    expect(within(sidebar).queryByRole('link', { name: 'Create Invoice' })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Invoices' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows the work in progress pages in a grouped sidebar with only the current page marked', async () => {
    mockOrganizations([contextWith(['wip.read'])]);
    renderApp('/acme/wip/details');

    const sidebar = await screen.findByRole('navigation', { name: 'Work in Progress pages' });
    expect(within(sidebar).getByRole('link', { name: 'WIP Details' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // The index page (/wip) must not stay marked on its sibling pages.
    expect(within(sidebar).getByRole('link', { name: 'WIP Summary' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows the expense pages of the caller in a grouped sidebar', async () => {
    mockOrganizations([contextWith(['expense.log'])]);
    renderApp('/acme/expenses/mine');

    const sidebar = await screen.findByRole('navigation', { name: 'Expenses pages' });
    expect(within(sidebar).getByRole('link', { name: 'My Expenses' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Approving claims needs expense.approve, which this role does not hold.
    expect(
      within(sidebar).queryByRole('link', { name: 'Expense Approvals' }),
    ).not.toBeInTheDocument();
  });

  it('keeps Job List marked in the jobs sidebar while a job is open, and offers no Job Details page', async () => {
    mockOrganizations([contextWith(['job.read'])]);
    renderApp('/acme/jobs/6f1c2b9e-0000-4000-8000-000000000001');

    const sidebar = await screen.findByRole('navigation', { name: 'Jobs pages' });
    expect(within(sidebar).getByRole('link', { name: 'Job List' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // A job is opened from the list: the picker page is not offered in the menu.
    expect(within(sidebar).queryByRole('link', { name: 'Job Details' })).not.toBeInTheDocument();
  });

  it('shows the time pages of the caller in a grouped sidebar', async () => {
    mockOrganizations([contextWith(['time.log'])]);
    renderApp('/acme/time/entries');

    const sidebar = await screen.findByRole('navigation', { name: 'Time pages' });
    expect(within(sidebar).getByRole('link', { name: 'Time Entries' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar).getByRole('link', { name: 'My Timesheet' })).not.toHaveAttribute(
      'aria-current',
    );
    // Approving timesheets needs timesheet.approve, which this role does not hold.
    expect(
      within(sidebar).queryByRole('link', { name: 'Timesheet Approvals' }),
    ).not.toBeInTheDocument();
  });

  it('shows the dashboard pages of the caller in a grouped sidebar', async () => {
    mockOrganizations([contextWith(['time.log'])]);
    renderApp('/acme/dashboard/my-timesheet');

    const sidebar = await screen.findByRole('navigation', { name: 'Dashboard pages' });
    expect(within(sidebar).getByRole('link', { name: 'My Timesheet' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar).getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    // Billing trend needs report.financial or invoice.read, which this role does not hold.
    expect(within(sidebar).queryByRole('link', { name: 'Billing Trend' })).not.toBeInTheDocument();
  });

  it('opens the practice settings from the practice menu', async () => {
    mockOrganizations([ownerContext]);
    const { router } = renderApp('/acme/clients');
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Clients' });

    await user.click(screen.getByRole('button', { name: 'Practice: Acme Accountants' }));
    await user.click(screen.getByRole('menuitem', { name: 'Practice settings' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/acme/settings/practice'));
    await waitFor(() =>
      expect(within(mainNav()).getByRole('link', { name: 'Settings' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
    expect(within(mainNav()).getByRole('link', { name: 'Clients' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows the page of an address below a module', async () => {
    mockOrganizations([ownerContext]);
    renderApp('/acme/wip/historic');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Historic WIP' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['/acme/settings/staff', '/acme/team/staff'],
    ['/acme/settings/rates', '/acme/team/charge-out-rates'],
    ['/acme/settings/services', '/acme/team/services'],
    ['/acme/settings/activity-codes', '/acme/team/activity-types'],
    ['/acme/settings/vat-rates', '/acme/settings/vat-codes'],
    ['/acme/settings/numbering', '/acme/settings/document-numbering'],
    ['/acme/settings/invoice-numbering', '/acme/settings/document-numbering'],
    ['/acme/settings/credit-note-numbering', '/acme/settings/document-numbering'],
    ['/acme/settings/estimate-numbering', '/acme/settings/document-numbering'],
    ['/acme/settings/audit', '/acme/settings/audit-logs'],
    ['/acme/billing/wip', '/acme/wip'],
    ['/acme/billing/opening-balances', '/acme/settings/import-export'],
  ])('redirects the old address %s to %s', async (from, to) => {
    mockOrganizations([ownerContext]);
    const { router } = renderApp(from);
    await waitFor(() => expect(router.state.location.pathname).toBe(to));
  });

  it.each(['/acme/projects', '/acme/billing/nothing', '/acme/time/nothing'])(
    'shows an in-shell not-found page for %s',
    async (path) => {
      mockOrganizations([ownerContext]);
      renderApp(path);
      expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
      expect(within(mainNav()).getByRole('link', { name: 'Clients' })).toBeInTheDocument();
    },
  );
});
