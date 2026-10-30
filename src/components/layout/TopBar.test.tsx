import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useShellStore } from '@/app/store';
import { buildShellData } from '@/app/router/shellData';
import { visibleModules } from '@/constants/navigation';
import { testUser } from '@/test/fixtures';
import { contextWith, memberContext, ownerContext, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderWithProviders } from '@/test/render';

import { AppShell } from './AppShell';

// The drawer and the search are open or closed in a store that outlives a test.
beforeEach(() => {
  useShellStore.setState({ drawerOpen: false, searchOpen: false });
});

/** The page content: where the router is, so navigation can be asserted. */
function CurrentLocation() {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{`${pathname}${search}`}</p>;
}

function renderShell(permissions: string[], route = '/acme/dashboard/overview') {
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
        <Route path="*" element={<CurrentLocation />} />
      </Route>
    </Routes>,
    { route },
  );
}

const location = () => screen.getByTestId('location').textContent;

const mainNav = () => screen.getByRole('navigation', { name: 'Main' });

const moduleLinks = () =>
  within(mainNav())
    .queryAllByRole('link')
    .map((link) => link.textContent);

const ALL_MODULES = [
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
];

async function openPracticeMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Practice: Acme Accountants' }));
  return screen.getByRole('menu');
}

/** The visible label of an element, without its decorative (aria-hidden) parts. */
function labelOf(element: HTMLElement): string {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return copy.textContent.trim();
}

const menuItems = (menu: HTMLElement) => within(menu).queryAllByRole('menuitem').map(labelOf);

