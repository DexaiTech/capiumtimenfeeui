import { useState } from 'react';

import { cn } from '@/utils/cn';
import { initialsOf } from '@/utils/format';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

const sizes: Record<AvatarSize, { box: string; pixels: number }> = {
  sm: { box: 'size-7 text-xs', pixels: 28 },
  md: { box: 'size-9 text-sm', pixels: 36 },
  lg: { box: 'size-12 text-base', pixels: 48 },
  xl: { box: 'size-20 text-2xl', pixels: 80 },
};

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  // Remember which source failed, so a new `src` gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { box, pixels } = sizes[size];
  const showImage = Boolean(src) && src !== failedSrc;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-primary-soft font-semibold text-primary-text select-none',
        box,
        className,
      )}
    >
      {showImage && src ? (
        <img
          src={src}
          alt={name}
          width={pixels}
          height={pixels}
          loading="lazy"
          onError={() => setFailedSrc(src)}
          className="size-full object-cover"
        />
      ) : (
        <span role="img" aria-label={name}>
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
