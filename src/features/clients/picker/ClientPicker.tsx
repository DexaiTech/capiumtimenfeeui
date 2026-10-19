import { Search, X } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Spinner } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { controlClasses, describedBy, fieldIds } from '@/components/ui/fieldUtils';
import { useDebouncedValue } from '@/hooks';
import { cn } from '@/utils/cn';

import { useClient, useClientLookup } from '../api';
import type { ClientStatus } from '../types';

/** What the picker returns for a chosen client. */
export interface ClientOption {
  id: string;
  name: string;
  code: string;
}

export interface ClientPickerProps {
  label: string;
  hideLabel?: boolean;
  /** The chosen client's id; null: nothing chosen. */
  value: string | null;
  /** Called with the chosen client, or null when the choice is cleared. */
  onChange: (client: ClientOption | null) => void;
  disabled?: boolean;
  /** A validation message, shown under the field. */
  error?: string;
  hint?: ReactNode;
  placeholder?: string;
  /** Only clients with these statuses. Default: every status except archived. */
  statuses?: ReadonlyArray<ClientStatus>;
  /** Shows a clear button next to a chosen client. Default true. */
  clearable?: boolean;
  /**
   * `inline` pushes what follows down; `overlay` floats the list over it. Use `inline` inside a
   * scrolling container (a dialog) that would clip an overlay.
   */
  listPlacement?: 'inline' | 'overlay';
  className?: string;
}

const ANY_STATUS: ReadonlyArray<ClientStatus> = [];

/**
 * A searchable single choice of a client: type a name or a code to search the practice's clients
 * (`GET /clients?q=`), then arrow keys and Enter, or the mouse, to choose; Escape closes the
 * list. It follows the WAI-ARIA combobox pattern (list autocomplete). `value` is a client id; a
 * client the picker did not choose itself is looked up to show its name.
 */
export function ClientPicker({
  label,
  hideLabel,
  value,
  onChange,
  disabled = false,
  error,
  hint,
  placeholder = 'Search by name or code',
  statuses = ANY_STATUS,
  clearable = true,
  listPlacement = 'inline',
  className,
}: ClientPickerProps) {
  const ids = fieldIds(useId());
  const listId = `${ids.inputId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [picked, setPicked] = useState<ClientOption | null>(null);
  const query = useDebouncedValue(text, 250);
  const lookup = useClientLookup(query, statuses, open);

  // The name of a client the caller set without the picker choosing it.
  const known = value !== null && picked?.id === value;
  const fetched = useClient(value !== null && !known ? value : undefined);
  let current: ClientOption | null = null;
  if (value !== null) {
    if (known) current = picked;
    else if (fetched.data) {
      current = { id: fetched.data.id, name: fetched.data.name, code: fetched.data.code };
    }
  }
  const currentLabel = current ? `${current.name} (${current.code})` : '';

  const options: ClientOption[] = (lookup.data ?? []).map((client) => ({
    id: client.id,
    name: client.name,
    code: client.code,
  }));
  const active =
    open && options.length > 0 ? options[Math.min(activeIndex, options.length - 1)] : undefined;
  const optionId = (option: ClientOption) => `${listId}-${option.id}`;

  const close = () => {
    setOpen(false);
    setText('');
    setActiveIndex(0);
  };
  const choose = (option: ClientOption) => {
    setPicked(option);
    onChange(option);
    close();
  };
  const clear = () => {
    setPicked(null);
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
        if (open && active) {
          event.preventDefault();
          choose(active);
        }
        break;
      case 'Escape':
        if (open) {
          // Close the list only: a dialog around the picker stays open.
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          close();
        }
        break;
    }
  };

  const failed = lookup.isError && options.length === 0;
  const searching = lookup.isFetching && options.length === 0;

  return (
    <Field
      ids={ids}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
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
            aria-activedescendant={active ? optionId(active) : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(ids, hint, error)}
            disabled={disabled}
            placeholder={value !== null && !current ? 'Loading the client…' : placeholder}
            value={open ? text : currentLabel}
            onChange={(event) => {
              setText(event.target.value);
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
            {open && lookup.isFetching ? (
              <span className="pr-2.5">
                <Spinner size="sm" />
              </span>
            ) : current && clearable && !disabled ? (
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
            ? options.map((option) => (
                <li
                  key={option.id}
                  id={optionId(option)}
                  role="option"
                  aria-selected={option.id === value}
                  // Keeps the focus in the input, so the blur handler does not close the list first.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  className={cn(
                    'flex min-h-11 cursor-pointer flex-col justify-center rounded-sm px-2.5 py-1.5 md:min-h-9',
                    option.id === active?.id ? 'bg-surface-hover' : 'hover:bg-surface-hover',
                  )}
                >
                  <span className="truncate text-sm text-text">{option.name}</span>
                  <span className="truncate text-xs text-text-muted">{option.code}</span>
                </li>
              ))
            : null}
          {open && options.length === 0 ? (
            <li role="presentation" className="px-2.5 py-2 text-sm text-text-muted">
              {failed ? (
                <span className="flex flex-wrap items-center gap-2">
                  Could not load the clients.
                  <button
                    type="button"
                    className="rounded-sm font-medium text-brand-text underline underline-offset-2"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void lookup.refetch()}
                  >
                    Try again
                  </button>
                </span>
              ) : searching ? (
                'Searching…'
              ) : (
                'No clients found.'
              )}
            </li>
          ) : null}
        </ul>
      </div>
    </Field>
  );
}
