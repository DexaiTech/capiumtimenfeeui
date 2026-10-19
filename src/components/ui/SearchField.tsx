import { Search, X } from 'lucide-react';
import type { InputHTMLAttributes, Ref } from 'react';

import { cn } from '@/utils/cn';

export interface SearchFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value' | 'size'
> {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name; the placeholder is not a label. */
  label: string;
  ref?: Ref<HTMLInputElement>;
}

/** The compact quick-search input of a list toolbar, with a clear button. */
export function SearchField({
  value,
  onChange,
  label,
  placeholder = 'Quick search',
  className,
  ref,
  ...rest
}: SearchFieldProps) {
  return (
    <div className={cn('relative w-full sm:w-[241px]', className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-muted"
      />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.stopPropagation();
            onChange('');
          }
        }}
        className={cn(
          'h-11 w-full rounded-md border border-brand bg-surface pr-9 pl-8 text-base font-normal text-text md:h-[29px] md:text-xs',
          'transition-[border-color,box-shadow] duration-fast ease-standard hover:border-brand-hover focus-visible:border-brand',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-text-subtle hover:bg-surface-hover hover:text-text"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
