import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { Outlet, useLocation } from 'react-router';

import { pageTransition } from '@/components/common/motion';
import { moduleIdForPath } from '@/constants/navigation';
import { useMediaQuery } from '@/hooks';
import type { User } from '@/types/models';

import { MobileDrawer } from './MobileDrawer';
import { SearchDialog } from './SearchDialog';
import { Sidebar } from './Sidebar';
import { ShellContext, type ShellData } from './shellContext';
import { SubNav } from './SubNav';
import { TopBar } from './TopBar';

/** From this width the sidebar is shown (Tailwind's `lg`). */
export const DESKTOP_QUERY = '(min-width: 64rem)';

export interface AppShellProps {
  user: User;
  onLogout: () => void;
  /** Practice, navigation and menus, built by the route layer. Memoise it. */
  shell: ShellData;
}

/**
 * The chrome for signed-in users. From lg up: the left sidebar with the modules and their pages,
 * and beside it the violet top bar (search, create, bell, account) over the content. Below lg
 * the modules are in the top bar's menu button (a drawer), with the pages of the current module
 * in a row above the content.
 */
export function AppShell({ user, onLogout, shell }: AppShellProps) {
  const location = useLocation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  // Animate once per module (/:slug/<module>), not on every sub-page change.
  const sectionKey = location.pathname.split('/').slice(0, 3).join('/');
  // The colour of the module being used: its menu marker and page titles pick it up.
  const moduleId = moduleIdForPath(location.pathname);
  const accent = (
    moduleId ? { '--module-accent': `var(--color-module-${moduleId})` } : undefined
  ) as CSSProperties | undefined;

  return (
    <ShellContext.Provider value={shell}>
      <div className="flex min-h-dvh overflow-x-clip bg-bg" style={accent}>
        <a
          href="#main-content"
          className="sr-only z-[80] rounded-md bg-surface-raised px-4 py-2 text-sm font-medium text-text focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        {desktop ? <Sidebar /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} onLogout={onLogout} />
          {desktop ? null : <SubNav />}
          <main
            id="main-content"
            tabIndex={-1}
            className="flex min-w-0 flex-1 flex-col px-3 pt-5 pb-6 sm:px-4 sm:pb-8 lg:px-6 2xl:px-8"
          >
            <motion.div
              key={sectionKey}
              variants={pageTransition}
              initial="hidden"
              animate="visible"
              className="flex w-full min-w-0 flex-1 flex-col"
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
        <MobileDrawer />
        <SearchDialog />
      </div>
    </ShellContext.Provider>
  );
}
