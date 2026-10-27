import { cn } from '@/utils/cn';

/**
 * `primary`: the solid violet button, one per screen ("Add Client").
 * `secondary` / `outline`: white with a grey outline (Show/Hide Columns, Filter).
 * `brand-outline`: white with a violet outline and violet text (Import, Export).
 * `ghost`: no chrome. `danger`: destructive confirmation.
 */
export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'brand-outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const base =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap ' +
  'transition-[background-color,border-color,color,box-shadow] duration-fast ease-standard select-none ' +
  'disabled:pointer-events-none disabled:opacity-55';

const outline =
  'border border-border bg-surface text-text-muted hover:border-border-strong hover:bg-surface-hover hover:text-text';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-primary bg-brand font-semibold text-brand-fg shadow-glow-primary ' +
    'hover:brightness-110 active:brightness-95',
  secondary: outline,
  outline,
  'brand-outline':
    'border border-brand bg-surface font-semibold text-brand-text hover:bg-brand-soft',
  ghost: 'text-text-muted hover:bg-surface-hover hover:text-text',
  danger: 'bg-danger-solid font-semibold text-white hover:bg-danger-solid-hover',
};

// 44 px tall below the md breakpoint (touch); from md up the 29 px controls of the style guide.
const sizes: Record<ButtonSize, string> = {
  sm: 'h-11 px-2.5 text-xs md:h-7',
  md: 'h-11 px-3 text-xs md:h-[29px]',
  lg: 'h-12 px-6 text-sm',
  icon: 'size-11 md:size-[29px]',
  'icon-sm': 'size-11 md:size-7',
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** Class names of a Button. Exported for elements that must look like one (router links). */
export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
}: ButtonStyleOptions = {}): string {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full');
}
