import { Link, Outlet } from 'react-router';

import { LogoMark } from '@/components/common/Logo';
import { routes } from '@/constants/routes';

/** A violet band and the content: the not-found page outside the application. */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="bg-gradient-topbar text-topbar-fg">
        <div className="flex h-16 w-full items-center px-4 md:px-6 2xl:px-8">
          <Link
            to={routes.app}
            className="flex items-center gap-2.5 rounded-full pr-2"
            aria-label="Capium Time & Fees home"
          >
            <LogoMark tone="inverse" />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-bold">Capium Time &amp; Fees</span>
            </span>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
