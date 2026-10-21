import { useQuery } from '@tanstack/react-query';

import { useObjectUrl } from '@/hooks/useObjectUrl';
import { api } from '@/services/api';
import { cn } from '@/utils/cn';

import {
  InitialsAvatar,
  type InitialsAvatarProps,
  type InitialsAvatarSize,
} from './InitialsAvatar';

export interface PersonAvatarProps extends InitialsAvatarProps {
  /** Whose picture it is. */
  userId: string;
  /**
   * When the picture was set (`avatar_updated_at`). Null or absent: the person has none and the
   * initials are shown without asking the API. A new value fetches the new picture.
   */
  pictureVersion?: string | null;
}

const BOX: Record<InitialsAvatarSize, string> = {
  xs: 'size-[22px]',
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-12',
  xl: 'size-24',
};

/**
 * A person's profile picture, or their initials when they have none (or it cannot be loaded).
 * The picture is fetched with the Bearer token and shown from a blob URL, once per version.
 */
export function PersonAvatar({
  userId,
  pictureVersion,
  size = 'sm',
  className,
  ...initials
}: PersonAvatarProps) {
  const picture = useQuery({
    queryKey: ['person-picture', userId, pictureVersion ?? null] as const,
    queryFn: ({ signal }) => api.getBlob(`/users/${encodeURIComponent(userId)}/avatar`, { signal }),
    enabled: Boolean(pictureVersion),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  });
  const url = useObjectUrl(picture.data);

  if (!url) return <InitialsAvatar {...initials} size={size} className={className} />;
  return (
    <span className={cn('inline-flex shrink-0 overflow-hidden rounded-full', BOX[size], className)}>
      <img src={url} alt={initials.name} title={initials.name} className="size-full object-cover" />
    </span>
  );
}