describe('TopBar', () => {
  it('shows the practice name and leads the logo to the dashboard', () => {
    renderShell(ownerContext.permissions);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Acme Accountants')).toBeInTheDocument();
    expect(within(banner).queryByText('Practice management')).not.toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Acme Accountants home' })).toHaveAttribute(
      'href',
      '/acme/dashboard',
    );
  });

  it('shows the ten modules to an Owner, in the order of the menu, each leading to its first page', () => {
    renderShell(ownerContext.permissions);
    expect(moduleLinks()).toEqual(ALL_MODULES);
    const hrefOf = (name: string) =>
      within(mainNav()).getByRole('link', { name }).getAttribute('href');
    expect(hrefOf('Dashboard')).toBe('/acme/dashboard/overview');
    expect(hrefOf('Clients')).toBe('/acme/clients');
    expect(hrefOf('Time')).toBe('/acme/time');
    expect(hrefOf('Work in Progress')).toBe('/acme/wip');
    expect(hrefOf('Billing & Fees')).toBe('/acme/billing/invoices');
    expect(hrefOf('Team & Rates')).toBe('/acme/team/staff');
    expect(hrefOf('Settings')).toBe('/acme/settings/general');
  });

  it.each([
    [[], ['Dashboard']],
    [['client.read'], ['Dashboard', 'Clients']],
    [
      STAFF_PERMISSIONS,
      ['Dashboard', 'Clients', 'Time', 'Jobs', 'Expenses', 'Reports', 'Team & Rates', 'Settings'],
    ],
    [['wip.read'], ['Dashboard', 'Expenses', 'Work in Progress']],
    [['invoice.read'], ['Dashboard', 'Billing & Fees']],
    [['report.financial'], ['Dashboard', 'Reports']],
    [['audit_log.read'], ['Dashboard', 'Settings']],
    [['rate.read'], ['Dashboard', 'Team & Rates']],
  ])('gates the modules on the permissions %j', (permissions, expected) => {
    renderShell(permissions);
    expect(moduleLinks()).toEqual(expected);
  });

  it.each([
    ['/acme/dashboard/overview', 'Dashboard'],
    ['/acme/clients', 'Clients'],
    ['/acme/clients/c-1', 'Clients'],
    ['/acme/billing/invoices/inv-1', 'Billing & Fees'],
    ['/acme/team/grades', 'Team & Rates'],
  ])('marks the module of %s as the current one', (route, name) => {
    renderShell(ownerContext.permissions, route);
    const current = within(mainNav())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual([name]);
  });

  it.each([
    ['/acme/clients', 'Clients pages'],
    ['/acme/billing/invoices', 'Billing & Fees pages'],
    ['/acme/time', 'Time pages'],
  ])('shows no secondary bar for %s (the module has its own sidebar or none)', (route, name) => {
    renderShell(ownerContext.permissions, route);
    expect(screen.queryByRole('navigation', { name })).not.toBeInTheDocument();
  });

  it('lists the pages of a module in the order of its sidebar, for the pages the role may open', () => {
    const labels = (permissions: string[], moduleId: string) =>
      visibleModules('acme', (code) => permissions.includes(code))
        .find((entry) => entry.id === moduleId)
        ?.pages.map((page) => page.label);

    expect(labels(['time.log'], 'time')).toEqual(['My Timesheet', 'Time Entries']);
    expect(labels(['time.log', 'timesheet.approve'], 'time')).toEqual([
      'My Timesheet',
      'Time Entries',
      'Team Timesheets',
      'Timesheet Approvals',
    ]);
    // Creating an invoice is a button on Invoices, not a page of the menu.
    expect(labels(ownerContext.permissions, 'billing')).toEqual([
      'Invoices',
      'Credit Notes',
      'Recurring Invoices',
      'Estimates',
      'Payments',
      'Debtors',
      'Client Statements',
    ]);
  });

  it('has no secondary bar off the modules (the account page)', () => {
    renderShell(ownerContext.permissions, '/acme/account');
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it('offers the navigation drawer, with the current module open', async () => {
    const user = userEvent.setup();
    renderShell(ownerContext.permissions, '/acme/jobs/tasks');
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    // Every module is a button, the current one is expanded and lists its pages.
    expect(within(drawer).getByRole('button', { name: 'Jobs' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(within(drawer).getByRole('link', { name: 'Tasks' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(drawer).queryByRole('link', { name: 'Estimates' })).not.toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Billing & Fees' }));
    expect(within(drawer).getByRole('link', { name: 'Estimates' })).toHaveAttribute(
      'href',
      '/acme/billing/estimates',
    );
  });

  describe('the practice menu', () => {
    it('names the role, opens the practice settings and lists the practices to switch to', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);
      const menu = await openPracticeMenu(user);
      expect(menu).toHaveTextContent('Owner');
      expect(menuItems(menu)).toEqual(['Practice settings', 'Acme Accountants', 'Globex Tax']);
      expect(within(menu).getByRole('separator')).toBeInTheDocument();
    });

    it('offers no practice settings to a role that may not open them', async () => {
      const user = userEvent.setup();
      renderShell(['client.read']);
      const menu = await openPracticeMenu(user);
      expect(menuItems(menu)).toEqual(['Acme Accountants', 'Globex Tax']);
    });

    it('opens the practice settings', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);
      await openPracticeMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'Practice settings' }));
      expect(location()).toBe('/acme/settings/practice');
    });

    it('switches to another practice', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);
      await openPracticeMenu(user);
      await user.click(screen.getByRole('menuitem', { name: 'Globex Tax' }));
      expect(location()).toBe('/globex');
    });
  });

  describe('quick create', () => {
    it.each([
      [
        ownerContext.permissions,
        [
          'New client',
          'New job',
          'Log time',
          'New expense',
          'Create invoice',
          'Record payment',
          'Add staff member',
          'New ticket',
        ],
      ],
      [['client.read', 'client.create'], ['New client']],
      [['member.invite'], ['Add staff member']],
      [STAFF_PERMISSIONS, ['Log time', 'New expense', 'New ticket']],
    ])('offers what %j may create', async (permissions, expected) => {
      const user = userEvent.setup();
      renderShell(permissions);
      await user.click(screen.getByRole('button', { name: 'Create new' }));
      expect(menuItems(screen.getByRole('menu', { name: 'Create new' }))).toEqual(expected);
    });

    it.each([[['client.read']], [['member.read']], [['client.update', 'role.read']]])(
      'is hidden when %j may create nothing',
      (permissions) => {
        renderShell(permissions);
        expect(screen.queryByRole('button', { name: 'Create new' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
      },
    );

    it.each([
      ['New client', '/acme/clients?new=1'],
      ['Log time', '/acme/time'],
      ['Create invoice', '/acme/billing/prepare'],
      ['Add staff member', '/acme/team/staff?new=1'],
    ])('leads %s to %s', async (label, target) => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions, '/acme/settings/practice');
      await user.click(screen.getByRole('button', { name: 'Create new' }));
      await user.click(screen.getByRole('menuitem', { name: label }));
      expect(location()).toBe(target);
    });
  });

  describe('the help', () => {
    it('leads from the Help button to the Help centre', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);
      await user.click(screen.getByRole('button', { name: 'Help' }));
      await user.click(screen.getByRole('link', { name: 'How it works, glossary and support' }));
      expect(location()).toBe('/acme/help');
    });
  });

  describe('the page search', () => {
    async function openSearch(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: 'Search' }));
      return screen.findByRole('combobox', { name: 'Search pages' });
    }

    const optionLabels = () =>
      screen.getAllByRole('option').map((option) => option.querySelector('span')?.textContent);

    it('lists every module, every page and the quick-create shortcuts', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);
      await openSearch(user);
      const labels = optionLabels();
      expect(labels.slice(0, 3)).toEqual(['Dashboard', 'Overview', 'My Actions']);
      expect(labels).toContain('Document Numbering');
      expect(labels).toContain('Audit Logs');
      expect(labels.at(-1)).toBe('New ticket');
    });

    it('offers only what the role may open', async () => {
      const user = userEvent.setup();
      renderShell(['client.read']);
      await openSearch(user);
      expect(optionLabels()).toEqual([
        'Dashboard',
        'Overview',
        'My Actions',
        'Clients',
        'Client List',
        'Client Overview',
        'Leads',
      ]);
    });

    it('opens from Ctrl+K, even while a field has the focus', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);
      expect(screen.queryByRole('combobox', { name: 'Search pages' })).not.toBeInTheDocument();
      await user.keyboard('{Control>}k{/Control}');
      expect(await screen.findByRole('combobox', { name: 'Search pages' })).toBeInTheDocument();
    });

    it('finds a page by its name and opens it', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);
      await user.type(await openSearch(user), 'vat');
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('VAT Codes');
      await user.keyboard('{Enter}');
      expect(location()).toBe('/acme/settings/vat-codes');
    });

    it('finds pages by their module too', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);
      await user.type(await openSearch(user), 'work in progress');
      expect(optionLabels()).toEqual([
        'Work in Progress',
        'WIP Summary',
        'WIP Details',
        'WIP Ageing',
        'WIP Adjustments',
        'WIP Transfers',
        'Historic WIP',
      ]);
    });

    it('does not find a page the role may not open', async () => {
      const user = userEvent.setup();
      renderShell(STAFF_PERMISSIONS);
      await user.type(await openSearch(user), 'audit');
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
      expect(screen.getByText('No page matches “audit”.')).toBeInTheDocument();
    });
  });
});

