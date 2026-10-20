import { ChevronDown } from 'lucide-react';
import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

import { Field } from './Field';
import { controlClasses, describedBy, fieldIds } from './fieldUtils';

export interface SelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<TValue extends string = string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children' | 'multiple' | 'size'
> {
  label: ReactNode;
  options: ReadonlyArray<SelectOption<TValue>>;
  /** Shown as a disabled first option while nothing is selected. */
  placeholder?: string;
  hideLabel?: boolean;
  error?: string;
  hint?: ReactNode;
  /** Extra classes for the select element itself (a tint), not its wrapper. */
  selectClassName?: string;
  ref?: Ref<HTMLSelectElement>;
}

/**
 * A labelled native select. Native keeps the platform picker on touch devices and
 * full keyboard support for free; the searchable and multiple modes arrive with the
 * first feature that needs them.
 */
export function Select<TValue extends string = string>({
  label,
  options,
  placeholder,
  hideLabel,
  error,
  hint,
  id,
  className,
  selectClassName,
  ref,
  ...rest
}: SelectProps<TValue>) {
  const generatedId = useId();
  const ids = fieldIds(id ?? generatedId);

  return (
    <Field
      ids={ids}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      className={className}
    >
      <div className="relative">
        <select
          ref={ref}
          id={ids.inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, hint, error)}
          className={cn(controlClasses, 'h-11 appearance-none pr-10 pl-3 md:h-8', selectClassName)}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-subtle"
        />
      </div>
    </Field>
  );
}
