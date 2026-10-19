import { Badge } from '@/components/ui';
import { cn } from '@/utils/cn';

import { TAG_TONES } from '../constants';
import type { TagColor } from '../types';

export interface TagChipProps {
  tag: { name: string; color: TagColor | null };
  className?: string;
}

/** A tag as a pill in its colour (the badge tone of the same name); the name is the text. */
export function TagChip({ tag, className }: TagChipProps) {
  return (
    <Badge tone={TAG_TONES[tag.color ?? 'grey']} className={cn('max-w-48', className)}>
      <span className="truncate">{tag.name}</span>
    </Badge>
  );
}
