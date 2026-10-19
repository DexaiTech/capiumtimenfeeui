import { useId, type ReactNode, type Ref } from 'react';

import { cn } from '@/utils/cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  ref,
}: SwitchProps) {
  const id = useId();
  const descriptionId = `${id}-description`;

  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-4', className)}>
      <span className="flex flex-col">
        <span id={id} className="text-sm font-medium text-text">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="text-xs text-text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="group relative inline-flex h-11 w-12 shrink-0 items-center disabled:cursor-not-allowed disabled:opacity-55 md:h-8"
      >
        <span
          className={cn(
            'h-6 w-11 rounded-full border transition-colors duration-base ease-standard',
            checked ? 'border-primary bg-primary' : 'border-border-strong bg-surface-hover',
          )}
        />
        <span
          className={cn(
            'absolute left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-base ease-standard',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
