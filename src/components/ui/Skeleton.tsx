import { cn } from '@/utils/cn';

export type SkeletonShape = 'text' | 'rect' | 'circle';

export interface SkeletonProps {
  shape?: SkeletonShape;
  /** For `text`: how many lines to draw. The last line is shorter. */
  lines?: number;
  /** Size utilities (width, height) for the block. */
  className?: string;
}

const block =
  'animate-shimmer bg-surface-hover bg-[linear-gradient(90deg,transparent,var(--color-border),transparent)] bg-[length:200%_100%]';

export function Skeleton({ shape = 'text', lines = 1, className }: SkeletonProps) {
  if (shape === 'text') {
    return (
      <span aria-hidden="true" className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: Math.max(1, lines) }, (_, index) => (
          <span
            key={index}
            className={cn(
              block,
              'h-3.5 rounded-sm',
              lines > 1 && index === lines - 1 ? 'w-3/5' : 'w-full',
            )}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(block, 'block', shape === 'circle' ? 'rounded-full' : 'rounded-md', className)}
    />
  );
}
