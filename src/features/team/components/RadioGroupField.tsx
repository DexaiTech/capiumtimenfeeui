import { useId, type ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface RadioOption<TValue extends string> {
  value: TValue;
  label: string;
  description?: ReactNode;
}

export interface RadioGroupFieldProps<TValue extends string> {
  /** Names the group. */
  legend: string;
  value: TValue;
  onChange: (value: TValue) => void;
  options: ReadonlyArray<RadioOption<TValue>>;
  required?: boolean;
  className?: string;
}

/** A small set of mutually exclusive choices with an explanation each, as real radio buttons. */
export function RadioGroupField<TValue extends string>({
  legend,
  value,
  onChange,
  options,
  required,
  className,
}: RadioGroupFieldProps<TValue>) {
  const name = useId();
  return (
    <fieldset
      className={cn('flex min-w-0 flex-col gap-2', className)}
      aria-required={required ? true : undefined}
    >
      <legend className={cn('mb-1 text-sm font-medium text-text', required && 'field-required')}>
        {legend}
      </legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5',
            'transition-colors duration-fast ease-standard hover:border-border-strong',
            option.value === value ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium text-text">{option.label}</span>
            {option.description ? (
              <span className="text-xs text-text-muted">{option.description}</span>
            ) : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
