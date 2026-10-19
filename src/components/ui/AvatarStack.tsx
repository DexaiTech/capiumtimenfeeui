import { cn } from '@/utils/cn';

import { Avatar, type AvatarSize } from './Avatar';

export interface AvatarStackUser {
  /** Stable key; the name is used when absent. */
  id?: string;
  name: string;
  src?: string | null;
}

export interface AvatarStackProps {
  users: readonly AvatarStackUser[];
  /** How many avatars to draw before collapsing the rest into "+N". Default 4. */
  max?: number;
  size?: Extract<AvatarSize, 'sm' | 'md'>;
  /** Accessible name of the group. Defaults to the list of names. */
  label?: string;
  className?: string;
}

const overflowSizes: Record<NonNullable<AvatarStackProps['size']>, string> = {
  sm: 'size-7 text-xs',
  md: 'size-9 text-xs',
};

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}

/** Overlapping avatars of a few people, with a "+N" marker for the ones that do not fit. */
export function AvatarStack({ users, max = 4, size = 'sm', label, className }: AvatarStackProps) {
  if (users.length === 0) return null;
  const limit = Math.max(1, max);
  const shown = users.slice(0, limit);
  const hidden = users.slice(limit);

  return (
    <span
      role="group"
      aria-label={label ?? listNames(users.map((user) => user.name))}
      className={cn('inline-flex items-center', className)}
    >
      {shown.map((user, index) => (
        <span
          key={user.id ?? `${user.name}-${index}`}
          title={user.name}
          className={cn('inline-flex rounded-full ring-2 ring-surface', index > 0 && '-ml-2')}
        >
          <Avatar name={user.name} src={user.src} size={size} />
        </span>
      ))}
      {hidden.length > 0 ? (
        <span
          title={listNames(hidden.map((user) => user.name))}
          className={cn(
            '-ml-2 inline-flex shrink-0 items-center justify-center rounded-full bg-surface-hover font-semibold text-text-muted ring-2 ring-surface',
            overflowSizes[size],
          )}
        >
          <span aria-hidden="true">+{hidden.length}</span>
          <span className="sr-only">and {hidden.length} more</span>
        </span>
      ) : null}
    </span>
  );
}
