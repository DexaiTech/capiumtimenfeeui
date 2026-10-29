import { Menu, Search } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router';

import { useShellStore } from '@/app/store';
import { LogoMark } from '@/components/common/Logo';
import { Tooltip } from '@/components/ui';
import { moduleIdForPath } from '@/constants/navigation';
import { useMediaQuery } from '@/hooks';
import type { User } from '@/types/models';
import { cn } from '@/utils/cn';

import { DESKTOP_QUERY } from './AppShell';
import { ApplicationTestingMenu } from './ApplicationTestingMenu';
import { HelpMenu, NotificationsMenu } from './HeaderPanels';
import { OverflowNav } from './OverflowNav';
import { PracticeMenu } from './PracticeMenu';
import { QuickCreateMenu } from './QuickCreateMenu';
import { useShell } from './shellContext';
import { UserMenu } from './UserMenu';

export interface TopBarProps {
  user: User;
  onLogout: () => void;
}

/** White circle buttons on the violet bar (search, quick create): 30 px from md up. */
export const chipClasses =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-topbar-chip text-topbar-chip-fg shadow-sm ' +
  'transition-[transform,box-shadow] duration-fast ease-standard hover:shadow-md active:scale-95 md:size-[30px]';

/** Translucent circle buttons on the violet bar (menu, help, notifications). */
export const barIconClasses =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-topbar-hover text-topbar-fg ' +
  'transition-colors duration-fast ease-standard hover:bg-topbar-pill md:size-[30px]';

/**
 * The full-width violet bar (60 px): the practice (logo mark, name),
 * the modules the caller may open, and on the right the Application Testing menu, search, quick
 * create, the practice logo, help, notifications and the user menu. Modules that do not fit fold
 * into "More".
 */
export function TopBar({ user, onLogout }: TopBarProps) {
  const { practice, modules, homeTo } = useShell();
  const setDrawerOpen = useShellStore((state) => state.setDrawerOpen);
  const setSearchOpen = useShellStore((state) => state.setSearchOpen);
  const { pathname } = useLocation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const activeId = moduleIdForPath(pathname);
  const items = useMemo(
    () =>
      modules.map((module) => ({
        id: module.id,
        label: module.label,
        icon: module.icon,
        to: module.href,
      })),
    [modules],
  );

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-topbar bg-topbar text-topbar-fg shadow-md">
      <div className="flex h-15 w-full items-center gap-2 px-2 min-[400px]:gap-3 min-[400px]:px-3 sm:px-4 lg:gap-4 lg:px-6 2xl:px-8">
        {modules.length > 0 ? (
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className={cn(barIconClasses, 'lg:hidden')}
          >
            <Menu aria-hidden="true" className="size-4" />
          </button>
        ) : null}

        {desktop ? (
          // The modules are in the sidebar: the bar starts with the practice and the search.
          <>
            <span className="max-w-56 truncate text-[13px] font-semibold">
              {practice?.name ?? 'Capium'}
            </span>
            {practice ? (
              <button
                type="button"
                aria-label="Search"
                aria-keyshortcuts="/"
                onClick={() => setSearchOpen(true)}
                className="hidden h-8 w-full max-w-sm items-center gap-2 rounded-full bg-topbar-hover px-3 text-xs text-topbar-muted transition-colors duration-fast hover:bg-topbar-pill md:flex"
              >
                <Search aria-hidden="true" className="size-3.5" />
                <span className="flex-1 text-left">Search clients, jobs, invoices…</span>
                <kbd className="rounded-sm bg-topbar-pill px-1.5 font-mono text-2xs text-topbar-fg">
                  /
                </kbd>
              </button>
            ) : null}
          </>
        ) : (
          <Link
            to={homeTo}
            className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-full pr-2"
            aria-label={practice ? `${practice.name} home` : 'Capium Time & Fees home'}
          >
            <LogoMark tone="inverse" />
            <span className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="max-w-44 truncate text-[13px] font-semibold xl:max-w-56">
                {practice?.name ?? 'Capium'}
              </span>
            </span>
          </Link>
        )}

        {items.length > 0 && !desktop ? (
          <OverflowNav
            label="Main"
            items={items}
            activeId={activeId}
            variant="topbar"
            className="hidden flex-1 lg:block"
          />
        ) : null}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          {practice ? (
            <>
              <span className="hidden sm:contents">
                <ApplicationTestingMenu />
              </span>
              <Tooltip content="Search (/ or Ctrl+K)" side="bottom" disabled={desktop}>
                <button
                  type="button"
                  aria-label="Search"
                  aria-keyshortcuts="/"
                  onClick={() => setSearchOpen(true)}
                  className={cn(chipClasses, desktop && 'md:hidden')}
                >
                  <Search aria-hidden="true" className="size-3.5" />
                </button>
              </Tooltip>
              <QuickCreateMenu />
              <span className="hidden sm:inline-flex">
                <PracticeMenu />
              </span>
              <span className="hidden md:inline-flex">
                <HelpMenu />
              </span>
              <NotificationsMenu />
            </>
          ) : null}
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}
