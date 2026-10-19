import { motion } from 'motion/react';
import { Outlet, useLocation } from 'react-router';

import { pageTransition } from '@/components/common/motion';
import type { User } from '@/types/models';

import { MobileDrawer } from './MobileDrawer';
import { SearchDialog } from './SearchDialog';
import { ShellContext, type ShellData } from './shellContext';
import { SubNav } from './SubNav';
import { TopBar } from './TopBar';

export interface AppShellProps {
  user: User;
  onLogout: () => void;
  /** Practice, navigation and menus, built by the route layer. Memoise it. */
  shell: ShellData;
}

/**
 * The chrome for signed-in users: the violet top bar with the modules, the white secondary bar
 * with the pages of the current module, and the light content area with the route outlet.
 * Below lg the navigation moves into a drawer.
 */
export function AppShell({ user, onLogout, shell }: AppShellProps) {
  const location = useLocation();
  // Animate once per module (/:slug/<module>), not on every sub-page change.
  const sectionKey = location.pathname.split('/').slice(0, 3).join('/');

  return (
    <ShellContext.Provider value={shell}>
      <div className="flex min-h-dvh flex-col overflow-x-clip bg-bg">
        <a
          href="#main-content"
          className="sr-only z-[80] rounded-md bg-surface-raised px-4 py-2 text-sm font-medium text-text focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <TopBar user={user} onLogout={onLogout} />
        <SubNav />
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
        <MobileDrawer />
        <SearchDialog />
      </div>
    </ShellContext.Provider>
  );
}
