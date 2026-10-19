import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';

import { cn } from '@/utils/cn';

import { Field } from './Field';
import { controlClasses, describedBy, fieldIds } from './fieldUtils';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode;
  /** Keeps the label for assistive technology but hides it visually. */
  hideLabel?: boolean;
  error?: string;
  hint?: ReactNode;
  labelAction?: ReactNode;
  leftIcon?: ReactNode;
  /** Interactive content inside the field's trailing edge (for example a show-password toggle). */
  rightSlot?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  label,
  hideLabel,
  error,
  hint,
  labelAction,
  leftIcon,
  rightSlot,
  id,
  className,
  ref,
  'aria-describedby': extraDescribedBy,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const ids = fieldIds(id ?? generatedId);

  return (
    <Field
      ids={ids}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      labelAction={labelAction}
      className={className}
    >
      <div className="relative">
        {leftIcon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-subtle"
          >
            {leftIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={ids.inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [describedBy(ids, hint, error), extraDescribedBy].filter(Boolean).join(' ') || undefined
          }
          className={cn(
            controlClasses,
            'h-11 px-3 md:h-8',
            leftIcon ? 'pl-10' : null,
            rightSlot ? 'pr-12' : null,
          )}
          {...rest}
        />
        {rightSlot ? (
          <span className="absolute inset-y-0 right-0 flex items-center pr-1">{rightSlot}</span>
        ) : null}
      </div>
    </Field>
  );
}
