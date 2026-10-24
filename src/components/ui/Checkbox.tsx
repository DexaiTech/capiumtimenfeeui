import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';

import { cn } from '@/utils/cn';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  label: ReactNode;
  description?: ReactNode;
  error?: string;
  /** Marks the box as mandatory (for example an acceptance): a red star and `aria-required`. */
  required?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Checkbox({
  label,
  description,
  error,
  required,
  id,
  className,
  ref,
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const describedBy = [error ? errorId : null, description ? descriptionId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* The label is the touch target: at least 44 px tall on small screens. */}
      <label
        htmlFor={inputId}
        className="flex min-h-11 cursor-pointer items-center gap-3 md:min-h-8"
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy || undefined}
          className="size-4.5 shrink-0 cursor-pointer rounded-sm accent-primary disabled:cursor-not-allowed"
          {...rest}
        />
        <span className="flex flex-col">
          <span className={cn('text-sm text-text', required && 'field-required')}>{label}</span>
          {description ? (
            <span id={descriptionId} className="text-xs text-text-muted">
              {description}
            </span>
          ) : null}
        </span>
      </label>
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
