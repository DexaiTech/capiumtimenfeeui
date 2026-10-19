import { Spinner } from '@/components/ui';

import { Logo } from './Logo';

export interface FullScreenLoaderProps {
  label?: string;
}

/** Shown while the session is being restored on first load, and while a route chunk loads. */
export function FullScreenLoader({ label = 'Loading' }: FullScreenLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg text-text-muted"
    >
      <Logo size="lg" />
      <div className="flex items-center gap-2 text-sm">
        <Spinner size="sm" />
        <span>{label}…</span>
      </div>
    </div>
  );
}
