import { Navigate, type RouteObject } from 'react-router';

import { FullScreenLoader } from '@/components/common/FullScreenLoader';
import { AuthLayout } from '@/components/layout';
import {
  APPLICATION_TESTING_ACCESS,
  APPLICATION_TESTING_PAGES,
  findModule,
  NAV_MODULES,
  pageRule,
  type ApplicationTestingPage,
  type ModuleId,
} from '@/constants/navigation';
import { ORG_SEGMENTS, routes } from '@/constants/routes';
import { RedirectIfAuthenticated, RequireAuth, RequireVerified } from '@/features/auth';
import { OpenDeploymentOnly, PASSWORD_RESET_NOTICE } from '@/features/system';
import { NotFoundPage } from '@/pages/public/NotFoundPage';
import { RouteErrorPage } from '@/pages/public/RouteErrorPage';

import { ModuleIndexRedirect, RequireAccess } from './guards';
import { AppShellRoute, OrgRoute, PublicLayoutRoute } from './layoutRoutes';
import { DETAIL_ROUTES, PAGE_LOADERS, type Loader, type PageModule } from './pageLoaders';

/** A feature page file (default export) as a lazily loaded route: one chunk per page. */
const page = (load: () => Promise<PageModule>) => () =>
  load().then((module) => ({ Component: module.default }));

/** Named exports of the shared pages under `src/pages`. */
const lazyPage = {
  login: () => import('@/pages/auth/LoginPage').then((m) => ({ Component: m.LoginPage })),
  register: () => import('@/pages/auth/RegisterPage').then((m) => ({ Component: m.RegisterPage })),
  forgotPassword: () =>
    import('@/pages/auth/ForgotPasswordPage').then((m) => ({ Component: m.ForgotPasswordPage })),
  resetPassword: () =>
    import('@/pages/auth/ResetPasswordPage').then((m) => ({ Component: m.ResetPasswordPage })),
  changePassword: () =>
    import('@/pages/auth/ChangePasswordPage').then((m) => ({ Component: m.ChangePasswordPage })),
  verifyEmail: () =>
    import('@/pages/auth/VerifyEmailPage').then((m) => ({ Component: m.VerifyEmailPage })),
  appRedirect: () =>
    import('@/pages/app/AppRedirectPage').then((m) => ({ Component: m.AppRedirectPage })),
  onboarding: () =>
    import('@/pages/onboarding/OnboardingPage').then((m) => ({ Component: m.OnboardingPage })),
};

/** Guards a module with the rule the navigation uses. */
const guardModule = (moduleId: ModuleId, children: RouteObject[]): RouteObject => ({
  element: <RequireAccess rule={findModule(moduleId)} />,
  children,
});

/** Guards one page with the rule its secondary bar uses. */
const guardPage = (moduleId: ModuleId, pageId: string, route: RouteObject): RouteObject => ({
  element: <RequireAccess rule={pageRule(moduleId, pageId)} />,
  children: [route],
});

/** The layout file of each module with its own sidebar (see SIDEBAR_MODULES). */
const SIDEBAR_LAYOUTS: Partial<Record<ModuleId, Loader>> = {
  settings: () => import('@/features/settings/pages/SettingsLayoutPage'),
  team: () => import('@/features/team/pages/TeamLayoutPage'),
};

/** The routes of one module: its index, every page of its secondary bar and its detail pages. */
function moduleRoutes(moduleId: ModuleId): RouteObject {
  const module = findModule(moduleId);
  const loaderOf = (pageId: string): Loader => {
    const load = PAGE_LOADERS[moduleId][pageId];
    if (!load) throw new Error(`No page file registered for ${moduleId}/${pageId}`);
    return load;
  };
  const children: RouteObject[] = [];
  const indexPage = module.pages.find((entry) => entry.segment === '');
  children.push(
    indexPage
      ? guardPage(moduleId, indexPage.id, { index: true, lazy: page(loaderOf(indexPage.id)) })
      : { index: true, element: <ModuleIndexRedirect moduleId={moduleId} /> },
  );
  for (const entry of module.pages) {
    if (entry.segment === '') continue;
    children.push(
      guardPage(moduleId, entry.id, { path: entry.segment, lazy: page(loaderOf(entry.id)) }),
    );
  }
  for (const detail of DETAIL_ROUTES[moduleId] ?? []) {
    children.push(
      guardPage(moduleId, detail.pageId, { path: detail.path, lazy: page(detail.load) }),
    );
  }
  // Settings and Team & Rates have their own grouped sidebar instead of the shared secondary
  // bar; their pages sit one level deeper, under that layout.
  const sidebarLayout = SIDEBAR_LAYOUTS[moduleId];
  const routed: RouteObject[] = sidebarLayout
    ? [{ lazy: page(sidebarLayout), children }]
    : children;
  return { path: module.segment, children: [guardModule(moduleId, routed)] };
}

/** The file behind each page of Application Testing; a ticket opens below "All Tickets". */
const APPLICATION_TESTING_LOADERS: Record<ApplicationTestingPage['id'], Loader> = {
  dashboard: () => import('@/features/tickets/pages/TicketsDashboardPage'),
  tickets: () => import('@/features/tickets/pages/TicketsListPage'),
};

