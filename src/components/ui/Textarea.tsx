import { useId, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

import { Field } from './Field';
import { controlClasses, describedBy, fieldIds } from './fieldUtils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hideLabel?: boolean;
  error?: string;
  hint?: ReactNode;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  hideLabel,
  error,
  hint,
  id,
  rows = 4,
  className,
  ref,
  ...rest
}: TextareaProps) {
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
      <textarea
        ref={ref}
        id={ids.inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error)}
        className={cn(controlClasses, 'min-h-24 resize-y px-3 py-2.5')}
        {...rest}
      />
    </Field>
  );
}
