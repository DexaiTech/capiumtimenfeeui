import { createContext, useContext } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { VisibleModule } from '@/constants/navigation';

/** The practice of the current URL, as the chrome draws it. */
export interface ShellPractice {
  name: string;
  slug: string;
  /** The caller's role in it, for the practice menu. */
  roleName: string;
}

/** One entry of the "+" quick-create menu. */
export interface QuickCreateItem {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
}

/** The Application Testing menu: its pages and the shortcut to raise a ticket. */
export interface ShellApplicationTesting {
  label: string;
  icon: LucideIcon;
  /** The pages the caller may open, in the order of the sidebar. */
  pages: ReadonlyArray<{ id: string; label: string; icon: LucideIcon; to: string }>;
  /** Where "New ticket" leads (the list with its create dialog open); null without `ticket.create`. */
  newTicketTo: string | null;
}

/** One notification as the bell draws it. */
export interface ShellNotification {
  id: string;
  /** The notification's type code; the bell picks an icon from it. */
  type: string;
  title: string;
  body: string;
  /** Where it leads, already inside the practice (`/{slug}/…`), or null when it leads nowhere. */
  to: string | null;
  read: boolean;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** The person's notifications and what the bell does with them. The route layer provides it. */
export interface ShellNotifications {
  /** The number on the bell (every unread notification, not only the loaded ones). */
  unreadCount: number;
  items: ReadonlyArray<ShellNotification>;
  /** The list is fetched while the panel is open: loading the first page, or it failed. */
  status: 'loading' | 'error' | 'ready';
  hasMore: boolean;
  loadingMore: boolean;
  markingAllRead: boolean;
  /** The panel opened or closed. */
  onOpenChange: (open: boolean) => void;
  /** The person chose a notification: it is marked read (the bell then navigates). */
  onSelect: (item: ShellNotification) => void;
  onMarkAllRead: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  /** The notification settings page, or null. */
  settingsTo: string | null;
}

/** What the chrome needs to draw itself. The route layer builds it; the chrome only draws it. */
export interface ShellData {
  /** Null outside a practice (or while it is unresolved). */
  practice: ShellPractice | null;
  /** The practices the user can switch to (open deployments). */
  practices: ReadonlyArray<ShellPractice>;
  /** False in a closed deployment: one practice, nothing to switch or create. */
  canSwitchPractice: boolean;
  /** Where "Create practice" leads; null when creating one is not offered. */
  createPracticeTo: string | null;
  /** Every module the caller may open, each with the pages they may open. */
  modules: ReadonlyArray<VisibleModule>;
  /** The practice settings page, or null when the caller may not open it. */
  practiceSettingsTo: string | null;
  quickCreate: ReadonlyArray<QuickCreateItem>;
  /** The account page, or null outside a practice. */
  accountTo: string | null;
  /** Where the logo leads. */
  homeTo: string;
  /** The bell's data; null where there is none (outside a practice, or in tests of the chrome). */
  notifications: ShellNotifications | null;
  /** The Application Testing menu; null outside a practice or without `ticket.read`. */
  applicationTesting: ShellApplicationTesting | null;
}

export const ShellContext = createContext<ShellData | null>(null);

export function useShell(): ShellData {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used inside <AppShell>');
  return value;
}
