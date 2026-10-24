import { Search, X } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Spinner } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { controlClasses, describedBy, fieldIds } from '@/components/ui/fieldUtils';
import { cn } from '@/utils/cn';

import type { PickerItem } from '../../types';

export interface LookupComboboxProps {
  label: string;
  hideLabel?: boolean;
  /** The chosen record; its label is shown while the list is closed. */
  value: PickerItem | null;
  onChange: (item: PickerItem | null) => void;
  /** The matches for the text typed so far; the parent loads them. */
  options: ReadonlyArray<PickerItem>;
  loading?: boolean;
  /** The search failed (shown in place of the matches). */
  failed?: boolean;
  /** Called with the text as it is typed; the parent debounces and searches. */
  onQueryChange: (text: string) => void;
  /** Called when the list opens or closes, so the parent only searches while it is shown. */
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  /** Marks the field as mandatory: a red star on the label and `aria-required` on the input. */
  required?: boolean;
  emptyText?: string;
  disabled?: boolean;
  /** Shows a clear button next to a chosen record. Default true. */
  clearable?: boolean;
  /**
   * `overlay` floats the list over what follows; `inline` pushes it down, for use inside a
   * scrolling container (a dialog) that would clip an overlay.
   */
  listPlacement?: 'overlay' | 'inline';
  className?: string;
}

/**
 * A searchable single-choice field following the WAI-ARIA combobox pattern (list
 * autocomplete): type to search, arrow keys and Enter to choose, Escape to close. It knows
 * nothing about what it lists; `StaffPicker`, `ClientPicker` and `JobPicker` feed it.
 */
export function LookupCombobox({
  label,
  hideLabel,
  value,
  onChange,
  options,
  loading = false,
  failed = false,
  onQueryChange,
  onOpenChange,
  placeholder = 'Search',
  hint,
  error,
  required,
  emptyText = 'Nothing found.',
  disabled = false,
  clearable = true,
  listPlacement = 'inline',
  className,
}: LookupComboboxProps) {
  const ids = fieldIds(useId());
  const listId = `${ids.inputId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpenState] = useState(false);
  const [text, setText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const activeOption = open ? options[Math.min(activeIndex, options.length - 1)] : undefined;
  const optionId = (item: PickerItem) => `${listId}-${item.id}`;

  const close = () => {
    setOpen(false);
    setText('');
    onQueryChange('');
    setActiveIndex(0);
  };

  const choose = (item: PickerItem) => {
    onChange(item);
    close();
  };

  const clear = () => {
    onChange(null);
    close();
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) setOpen(true);
        else setActiveIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Enter':
        if (open && activeOption) {
          event.preventDefault();
          choose(activeOption);
        }
        break;
      case 'Escape':
        if (open) {
          // Close the list only; a surrounding dialog stays open.
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          close();
        }
        break;
    }
  };

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
      <div
        ref={rootRef}
        className="relative"
        onBlur={(event) => {
          if (open && !rootRef.current?.contains(event.relatedTarget)) close();
        }}
      >
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-subtle"
          >
            <Search className="size-4" />
          </span>
          <input
            ref={inputRef}
            id={ids.inputId}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeOption ? optionId(activeOption) : undefined}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            aria-describedby={describedBy(ids, hint, error)}
            disabled={disabled}
            placeholder={value?.label ?? placeholder}
            value={open ? text : (value?.label ?? '')}
            onChange={(event) => {
              setText(event.target.value);
              onQueryChange(event.target.value);
              setActiveIndex(0);
              if (!open) setOpen(true);
            }}
            onClick={() => {
              if (!open) setOpen(true);
            }}
            onKeyDown={onKeyDown}
            className={cn(controlClasses, 'h-11 pr-11 pl-10 md:h-10')}
          />
          <span className="absolute inset-y-0 right-0 flex items-center pr-1">
            {open && loading ? (
              <span className="pr-2.5">
                <Spinner size="sm" />
              </span>
            ) : value && clearable && !disabled ? (
              <button
                type="button"
                aria-label={`Clear ${label.toLowerCase()}`}
                onClick={clear}
                className="inline-flex size-9 items-center justify-center rounded-md text-text-subtle hover:bg-surface-hover hover:text-text"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </span>
        </div>
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={!open}
          className={cn(
            'mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-card-raised',
            listPlacement === 'overlay' && 'absolute top-full right-0 left-0 z-40 shadow-lg',
          )}
        >
          {open
            ? options.map((item) => (
                <li
                  key={item.id}
                  id={optionId(item)}
                  role="option"
                  aria-selected={item.id === value?.id}
                  // Keep focus in the input so the blur handler does not close the list first.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                  className={cn(
                    'flex min-h-11 cursor-pointer flex-col justify-center rounded-sm px-2.5 py-1.5 md:min-h-9',
                    item.id === activeOption?.id ? 'bg-surface-hover' : 'hover:bg-surface-hover',
                  )}
                >
                  <span className="truncate text-sm text-text">{item.label}</span>
                  {item.detail ? (
                    <span className="truncate text-xs text-text-muted">{item.detail}</span>
                  ) : null}
                </li>
              ))
            : null}
          {open && options.length === 0 ? (
            <li role="presentation" className="px-2.5 py-2 text-sm text-text-muted">
              {failed ? 'Could not load the list.' : loading ? 'Searching…' : emptyText}
            </li>
          ) : null}
        </ul>
      </div>
    </Field>
  );
}
