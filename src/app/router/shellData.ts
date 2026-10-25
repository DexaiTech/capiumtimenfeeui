import {
  Bug,
  Briefcase,
  Clock,
  CreditCard,
  FilePlus2,
  HandCoins,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type {
  QuickCreateItem,
  ShellApplicationTesting,
  ShellData,
  ShellNotifications,
  ShellPractice,
} from '@/components/layout';
import {
  allows,
  APPLICATION_TESTING_ACCESS,
  APPLICATION_TESTING_ICON,
  APPLICATION_TESTING_LABEL,
  APPLICATION_TESTING_PAGES,
  visibleModules,
} from '@/constants/navigation';
import { PERMISSIONS } from '@/constants/permissions';
import { modulePath, ORG_SEGMENTS, routes } from '@/constants/routes';
import { createPermissions } from '@/hooks';
import type { OrganizationContext } from '@/types/organization';

/** The "+" menu: what the caller's permissions let them create or start. */
export function quickCreateItems(
  slug: string,
  can: (permission: string) => boolean,
): QuickCreateItem[] {
  const P = PERMISSIONS;
  const items: QuickCreateItem[] = [];
  const add = (id: string, label: string, icon: LucideIcon, to: string, allowed: boolean) => {
    if (allowed) items.push({ id, label, icon, to });
  };
  add('client', 'New client', Users, `${routes.org.clients(slug)}?new=1`, can(P.clientCreate));
  add('job', 'New job', Briefcase, `${routes.org.jobs(slug)}?new=1`, can(P.jobCreate));
  add('time', 'Log time', Clock, routes.org.timesheet(slug), can(P.timeLog));
  add(
    'expense',
    'New expense',
    HandCoins,
    `${modulePath(slug, ORG_SEGMENTS.expenses, 'mine')}?new=1`,
    can(P.expenseLog),
  );
  add(
    'invoice',
    'Prepare invoice',
    FilePlus2,
    modulePath(slug, ORG_SEGMENTS.billing, 'prepare'),
    can(P.invoiceCreate),
  );
  add(
    'payment',
    'Record payment',
    CreditCard,
    `${modulePath(slug, ORG_SEGMENTS.billing, 'payments')}?new=1`,
    can(P.paymentRecord),
  );
  add(
    'staff',
    'Add staff member',
    UserPlus,
    `${routes.org.staff(slug)}?new=1`,
    can(P.memberInvite),
  );
  add('ticket', 'New ticket', Bug, `${routes.org.tickets(slug)}?new=1`, can(P.ticketCreate));
  return items;
}

/** The Application Testing menu, for a caller who may read tickets; null for everyone else. */
export function applicationTestingMenu(
  slug: string,
  can: (permission: string) => boolean,
): ShellApplicationTesting | null {
  if (!allows(APPLICATION_TESTING_ACCESS, can)) return null;
  return {
    label: APPLICATION_TESTING_LABEL,
    icon: APPLICATION_TESTING_ICON,
    pages: APPLICATION_TESTING_PAGES.map((entry) => ({
      id: entry.id,
      label: entry.label,
      icon: entry.icon,
      to: entry.to(slug),
    })),
    newTicketTo: can(PERMISSIONS.ticketCreate) ? `${routes.org.tickets(slug)}?new=1` : null,
  };
}

/** The chrome's data for one practice context (or none). Pure, for the shell and its tests. */
export function buildShellData(options: {
  context: OrganizationContext | null;
  organizations: ReadonlyArray<OrganizationContext>;
  roleName: (role: OrganizationContext['role']) => string;
  canSwitchPractice: boolean;
  canCreatePractice: boolean;
  /** The bell's data for this practice; the route layer builds it from the notification hooks. */
  notifications?: ShellNotifications | null;
}): ShellData {
  const { context, organizations, roleName } = options;
  const toPractice = (entry: OrganizationContext): ShellPractice => ({
    name: entry.organization.name,
    slug: entry.organization.slug,
    roleName: roleName(entry.role),
  });
  if (!context) {
    return {
      practice: null,
      practices: organizations.map(toPractice),
      canSwitchPractice: options.canSwitchPractice,
      createPracticeTo: options.canCreatePractice ? routes.onboarding : null,
      modules: [],
      practiceSettingsTo: null,
      quickCreate: [],
      accountTo: null,
      homeTo: routes.app,
      notifications: null,
      applicationTesting: null,
    };
  }
  const slug = context.organization.slug;
  const { can } = createPermissions(context);
  const modules = visibleModules(slug, can);
  const practicePage = modules
    .find((module) => module.id === 'settings')
    ?.pages.find((page) => page.id === 'practice');
  return {
    practice: toPractice(context),
    practices: organizations.map(toPractice),
    canSwitchPractice: options.canSwitchPractice,
    createPracticeTo: options.canCreatePractice ? routes.onboarding : null,
    modules,
    practiceSettingsTo: practicePage ? practicePage.to(slug) : null,
    quickCreate: quickCreateItems(slug, can),
    accountTo: routes.org.account(slug),
    homeTo: routes.org.dashboard(slug),
    applicationTesting: applicationTestingMenu(slug, can),
    notifications: options.notifications ?? null,
  };
}
