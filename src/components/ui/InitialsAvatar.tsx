import { cn } from '@/utils/cn';
import { initialsOf } from '@/utils/format';

import { avatarColorIndex } from './avatarColor';

export type InitialsAvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface InitialsAvatarProps {
  /** The full name; also the accessible name and the seed of the colour. */
  name: string;
  /** Explicit initials (a member's `initials`); derived from the name when absent. */
  initials?: string | null;
  size?: InitialsAvatarSize;
  /** Keeps the colour stable across renames (a user or client id). */
  colorKey?: string;
  className?: string;
}

/** Solid hue with white initials (the style guide's avatars), indexed by `avatarColorIndex`. */
const PALETTE = [
  'bg-avatar-1 text-avatar-1-fg',
  'bg-avatar-2 text-avatar-2-fg',
  'bg-avatar-3 text-avatar-3-fg',
  'bg-avatar-4 text-avatar-4-fg',
  'bg-avatar-5 text-avatar-5-fg',
  'bg-avatar-6 text-avatar-6-fg',
  'bg-avatar-7 text-avatar-7-fg',
  'bg-avatar-8 text-avatar-8-fg',
] as const;

/** 22 px (8/600) and 32 px (10/600) are the sizes of the style guide. */
const sizes: Record<InitialsAvatarSize, string> = {
  xs: 'size-[22px] text-[8px]',
  sm: 'size-8 text-[10px]',
  md: 'size-9 text-xs',
  lg: 'size-12 text-sm',
};

/** Initials in a coloured circle: people, clients, the practice. */
export function InitialsAvatar({
  name,
  initials,
  size = 'sm',
  colorKey,
  className,
}: InitialsAvatarProps) {
  const text = (initials?.trim() || initialsOf(name)).slice(0, 3).toUpperCase();
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide select-none',
        PALETTE[avatarColorIndex(colorKey ?? name)],
        sizes[size],
        className,
      )}
    >
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
