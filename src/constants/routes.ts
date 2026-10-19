/** Route builders. Components never write path strings by hand. */

const segment = (value: string) => encodeURIComponent(value);
const org = (slug: string) => `/${segment(slug)}`;

/**
 * Top-level paths that are not practice slugs. They are matched before `/:orgSlug`, so a
 * practice can never be given one of these slugs in a useful way.
 */
export const RESERVED_TOP_LEVEL = [
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'change-password',
  'app',
  'onboarding',
] as const;

/**
 * Path segments of the ten practice modules (the main menu of the product), relative to
 * `/:orgSlug`. The pages of each module are listed in `navigation.ts`.
 */
export const ORG_SEGMENTS = {
  dashboard: 'dashboard',
  clients: 'clients',
  time: 'time',
  jobs: 'jobs',
  expenses: 'expenses',
  wip: 'wip',
  billing: 'billing',
  reports: 'reports',
  team: 'team',
  settings: 'settings',
  account: 'account',
  /** The Application Testing tracker: not one of the ten modules, it has its own sidebar. */
  applicationTesting: 'application-testing',
} as const;

export type ModuleSegment = (typeof ORG_SEGMENTS)[keyof typeof ORG_SEGMENTS];

const under = (slug: string, ...parts: string[]) => [org(slug), ...parts.filter(Boolean)].join('/');

/** `/:orgSlug/<module>/<page>`; an empty page is the module's own index. */
export const modulePath = (slug: string, moduleSegment: ModuleSegment, page = '') =>
  under(slug, moduleSegment, page);

export const routes = {
  root: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  /** The full-page "Choose a new password" screen of an account with a temporary password. */
  changePassword: '/change-password',
  /** Resolves to the last-used practice, the first one, or onboarding. */
  app: '/app',
  /** Create a practice (open deployments only). */
  onboarding: '/onboarding',
  org: {
    home: (slug: string) => org(slug),
    /** A module's index, or one of its pages (`navigation.ts` lists the page segments). */
    module: modulePath,
    dashboard: (slug: string) => under(slug, ORG_SEGMENTS.dashboard),
    clients: (slug: string) => under(slug, ORG_SEGMENTS.clients),
    /** Client 360; `tab` is one of its tabs ('' is the overview). */
    client: (slug: string, clientId: string, tab = '') =>
      under(slug, ORG_SEGMENTS.clients, segment(clientId), tab),
    jobs: (slug: string) => under(slug, ORG_SEGMENTS.jobs),
    job: (slug: string, jobId: string) => under(slug, ORG_SEGMENTS.jobs, segment(jobId)),
    timesheet: (slug: string) => under(slug, ORG_SEGMENTS.time),
    invoices: (slug: string) => under(slug, ORG_SEGMENTS.billing, 'invoices'),
    invoice: (slug: string, invoiceId: string) =>
      under(slug, ORG_SEGMENTS.billing, 'invoices', segment(invoiceId)),
    staff: (slug: string) => under(slug, ORG_SEGMENTS.team, 'staff'),
    account: (slug: string) => under(slug, ORG_SEGMENTS.account),
    /** Application Testing: the dashboard, the ticket list and one ticket. */
    applicationTesting: (slug: string) => under(slug, ORG_SEGMENTS.applicationTesting),
    ticketsDashboard: (slug: string) => under(slug, ORG_SEGMENTS.applicationTesting, 'dashboard'),
    tickets: (slug: string) => under(slug, ORG_SEGMENTS.applicationTesting, 'tickets'),
    ticket: (slug: string, ticketId: string) =>
      under(slug, ORG_SEGMENTS.applicationTesting, 'tickets', segment(ticketId)),
    /** An expense claim opens below the list it was opened from ('claims' is the module index). */
    expenseClaim: (
      slug: string,
      claimId: string,
      list: 'mine' | 'claims' | 'approvals' = 'claims',
    ) => under(slug, ORG_SEGMENTS.expenses, list, segment(claimId)),
  },
} as const;

/** Where a signed-in user lands: the resolver picks the practice (or onboarding). */
export const POST_LOGIN_ROUTE = routes.app;

/**
 * Accepts only same-origin absolute paths for the `next` parameter, so a crafted
 * link cannot redirect a user to another site after sign-in.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return null;
  }
  return next;
}

function withNext(base: string, path: string | null | undefined, email?: string): string {
  const params = new URLSearchParams();
  const next = safeNextPath(path);
  if (next && next !== routes.root) params.set('next', next);
  if (email) params.set('email', email);
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

/** The sign-in page, returning to `path` afterwards and optionally pre-filling the address. */
export function loginRouteWithNext(path: string | null | undefined, email?: string): string {
  return withNext(routes.login, path, email);
}

/** The registration page, returning to `path` once the account is verified and signed in. */
export function registerRouteWithNext(path: string | null | undefined, email?: string): string {
  return withNext(routes.register, path, email);
}
