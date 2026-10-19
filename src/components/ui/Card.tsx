import type { HTMLAttributes, ReactNode, Ref } from 'react';

import { cn } from '@/utils/cn';

export type CardVariant = 'flat' | 'raised' | 'gradient';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `flat` (default) is the white rounded card of the content area; `gradient` the sign-in card. */
  variant?: CardVariant;
  padding?: CardPadding;
  /** Adds hover feedback for cards that act as a link or button. */
  interactive?: boolean;
  ref?: Ref<HTMLDivElement>;
}

const variants: Record<CardVariant, string> = {
  flat: 'border border-border bg-surface shadow-card',
  raised: 'border border-border bg-surface-raised shadow-md',
  gradient: 'gradient-border shadow-lg',
};

const paddings: Record<CardPadding, string> = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6 sm:p-8' };

export function Card({
  variant = 'flat',
  padding = 'md',
  interactive = false,
  className,
  ref,
  ...rest
}: CardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl',
        variants[variant],
        paddings[padding],
        interactive &&
          'transition-[border-color,box-shadow] duration-base ease-standard hover:border-border-strong hover:shadow-md',
        className,
      )}
      {...rest}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Title row of a card section: heading, optional description and actions on the right. */
export function CardHeader({ title, description, actions, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-row-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