describe('Application Testing in the shell', () => {
  const trackerButton = () => screen.getByRole('button', { name: 'Application Testing' });

  /** The round button inside the trigger: the pointer is over it, and it carries the tooltip. */
  const roundButton = () => {
    const circle = trackerButton().firstElementChild;
    if (!circle) throw new Error('The trigger holds no round button');
    return circle;
  };

  const rightGroup = () =>
    within(screen.getByRole('banner'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);

  describe('the bug button of the top bar', () => {
    it('starts the right-hand group, before the search, for a role that may read tickets', () => {
      renderShell(ownerContext.permissions);
      const names = rightGroup();
      expect(names.indexOf('Application Testing')).toBeGreaterThan(-1);
      expect(names.indexOf('Application Testing')).toBe(names.indexOf('Search') - 1);
      expect(names.indexOf('Search')).toBeLessThan(names.indexOf('Create new'));
    });

    it.each([[[]], [['client.read']], [['ticket.create', 'ticket.update', 'ticket.delete']]])(
      'is not shown to %j, who may not read tickets',
      (permissions) => {
        renderShell(permissions);
        expect(
          screen.queryByRole('button', { name: 'Application Testing' }),
        ).not.toBeInTheDocument();
      },
    );

    it('shows its name in a tooltip on hover and none while its menu is open', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);

      await user.hover(roundButton());
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Application Testing');

      await user.click(trackerButton());
      expect(screen.getByRole('menu', { name: 'Application Testing' })).toBeInTheDocument();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('does not show the tooltip again when the menu hands the focus back to the button', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions, '/acme/settings/practice');

      await user.click(trackerButton());
      await user.click(screen.getByRole('menuitem', { name: 'All Tickets' }));
      expect(location()).toBe('/acme/application-testing/tickets');
      await waitFor(() => expect(trackerButton()).toHaveFocus());
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Escape does the same.
      await user.click(trackerButton());
      await user.keyboard('{Escape}');
      await waitFor(() => expect(trackerButton()).toHaveFocus());
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('opens a menu headed "Application Testing" with the two pages, a separator and New ticket', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);

      await user.click(trackerButton());
      const menu = screen.getByRole('menu', { name: 'Application Testing' });
      expect(menu).toHaveTextContent('Application Testing');
      expect(menuItems(menu)).toEqual(['Dashboard', 'All Tickets', 'New ticket']);
      expect(within(menu).getByRole('separator')).toBeInTheDocument();
    });

    it('offers New ticket only to a role that may create tickets', async () => {
      const user = userEvent.setup();
      renderShell(['ticket.read']);

      await user.click(trackerButton());
      const menu = screen.getByRole('menu', { name: 'Application Testing' });
      expect(menuItems(menu)).toEqual(['Dashboard', 'All Tickets']);
      expect(within(menu).queryByRole('separator')).not.toBeInTheDocument();
    });

    it.each([
      ['Dashboard', '/acme/application-testing/dashboard'],
      ['All Tickets', '/acme/application-testing/tickets'],
      ['New ticket', '/acme/application-testing/tickets?new=1'],
    ])('leads %s to %s', async (label, target) => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions, '/acme/settings/practice');

      await user.click(trackerButton());
      await user.click(screen.getByRole('menuitem', { name: label }));
      expect(location()).toBe(target);
    });

    it('is not one of the modules: the top bar highlights none and there is no secondary bar', () => {
      renderShell(ownerContext.permissions, '/acme/application-testing/tickets');
      expect(moduleLinks()).toEqual(ALL_MODULES);
      expect(
        within(mainNav())
          .getAllByRole('link')
          .filter((link) => link.getAttribute('aria-current') === 'page'),
      ).toEqual([]);
      expect(screen.getAllByRole('navigation')).toHaveLength(1);
    });
  });

  describe('the navigation drawer', () => {
    it('has an Application Testing group after the modules, closed away from it', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions, '/acme/clients');

      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      const drawer = screen.getByRole('dialog', { name: 'Navigation' });
      const group = within(drawer).getByRole('button', { name: 'Application Testing' });
      expect(group).toHaveAttribute('aria-expanded', 'false');
      // After the last module.
      const names = within(drawer)
        .getAllByRole('button')
        .map((button) => button.textContent);
      expect(names.at(-1)).toBe('Application Testing');

      await user.click(group);
      expect(group).toHaveAttribute('aria-expanded', 'true');
      expect(within(drawer).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/acme/application-testing/dashboard',
      );
      expect(within(drawer).getByRole('link', { name: 'All Tickets' })).toHaveAttribute(
        'href',
        '/acme/application-testing/tickets',
      );
    });

    it('opens the group and marks the page when the person is in Application Testing', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions, '/acme/application-testing/tickets');

      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      const drawer = screen.getByRole('dialog', { name: 'Navigation' });
      expect(within(drawer).getByRole('button', { name: 'Application Testing' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(within(drawer).getByRole('link', { name: 'All Tickets' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(drawer).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
        'aria-current',
      );
    });

    it('closes after a page was chosen', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions, '/acme/application-testing/tickets');

      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      const drawer = screen.getByRole('dialog', { name: 'Navigation' });
      await user.click(within(drawer).getByRole('link', { name: 'Dashboard' }));
      expect(location()).toBe('/acme/application-testing/dashboard');
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument(),
      );
    });

    it('has no such group for a role that may not read tickets', async () => {
      const user = userEvent.setup();
      renderShell(['client.read']);

      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      expect(
        within(screen.getByRole('dialog', { name: 'Navigation' })).queryByRole('button', {
          name: 'Application Testing',
        }),
      ).not.toBeInTheDocument();
    });
  });

  describe('the page search', () => {
    const optionLabels = () =>
      screen.getAllByRole('option').map((option) => option.querySelector('span')?.textContent);

    async function openSearch(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: 'Search' }));
      return screen.findByRole('combobox', { name: 'Search pages' });
    }

    it('finds the tracker and its pages, and opens one', async () => {
      const user = userEvent.setup();
      renderShell(ownerContext.permissions);

      await user.type(await openSearch(user), 'application testing');
      expect(optionLabels()).toEqual(['Application Testing', 'Dashboard', 'All Tickets']);
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
      expect(location()).toBe('/acme/application-testing/tickets');
    });

    it('finds the tickets by their name', async () => {
      const user = userEvent.setup();
      renderShell(STAFF_PERMISSIONS);

      await user.type(await openSearch(user), 'all tickets');
      expect(optionLabels()).toEqual(['All Tickets']);
    });

    it('does not offer it to a role that may not read tickets', async () => {
      const user = userEvent.setup();
      renderShell(['client.read']);

      await user.type(await openSearch(user), 'ticket');
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
      expect(screen.getByText('No page matches “ticket”.')).toBeInTheDocument();
    });
  });
});
