import { cn } from '@/utils/cn';

import { InitialsAvatar } from './InitialsAvatar';

export interface ClientNameProps {
  name: string;
  /** The client's code, shown under the name. */
  code?: string | null;
  className?: string;
}

/**
 * A client in a grid, as the Clients page draws it: a coloured initials avatar, the name in bold
 * capitals and the client's code under it.
 */
export function ClientName({ name, code, className }: ClientNameProps) {
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <InitialsAvatar name={name} size="sm" />
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="truncate text-xs font-semibold text-text uppercase" title={name}>
          {name}
        </span>
        {code ? <span className="truncate text-2xs text-text-muted">{code}</span> : null}
      </span>
    </span>
  );
}
