import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface SegmentOption<TValue extends string = string> {
  value: TValue;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<TValue extends string = string> {
  /** Accessible name of the group, for example "View". */
  label: string;
  options: ReadonlyArray<SegmentOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
  /** Shows only the icons; the labels stay available to assistive technology. */
  iconOnly?: boolean;
  className?: string;
}

/** A small set of mutually exclusive choices drawn as joined toggle buttons. */
export function SegmentedControl<TValue extends string = string>({
  label,
  options,
  value,
  onChange,
  iconOnly = false,
  className,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex min-h-11 max-w-full shrink-0 flex-wrap items-center gap-0.5 rounded-md border border-brand/20 bg-brand-soft p-0.5 md:min-h-10',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-sm px-2.5 text-sm font-medium md:h-9',
              'transition-colors duration-fast ease-standard',
              selected
                ? 'bg-brand text-brand-fg shadow-glow-primary'
                : 'text-brand-text hover:bg-surface/70',
            )}
          >
            {option.icon}
            {iconOnly ? null : option.label}
          </button>
        );
      })}
    </div>
  );
}
