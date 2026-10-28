import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

/**
 * Semantic tones (neutral … info) and the named pill colours of the Capium design:
 * orange ("Limited"), blue ("Sole Trader"), red ("Overdue"), amber ("Due"), green ("Clear"),
 * violet and grey.
 */
export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'orange'
  | 'blue'
  | 'red'
  | 'amber'
  | 'green'
  | 'violet'
  | 'grey'
  | 'bronze';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: ReactNode;
  /** A small dot before the label, in the text colour. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-badge-grey-soft text-badge-grey',
  grey: 'bg-badge-grey-soft text-badge-grey',
  primary: 'bg-badge-violet-soft text-badge-violet',
  violet: 'bg-badge-violet-soft text-badge-violet',
  success: 'bg-badge-green-soft text-badge-green',
  green: 'bg-badge-green-soft text-badge-green',
  warning: 'bg-badge-amber-soft text-badge-amber',
  amber: 'bg-badge-amber-soft text-badge-amber',
  danger: 'bg-badge-red-soft text-badge-red',
  red: 'bg-badge-red-soft text-badge-red',
  info: 'bg-badge-blue-soft text-badge-blue',
  blue: 'bg-badge-blue-soft text-badge-blue',
  orange: 'bg-badge-orange-soft text-badge-orange',
  bronze: 'bg-badge-bronze-soft text-badge-bronze',
};

const sizes: Record<BadgeSize, string> = {
  // The pill of the Clients grid: 22 px high, 10 px text.
  sm: 'h-[22px] px-[7px] text-2xs',
  md: 'h-[22px] px-2.5 text-2xs',
};

/** A small rounded pill: status, entity type, counts. */
export function Badge({
  tone = 'neutral',
  size = 'md',
  icon,
  dot = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'pill-glow inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        tones[tone],
        sizes[size],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {icon}
      {children}
    </span>
  );
}