/**
 * Application Testing (`/:orgSlug/application-testing`) is not one of the ten modules: it has its
 * own layout (a sidebar, no secondary bar) and its own rule (`ticket.read`). The index leads to
 * the dashboard.
 */
const APPLICATION_TESTING_ROUTE: RouteObject = {
  path: ORG_SEGMENTS.applicationTesting,
  element: <RequireAccess rule={APPLICATION_TESTING_ACCESS} />,
  children: [
    {
      lazy: page(() => import('@/features/tickets/pages/TicketsLayoutPage')),
      children: [
        {
          index: true,
          element: <Navigate to={APPLICATION_TESTING_PAGES[0]?.segment ?? 'dashboard'} replace />,
        },
        ...APPLICATION_TESTING_PAGES.map((entry): RouteObject => ({
          path: entry.segment,
          lazy: page(APPLICATION_TESTING_LOADERS[entry.id]),
        })),
        {
          path: 'tickets/:ticketId',
          lazy: page(() => import('@/features/tickets/pages/TicketDetailPage')),
        },
      ],
    },
  ],
};

/** Where the pages of the first build lived before the navigation had ten modules. */
const MOVED: ReadonlyArray<readonly [string, string]> = [
  ['settings/staff', 'team/staff'],
  ['settings/rates', 'team/charge-out-rates'],
  ['settings/services', 'team/services'],
  ['settings/activity-codes', 'team/activity-types'],
  ['settings/vat-rates', 'settings/vat-codes'],
  ['settings/numbering', 'settings/document-numbering'],
  ['settings/invoice-numbering', 'settings/document-numbering'],
  ['settings/credit-note-numbering', 'settings/document-numbering'],
  ['settings/estimate-numbering', 'settings/document-numbering'],
  ['settings/audit', 'settings/audit-logs'],
  ['time/timer', 'time'],
  ['billing/wip', 'wip'],
  // Opening Balances import moved from a Billing placeholder to the real feature in Settings.
  ['billing/opening-balances', 'settings/import-export'],
];

/** `/:orgSlug/...`: the ten modules, the account and the redirects of moved pages. */
const ORG_ROUTES: RouteObject[] = [
  { index: true, element: <Navigate to={ORG_SEGMENTS.dashboard} replace /> },
  ...MOVED.map(([from, to]): RouteObject => ({
    path: from,
    // Route-relative: `..` leaves this route and lands on `/:orgSlug`.
    element: <Navigate to={`../${to}`} replace />,
  })),
  ...NAV_MODULES.map((module) => moduleRoutes(module.id)),
  APPLICATION_TESTING_ROUTE,
  {
    path: ORG_SEGMENTS.account,
    lazy: page(() => import('@/features/account/pages/AccountPage')),
  },
  // Inside the shell: the chrome stays and the content says the page does not exist.
  { path: '*', element: <NotFoundPage /> },
];

export const appRoutes: RouteObject[] = [
  {
    // Root boundary: catches errors thrown outside any layout.
    errorElement: <RouteErrorPage fullPage />,
    HydrateFallback: FullScreenLoader,
    children: [
      { index: true, element: <Navigate to={routes.app} replace /> },
      {
        element: <AuthLayout />,
        children: [
          {
            element: <RedirectIfAuthenticated />,
            children: [
              { path: 'login', lazy: lazyPage.login },
              {
                // No sign-up in a closed deployment: the visitor is sent to sign in, with a note.
                element: <OpenDeploymentOnly />,
                children: [{ path: 'register', lazy: lazyPage.register }],
              },
              {
                // A closed deployment has no self-service reset: the administrator sets passwords.
                element: <OpenDeploymentOnly notice={PASSWORD_RESET_NOTICE} />,
                children: [{ path: 'forgot-password', lazy: lazyPage.forgotPassword }],
              },
            ],
          },
          // Reachable while signed in: the links arrive by email, whatever the session state.
          // A closed deployment uses it too, for the link that lets a new person choose a password.
          { path: 'reset-password', lazy: lazyPage.resetPassword },
          { path: 'verify-email', lazy: lazyPage.verifyEmail },
        ],
      },
      {
        // Creating a practice exists only while sign-up is open. Checked before the session,
        // so even a visitor who is not signed in is told why instead of being asked to sign in.
        element: <OpenDeploymentOnly />,
        children: [
          {
            element: <RequireAuth />,
            children: [
              {
                element: <RequireVerified />,
                children: [
                  {
                    element: <AuthLayout />,
                    children: [{ path: 'onboarding', lazy: lazyPage.onboarding }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            // While the account has a temporary password, every route above leads here.
            element: <AuthLayout />,
            children: [{ path: 'change-password', lazy: lazyPage.changePassword }],
          },
          {
            element: <RequireVerified />,
            children: [
              // Picks the practice to open: last used, first, or onboarding.
              { path: 'app', lazy: lazyPage.appRedirect },
              {
                element: <AppShellRoute />,
                children: [
                  {
                    // Route boundary inside the shell: the chrome stays, the content shows the error.
                    errorElement: <RouteErrorPage />,
                    children: [{ path: ':orgSlug', element: <OrgRoute />, children: ORG_ROUTES }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <PublicLayoutRoute />,
        children: [{ path: '*', element: <NotFoundPage /> }],
      },
    ],
  },
];
