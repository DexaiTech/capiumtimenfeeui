import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

import { cn } from '@/utils/cn';

import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonStyles';
import { Spinner } from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  /**
   * In a narrow `PageToolbar` (< 72rem) only the icon shows; the text stays the accessible name
   * and becomes the tooltip. Use with `leftIcon` and a text label.
   */
  compactLabel?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  compactLabel = false,
  disabled,
  type = 'button',
  title,
  className,
  children,
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      title={title ?? (compactLabel && typeof children === 'string' ? children : undefined)}
      className={cn(
        buttonClasses({ variant, size, fullWidth }),
        compactLabel && '@max-6xl/toolbar:px-1.5',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : leftIcon}
      {compactLabel ? <span className="@max-6xl/toolbar:sr-only">{children}</span> : children}
      {!loading && rightIcon}
    </button>
  );
}
