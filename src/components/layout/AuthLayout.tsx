import { Outlet } from 'react-router';

import { AuroraBackground } from '@/components/common/AuroraBackground';
import { LogoMark } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Card } from '@/components/ui';

/** The sign-in family of pages: a violet band with the brand, and a centred white card. */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AuroraBackground />
      <header className="bg-gradient-topbar text-topbar-fg">
        <div className="flex h-16 w-full items-center justify-between px-4 md:px-6 2xl:px-8">
          <span className="flex items-center gap-2.5">
            <LogoMark tone="inverse" />
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-bold">Capium Time &amp; Fees</span>
            </span>
          </span>
          <ThemeToggle className="text-topbar-fg hover:bg-topbar-hover hover:text-topbar-fg" />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-10 pb-12 sm:items-center sm:pt-0">
        <Card variant="raised" padding="lg" className="w-full max-w-md">
          <Outlet />
        </Card>
      </main>
    </div>
  );
}
