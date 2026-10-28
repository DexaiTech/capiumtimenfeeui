import { useId, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

import { Field } from './Field';
import { controlClasses, describedBy, fieldIds } from './fieldUtils';
import { suggestPlaceholder } from './placeholders';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hideLabel?: boolean;
  error?: string;
  hint?: ReactNode;
  /** Marks the field as mandatory: a red star on the label and `aria-required` on the box. */
  required?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  hideLabel,
  error,
  hint,
  required,
  id,
  rows = 4,
  className,
  ref,
  placeholder,
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
      required={required}
      className={className}
    >
      <textarea
        ref={ref}
        id={ids.inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(ids, hint, error)}
        className={cn(controlClasses, 'min-h-24 resize-y px-3 py-2.5')}
        placeholder={
          placeholder ??
          (rest.readOnly || rest.disabled ? undefined : suggestPlaceholder(label, 'text', true))
        }
        {...rest}
      />
    </Field>
  );
}
