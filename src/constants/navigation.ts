import {
  Activity,
  ArrowLeftRight,
  ArrowUpDown,
  Award,
  BadgeCheck,
  Banknote,
  Bell,
  Briefcase,
  Bug,
  CalendarDays,
  CalendarX2,
  ChartColumn,
  ChartLine,
  ChartPie,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  CreditCard,
  FileMinus2,
  FilePlus2,
  FileSignature,
  FileText,
  Gauge,
  Hash,
  HandCoins,
  History,
  Hourglass,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Lock,
  MailPlus,
  Paperclip,
  Percent,
  Plug,
  PoundSterling,
  Receipt,
  ReceiptText,
  RefreshCcw,
  Repeat,
  ScanSearch,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Target,
  Ticket,
  Trophy,
  TrendingUp,
  Users,
  UserCheck,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { PERMISSIONS as P, type PermissionCode } from './permissions';
import { PAGE_DESCRIPTIONS } from './pageDescriptions';
import { ORG_SEGMENTS, modulePath, type ModuleSegment } from './routes';

/**
 * The navigation of a practice: ten modules (the violet top bar), each with the pages of its
 * secondary bar. The router guards the same pages with the same rules, so this is the one
 * place that says who may open what. UI gating only: the API checks every permission again.
 */

/** Visible when the caller holds at least one of `anyOf`; an empty list means every member. */
export interface AccessRule {
  anyOf: ReadonlyArray<PermissionCode>;
}

export type ModuleId =
  | 'dashboard'
  | 'clients'
  | 'time'
  | 'jobs'
  | 'expenses'
  | 'wip'
  | 'billing'
  | 'reports'
  | 'team'
  | 'settings';

export interface SubPage extends AccessRule {
  /** Unique within the module; the router and the guards look pages up by it. */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Path segment below the module ('' is the module's index page). */
  segment: string;
  /** Also current below the module for paths that no other page claims (detail pages). */
  detail?: boolean;
  /** Not offered in menus or search; the page and its address still exist. */
  hidden?: boolean;
  /** Other segments this page's menu entry stays marked on (a hidden page that belongs to it). */
  alsoActiveOn?: ReadonlyArray<string>;
  /** Groups the page under a heading in the "More" overflow menu; ungrouped pages get none. */
  group?: string;
  /** One line in plain words on what the page is for: the tooltip of its menu entry. */
  description?: string;
  to: (slug: string) => string;
}

export interface NavModule extends AccessRule {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  /** Path segment below `/:orgSlug`. */
  segment: ModuleSegment;
  /** Where the module leads when it has no visible page. */
  to: (slug: string) => string;
  pages: ReadonlyArray<SubPage>;
}

/** Modules that show no secondary bar: the module opens straight on its list (Clients). */
export const NO_SUBNAV_MODULES: ReadonlyArray<ModuleId> = ['clients'];

/** Modules with their own grouped left sidebar instead of the shared secondary bar. */
export const SIDEBAR_MODULES: ReadonlyArray<ModuleId> = [
  'settings',
  'team',
  'reports',
  'billing',
  'wip',
  'expenses',
  'jobs',
  'time',
  'dashboard',
];

interface PageDef {
  id: string;
  label: string;
  icon: LucideIcon;
  anyOf?: ReadonlyArray<PermissionCode>;
  /** Defaults to the id; '' for the module's index page. */
  segment?: string;
  detail?: boolean;
  hidden?: boolean;
  alsoActiveOn?: ReadonlyArray<string>;
  /** Groups the page under a heading in the "More" overflow menu; ungrouped pages get none. */
  group?: string;
}

function pagesOf(
  moduleId: ModuleId,
  moduleSegment: ModuleSegment,
  defs: ReadonlyArray<PageDef>,
): SubPage[] {
  return defs.map((def) => {
    const segment = def.segment ?? def.id;
    return {
      id: def.id,
      label: def.label,
      icon: def.icon,
      segment,
      detail: def.detail,
      hidden: def.hidden,
      alsoActiveOn: def.alsoActiveOn,
      group: def.group,
      description: PAGE_DESCRIPTIONS[`${moduleId}/${def.id}`],
      anyOf: def.anyOf ?? [],
      to: (slug: string) => modulePath(slug, moduleSegment, segment),
    };
  });
}

function moduleOf(
  id: ModuleId,
  label: string,
  icon: LucideIcon,
  segment: ModuleSegment,
  anyOf: ReadonlyArray<PermissionCode>,
  defs: ReadonlyArray<PageDef>,
): NavModule {
  return {
    id,
    label,
    icon,
    segment,
    anyOf,
    to: (slug: string) => modulePath(slug, segment),
    pages: pagesOf(id, segment, defs),
  };
}

export const NAV_MODULES: ReadonlyArray<NavModule> = [
  moduleOf(
    'dashboard',
    'Dashboard',
    LayoutDashboard,
    ORG_SEGMENTS.dashboard,
    [],
    [
      {
        id: 'overview',
        label: 'Overview',
        icon: LayoutDashboard,
        group: 'Overview',
      },
      {
        id: 'my-actions',
        label: 'My Actions',
        icon: ListChecks,
        group: 'Overview',
      },
      {
        id: 'my-timesheet',
        label: 'My Timesheet',
        icon: Clock,
        anyOf: [P.timeLog],
        group: 'Time & approvals',
      },
      {
        id: 'pending-approvals',
        label: 'Pending Approvals',
        icon: BadgeCheck,
        anyOf: [P.timesheetApprove, P.expenseApprove],
        group: 'Time & approvals',
      },
      {
        id: 'missing-timesheets',
        label: 'Missing Timesheets',
        icon: CalendarX2,
        anyOf: [P.timesheetApprove, P.timeReadAll],
        group: 'Time & approvals',
      },
      {
        id: 'top-clients-by-wip',
        label: 'Top Clients by WIP',
        icon: Trophy,
        anyOf: [P.wipRead, P.reportFinancial],
        group: 'Practice insight',
      },
      {
        id: 'billing-trend',
        label: 'Billing Trend',
        icon: TrendingUp,
        anyOf: [P.reportFinancial, P.invoiceRead],
        group: 'Practice insight',
      },
      {
        id: 'debtor-ageing',
        label: 'Debtor Ageing',
        icon: ChartPie,
        anyOf: [P.reportFinancial, P.paymentRead, P.invoiceRead],
        group: 'Practice insight',
      },
    ],
  ),

  moduleOf(
    'clients',
    'Clients',
    Users,
    ORG_SEGMENTS.clients,
    [P.clientRead],
    [
      { id: 'list', label: 'Client List', icon: Users, segment: '', anyOf: [P.clientRead] },
      {
        id: 'client-360',
        label: 'Client Overview',
        icon: ScanSearch,
        segment: '360',
        detail: true,
        anyOf: [P.clientRead],
      },
    ],
  ),

  moduleOf(
    'time',
    'Time',
    Clock,
    ORG_SEGMENTS.time,
    [P.timeLog, P.timeReadAll, P.timesheetApprove],
    [
      {
        id: 'my-timesheet',
        label: 'My Timesheet',
        icon: Clock,
        segment: '',
        anyOf: [P.timeLog],
        group: 'My time',
      },
      {
        id: 'entries',
        label: 'Time Entries',
        icon: ClipboardList,
        anyOf: [P.timeLog, P.timeReadAll],
        group: 'My time',
      },
      {
        id: 'team',
        label: 'Team Timesheets',
        icon: UsersRound,
        anyOf: [P.timeReadAll, P.timesheetApprove],
        group: 'Team & review',
      },
      {
        id: 'approvals',
        label: 'Timesheet Approvals',
        icon: BadgeCheck,
        anyOf: [P.timesheetApprove],
        group: 'Team & review',
      },
      {
        id: 'analysis',
        label: 'Time Analysis',
        icon: ChartColumn,
        anyOf: [P.reportRead, P.timeReadAll],
        group: 'Team & review',
      },
    ],
  ),

  moduleOf(
    'jobs',
    'Jobs',
    Briefcase,
    ORG_SEGMENTS.jobs,
    [P.jobRead],
    [
      {
        id: 'list',
        label: 'Job List',
        icon: Briefcase,
        segment: '',
        // A job's own page opens from its row, so the list stays current while one is open.
        detail: true,
        anyOf: [P.jobRead],
        group: 'Jobs',
      },
      {
        id: 'job-details',
        label: 'Job Details',
        icon: FileText,
        segment: 'details',
        // Kept for its address and its guard, but not offered: a job is opened from the list.
        hidden: true,
        anyOf: [P.jobRead],
        group: 'Jobs',
      },
      {
        id: 'budgets',
        label: 'Budget Tracking',
        icon: Gauge,
        anyOf: [P.jobRead],
        group: 'Jobs',
      },
      {
        id: 'tasks',
        label: 'Tasks',
        icon: ListTodo,
        anyOf: [P.jobRead],
        group: 'Planning',
      },
      {
        id: 'assignments',
        label: 'Assignments',
        icon: UserCheck,
        anyOf: [P.jobRead],
        group: 'Planning',
      },
      {
        id: 'calendar',
        label: 'Job Calendar',
        icon: CalendarDays,
        anyOf: [P.jobRead],
        group: 'Planning',
      },
    ],
  ),

  moduleOf(
    'expenses',
    'Expenses',
    Receipt,
    ORG_SEGMENTS.expenses,
    [
      P.expenseLog,
      P.expenseReadAll,
      P.expenseApprove,
      P.expenseManage,
      P.disbursementLog,
      P.disbursementManage,
      P.wipRead,
    ],
    [
      {
        id: 'mine',
        label: 'My Expenses',
        icon: Wallet,
        anyOf: [P.expenseLog],
        group: 'My expenses',
      },
      {
        id: 'claims',
        label: 'Expense Claims',
        icon: ReceiptText,
        segment: '',
        anyOf: [P.expenseReadAll, P.expenseManage],
        group: 'Review',
      },
      {
        id: 'approvals',
        label: 'Expense Approvals',
        icon: BadgeCheck,
        anyOf: [P.expenseApprove],
        group: 'Review',
      },
      {
        id: 'receipts',
        label: 'Receipts',
        icon: Paperclip,
        anyOf: [P.expenseLog, P.expenseReadAll, P.expenseApprove, P.expenseManage],
        group: 'Review',
      },
      {
        id: 'disbursements',
        label: 'Disbursements',
        icon: HandCoins,
        anyOf: [P.disbursementLog, P.disbursementManage, P.wipRead],
        group: 'Costs & set-up',
      },
      {
        id: 'types',
        label: 'Expense Types',
        icon: Tags,
        anyOf: [P.expenseLog, P.expenseReadAll, P.expenseManage],
        group: 'Costs & set-up',
      },
    ],
  ),

  moduleOf(
    'wip',
    'Work in Progress',
    Hourglass,
    ORG_SEGMENTS.wip,
    [P.wipRead],
    [
      {
        id: 'summary',
        label: 'WIP Summary',
        icon: Hourglass,
        segment: '',
        anyOf: [P.wipRead],
        group: 'Current WIP',
      },
      {
        id: 'details',
        label: 'WIP Details',
        icon: ClipboardList,
        anyOf: [P.wipRead],
        group: 'Current WIP',
      },
      {
        id: 'ageing',
        label: 'WIP Ageing',
        icon: ChartColumn,
        anyOf: [P.wipRead],
        group: 'Current WIP',
      },
      {
        id: 'adjustments',
        label: 'WIP Adjustments',
        icon: SlidersHorizontal,
        anyOf: [P.wipRead],
        group: 'Changes & history',
      },
      {
        id: 'transfers',
        label: 'WIP Transfers',
        icon: ArrowLeftRight,
        anyOf: [P.wipRead],
        group: 'Changes & history',
      },
      {
        id: 'historic',
        label: 'Historic WIP',
        icon: History,
        anyOf: [P.wipRead],
        group: 'Changes & history',
      },
    ],
  ),

  moduleOf(
    'billing',
    'Billing & Fees',
    PoundSterling,
    ORG_SEGMENTS.billing,
    [P.invoiceRead, P.invoiceCreate, P.paymentRead],
    [
      {
        id: 'prepare',
        label: 'Create Invoice',
        icon: FilePlus2,
        // Reached from the Invoices page ("Create invoice"), from Time Entries and from the
        // quick-add menu; not a page of its own in the menu.
        hidden: true,
        anyOf: [P.invoiceCreate],
        group: 'Invoicing',
      },
      {
        id: 'invoices',
        label: 'Invoices',
        icon: FileText,
        // Creating an invoice (the hidden "prepare" page) is a step of this page.
        alsoActiveOn: ['prepare'],
        anyOf: [P.invoiceRead],
        group: 'Invoicing',
      },
      {
        id: 'credit-notes',
        label: 'Credit Notes',
        icon: FileMinus2,
        anyOf: [P.invoiceRead],
        group: 'Invoicing',
      },
      {
        id: 'recurring',
        label: 'Recurring Invoices',
        icon: Repeat,
        anyOf: [P.recurringRead],
        group: 'Invoicing',
      },
      {
        id: 'estimates',
        label: 'Estimates',
        icon: FileSignature,
        anyOf: [P.estimateRead],
        group: 'Invoicing',
      },
      {
        id: 'payments',
        label: 'Payments',
        icon: CreditCard,
        anyOf: [P.paymentRead],
        group: 'Receivables',
      },
      {
        id: 'debtors',
        label: 'Debtors',
        icon: Banknote,
        anyOf: [P.paymentRead, P.invoiceRead],
        group: 'Receivables',
      },
      {
        id: 'statements',
        label: 'Client Statements',
        icon: ScrollText,
        anyOf: [P.paymentRead, P.invoiceRead],
        group: 'Receivables',
      },
    ],
  ),

  moduleOf(
    'reports',
    'Reports',
    ChartColumn,
    ORG_SEGMENTS.reports,
    [P.reportRead, P.reportFinancial],
    [
      {
        id: 'time-analysis',
        label: 'Time Analysis Report',
        icon: Clock,
        anyOf: [P.reportRead],
        group: 'Time & people',
      },
      {
        id: 'utilisation',
        label: 'Utilisation',
        icon: Gauge,
        anyOf: [P.reportRead],
        group: 'Time & people',
      },
      {
        id: 'missing-timesheets',
        label: 'Missing Timesheets Report',
        icon: CalendarX2,
        anyOf: [P.reportRead],
        group: 'Time & people',
      },
      {
        id: 'job-profitability',
        label: 'Job Profitability',
        icon: Scale,
        anyOf: [P.reportFinancial],
        group: 'Jobs & WIP',
      },
      {
        id: 'wip-ageing',
        label: 'WIP Ageing Report',
        icon: Hourglass,
        anyOf: [P.reportFinancial],
        group: 'Jobs & WIP',
      },
      {
        id: 'recovery',
        label: 'Recovery',
        icon: Target,
        anyOf: [P.reportFinancial],
        group: 'Jobs & WIP',
      },
      {
        id: 'expenses',
        label: 'Expenses Report',
        icon: Receipt,
        anyOf: [P.reportRead, P.reportFinancial],
        group: 'Jobs & WIP',
      },
      {
        id: 'billing',
        label: 'Billing Report',
        icon: ChartLine,
        anyOf: [P.reportFinancial],
        group: 'Billing & cash',
      },
      {
        id: 'payments',
        label: 'Payments Report',
        icon: CreditCard,
        anyOf: [P.reportFinancial],
        group: 'Billing & cash',
      },
      {
        id: 'aged-debtors',
        label: 'Aged Debtors',
        icon: Banknote,
        anyOf: [P.reportFinancial],
        group: 'Billing & cash',
      },
    ],
  ),

  moduleOf(
    'team',
    'Team & Rates',
    UsersRound,
    ORG_SEGMENTS.team,
    [P.memberRead, P.rateRead, P.settingsManage],
    [
      {
        id: 'staff',
        label: 'Staff Members',
        icon: UsersRound,
        anyOf: [P.memberRead],
        group: 'People',
      },
      { id: 'grades', label: 'Grades', icon: Award, anyOf: [P.memberRead], group: 'People' },
      { id: 'cost-rates', label: 'Cost Rates', icon: Coins, anyOf: [P.rateRead], group: 'Rates' },
      {
        id: 'charge-out-rates',
        label: 'Charge-out Rates',
        icon: PoundSterling,
        anyOf: [P.rateRead],
        group: 'Rates',
      },
      {
        id: 'rate-history',
        label: 'Rate History',
        icon: History,
        anyOf: [P.rateRead],
        group: 'Rates',
      },
      {
        id: 'rate-preview',
        label: 'Rate Preview',
        icon: ScanSearch,
        anyOf: [P.rateRead],
        group: 'Rates',
      },
      {
        id: 're-rate',
        label: 'Change Rates on Past Time',
        icon: RefreshCcw,
        anyOf: [P.rateManage],
        group: 'Rates',
      },
      { id: 'services', label: 'Services', icon: Layers, group: 'Catalogue' },
      { id: 'activity-types', label: 'Activity Types', icon: Activity, group: 'Catalogue' },
    ],
  ),

  moduleOf(
    'settings',
    'Settings',
    Settings,
    ORG_SEGMENTS.settings,
    [P.settingsManage, P.organizationUpdate, P.organizationRead, P.roleRead, P.auditLogRead],
    [
      {
        id: 'general',
        label: 'General Settings',
        icon: Settings,
        anyOf: [P.organizationRead],
        group: 'Practice',
      },
      {
        id: 'practice',
        label: 'Practice Settings',
        icon: Landmark,
        anyOf: [P.organizationRead],
        group: 'Practice',
      },
      {
        id: 'roles',
        label: 'Roles & Permissions',
        icon: ShieldCheck,
        anyOf: [P.roleRead],
        group: 'Access control',
      },
      {
        id: 'period-lock',
        label: 'Lock Past Periods',
        icon: Lock,
        anyOf: [P.settingsManage, P.organizationUpdate],
        group: 'Access control',
      },
      { id: 'vat-codes', label: 'VAT Codes', icon: Percent, group: 'Money & tax' },
      {
        id: 'document-numbering',
        label: 'Document Numbering',
        icon: Hash,
        group: 'Money & tax',
      },
      {
        id: 'invoice-templates',
        label: 'Invoice Templates',
        icon: FileText,
        group: 'Billing presentation',
      },
      { id: 'notifications', label: 'Notifications', icon: Bell, group: 'Communication' },
      {
        id: 'email-templates',
        label: 'Email Templates',
        icon: MailPlus,
        anyOf: [P.settingsManage, P.organizationUpdate],
        group: 'Communication',
      },
      {
        id: 'integrations',
        label: 'Integrations',
        icon: Plug,
        anyOf: [P.settingsManage, P.organizationUpdate],
        group: 'Connections',
      },
      {
        id: 'import-export',
        label: 'Import/Export',
        icon: ArrowUpDown,
        segment: 'import-export',
        anyOf: [P.settingsManage, P.organizationUpdate],
        group: 'Data',
      },
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        icon: ScrollText,
        anyOf: [P.auditLogRead],
        group: 'Data',
      },
      {
        id: 'onboarding',
        label: 'Onboarding Checklist',
        icon: ClipboardCheck,
        anyOf: [P.organizationUpdate],
        group: 'Setup',
      },
    ],
  ),
];

/** True when `can` satisfies the rule (an empty rule admits every member). */
export function allows(rule: AccessRule, can: (permission: string) => boolean): boolean {
  return rule.anyOf.length === 0 || rule.anyOf.some((permission) => can(permission));
}

/**
 * Application Testing, the practice's bug and enhancement tracker. It is not one of the ten
 * modules (it is not in `NAV_MODULES`): the top bar offers it from its own bug button and its
 * pages have their own sidebar, so no module is current and there is no secondary bar there.
 */
export interface ApplicationTestingPage {
  id: 'dashboard' | 'tickets';
  label: string;
  icon: LucideIcon;
  /** Path segment below `/:orgSlug/application-testing`. */
  segment: string;
  to: (slug: string) => string;
}

export const APPLICATION_TESTING_LABEL = 'Application Testing';
export const APPLICATION_TESTING_ICON: LucideIcon = Bug;
/** Who sees the menu and may open its pages. */
export const APPLICATION_TESTING_ACCESS: AccessRule = { anyOf: [P.ticketRead] };

const applicationTestingPage = (
  id: ApplicationTestingPage['id'],
  label: string,
  icon: LucideIcon,
): ApplicationTestingPage => ({
  id,
  label,
  icon,
  segment: id,
  to: (slug: string) => modulePath(slug, ORG_SEGMENTS.applicationTesting, id),
});

export const APPLICATION_TESTING_PAGES: ReadonlyArray<ApplicationTestingPage> = [
  applicationTestingPage('dashboard', 'Dashboard', LayoutDashboard),
  applicationTestingPage('tickets', 'All Tickets', Ticket),
];

/** A module as the caller sees it: only the pages they may open, and a target they may open. */
export interface VisibleModule extends NavModule {
  /** The first visible page, or the module's own page when it has none. */
  href: string;
}

/**
 * The modules the caller may open, each with the pages they may open. A module whose every
 * page is hidden is hidden too.
 */
export function visibleModules(
  slug: string,
  can: (permission: string) => boolean,
): VisibleModule[] {
  const result: VisibleModule[] = [];
  for (const module of NAV_MODULES) {
    if (!allows(module, can)) continue;
    const pages = module.pages.filter((page) => allows(page, can) && !page.hidden);
    if (module.pages.length > 0 && pages.length === 0) continue;
    const first = pages[0];
    result.push({ ...module, pages, href: first ? first.to(slug) : module.to(slug) });
  }
  return result;
}

/** The module a path belongs to, from its first segment below `/:orgSlug`. */
export function moduleIdForPath(pathname: string): ModuleId | null {
  const second = pathname.split('/')[2] ?? '';
  return NAV_MODULES.find((module) => module.segment === second)?.id ?? null;
}

export function findModule(id: ModuleId): NavModule {
  const module = NAV_MODULES.find((entry) => entry.id === id);
  if (!module) throw new Error(`Unknown module ${id}`);
  return module;
}

/** The page rule of a module by id, for the route guards. */
export function pageRule(moduleId: ModuleId, pageId: string): AccessRule {
  const page = findModule(moduleId).pages.find((entry) => entry.id === pageId);
  if (!page) throw new Error(`Unknown page ${moduleId}/${pageId}`);
  return page;
}

/** The id of the page of `module` that `pathname` is on, or null (a path no page claims). */
export function activePageId(module: Pick<NavModule, 'pages'>, pathname: string): string | null {
  const rest = pathname.split('/').slice(3).filter(Boolean);
  const [first] = rest;
  const exact = module.pages.find((page) =>
    page.segment === ''
      ? rest.length === 0
      : page.segment === first || (first !== undefined && page.alsoActiveOn?.includes(first)),
  );
  if (exact) return exact.id;
  return rest.length > 0 ? (module.pages.find((page) => page.detail)?.id ?? null) : null;
}
