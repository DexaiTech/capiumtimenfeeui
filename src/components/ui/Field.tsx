import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import type { FieldIds } from './fieldUtils';

export interface FieldProps {
  ids: FieldIds;
  label: ReactNode;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string;
  /** Rendered at the end of the label row (for example a "Forgot password?" link). */
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label, hint and error around a form control. Shared by Input, Textarea and Select. */
export function Field({
  ids,
  label,
  hideLabel,
  hint,
  error,
  labelAction,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        className={cn(
          'flex items-center justify-between gap-2',
          hideLabel && !labelAction && 'sr-only',
        )}
      >
        <label
          htmlFor={ids.inputId}
          className={cn('text-xs font-medium text-text', hideLabel && 'sr-only')}
        >
          {label}
        </label>
        {labelAction}
      </div>
      {children}
      {hint && !error ? (
        <p id={ids.hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={ids.errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
