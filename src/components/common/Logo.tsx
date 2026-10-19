import { cn } from '@/utils/cn';

export interface LogoMarkProps {
  size?: 'sm' | 'md' | 'lg';
  /** `inverse` is the white disc with a violet mark, for the violet top bar. */
  tone?: 'brand' | 'inverse';
  className?: string;
}

const markSizes = { sm: 'size-8', md: 'size-9', lg: 'size-12' } as const;

/** The round Capium mark: a disc with an open "C". */
export function LogoMark({ size = 'md', tone = 'brand', className }: LogoMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        tone === 'brand'
          ? 'bg-gradient-primary text-brand-fg'
          : 'bg-topbar-chip text-topbar-chip-fg',
        markSizes[size],
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[55%]">
        <path
          d="M17.2 7.6a6.4 6.4 0 1 0 0 8.8"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export interface LogoProps {
  size?: 'md' | 'lg';
  className?: string;
}

/** Mark and wordmark, for the sign-in pages and the loader. */
export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-text', className)}>
      <LogoMark size={size === 'lg' ? 'lg' : 'md'} />
      <span className="flex flex-col leading-tight">
        <span className={cn('font-bold tracking-tight', size === 'lg' ? 'text-xl' : 'text-base')}>
          Capium
        </span>
        <span className="eyebrow text-text-muted">Time &amp; Fees</span>
      </span>
    </span>
  );
}
