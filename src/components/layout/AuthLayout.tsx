import { Outlet } from 'react-router';

import { LogoMark } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';

/**
 * The sign-in family of pages: a split screen. The left half is the violet brand panel (the
 * logo large, over soft circles); the right half is a pale lavender field with the white form
 * card. Below the lg breakpoint the brand panel becomes a slim band above the form.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside
        className="relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-topbar px-6 py-6 text-topbar-fg lg:min-h-dvh lg:w-[45%] lg:py-0"
        aria-label="Capium Time and Fees"
      >
        {/* Decorative circles: pure shapes, hidden from assistive technology. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 hidden size-72 rounded-full bg-white/10 lg:block"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-24 left-[12%] hidden size-28 rounded-full bg-white/10 lg:block"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -bottom-20 hidden size-80 rounded-full bg-white/10 lg:block"
        />
        <div className="relative flex flex-col items-center gap-2 lg:gap-4">
          <span className="flex items-center gap-3 lg:gap-4">
            <LogoMark tone="inverse" size="lg" className="lg:size-20" />
            <span className="text-3xl font-light tracking-[0.28em] text-white uppercase lg:text-6xl">
              Capium
            </span>
          </span>
          <span className="text-xs font-semibold tracking-[0.42em] text-white/90 uppercase lg:text-sm">
            Time &amp; Fees
          </span>
        </div>
      </aside>
      <main className="relative flex flex-1 items-center justify-center bg-brand-soft/60 px-4 py-10">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="w-full max-w-sm rounded-xl bg-surface p-7 shadow-lg">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
