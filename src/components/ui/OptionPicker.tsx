import { Check, Search } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/utils/cn';

import { Popover } from './Popover';
import { Spinner } from './Spinner';

export interface PickerOption {
  value: string;
  label: string;
  /** A second line, for example an email address. */
  description?: string;
  /** Drawn before the label (an avatar, a colour dot, an icon). */
  icon?: ReactNode;
  disabled?: boolean;
  /** Extra text the search matches. */
  keywords?: string;
}

export interface OptionPickerContext {
  /** The trimmed search text. */
  query: string;
  close: () => void;
}

export interface OptionPickerProps {
  /** Accessible name of the trigger and the list. */
  label: string;
  options: readonly PickerOption[];
  /** Selected values. A single-select picker holds zero or one. */
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** Several values may be chosen; the panel stays open while toggling. */
  multiple?: boolean;
  /**
   * Multiple only: report the selection once, when the panel closes, instead of on every
   * toggle (for selections that are saved with one request).
   */
  commitOnClose?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** For server-side search: called with the text; `options` are then shown unfiltered. */
  onSearchChange?: (query: string) => void;
  loading?: boolean;
  emptyText?: string;
  /** Content of the trigger button. */
  children: ReactNode;
  triggerClassName?: string;
  disabled?: boolean;
  align?: 'start' | 'end';
  /** Extra row under the list, for example "Create label …". */
  footer?: (context: OptionPickerContext) => ReactNode;
  onOpenChange?: (open: boolean) => void;
}

function PickerFooter({
  render,
  query,
  close,
}: OptionPickerContext & { render: (context: OptionPickerContext) => ReactNode }) {
  return <>{render({ query, close })}</>;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/**
 * A button that opens a searchable list of options (the listbox pattern): arrow keys move,
 * Enter chooses, Escape closes and returns focus. Used for status, assignee, label, list
 * and milestone pickers.
 */
export function OptionPicker({
  label,
  options,
  value,
  onChange,
  multiple = false,
  commitOnClose = false,
  searchable = false,
  searchPlaceholder = 'Search…',
  onSearchChange,
  loading = false,
  emptyText = 'Nothing found',
  children,
  triggerClassName,
  disabled = false,
  align = 'start',
  footer,
  onOpenChange,
}: OptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState<string[] | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = draft ?? value;
  const term = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      onSearchChange || !term
        ? options
        : options.filter((option) =>
            `${option.label} ${option.description ?? ''} ${option.keywords ?? ''}`
              .toLowerCase()
              .includes(term),
          ),
    [options, term, onSearchChange],
  );
  const activeIndex = Math.min(active, Math.max(0, visible.length - 1));

  const openPanel = () => {
    setQuery('');
    onSearchChange?.('');
    setActive(0);
    setDraft(multiple && commitOnClose ? [...value] : null);
    setOpen(true);
    onOpenChange?.(true);
  };

  const closePanel = (returnFocus = false) => {
    if (!open) return;
    setOpen(false);
    onOpenChange?.(false);
    if (draft && !sameSet(draft, value)) onChange(draft);
    setDraft(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    (searchable ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const element = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIndex]);

  const choose = (option: PickerOption) => {
    if (option.disabled) return;
    if (!multiple) {
      if (!(value.length === 1 && value[0] === option.value)) onChange([option.value]);
      closePanel(true);
      return;
    }
    const next = selected.includes(option.value)
      ? selected.filter((entry) => entry !== option.value)
      : [...selected, option.value];
    if (draft) setDraft(next);
    else onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive(Math.min(activeIndex + 1, visible.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive(Math.max(activeIndex - 1, 0));
        break;
      case 'Home':
        if (!searchable) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case 'End':
        if (!searchable) {
          event.preventDefault();
          setActive(visible.length - 1);
        }
        break;
      case 'Enter': {
        event.preventDefault();
        const option = visible[activeIndex];
        if (option) choose(option);
        break;
      }
      case ' ': {
        if (searchable) break; // a space belongs to the search text
        event.preventDefault();
        const option = visible[activeIndex];
        if (option) choose(option);
        break;
      }
      case 'Tab':
        closePanel();
        break;
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;
  const activeDescendant = visible.length > 0 ? optionId(activeIndex) : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            openPanel();
          }
        }}
        className={cn(
          'inline-flex max-w-full items-center gap-1.5 rounded-md text-left transition-colors duration-fast ease-standard',
          'enabled:hover:bg-surface-hover disabled:cursor-default',
          triggerClassName,
        )}
      >
        {children}
      </button>
      <Popover
        open={open}
        onClose={() => closePanel()}
        anchorRef={triggerRef}
        label={label}
        align={align}
        className="w-72"
      >
        {searchable ? (
          <div className="relative border-b border-border">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle"
            />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label={searchPlaceholder.replace(/…$/, '')}
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeDescendant}
              aria-autocomplete="list"
              autoComplete="off"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                onSearchChange?.(event.target.value.trim());
              }}
              onKeyDown={onKeyDown}
              className="h-11 w-full bg-transparent pr-9 pl-9 text-base text-text placeholder:text-text-subtle md:h-8 md:text-xs"
            />
            {loading ? (
              <Spinner size="sm" className="absolute top-1/2 right-3 -translate-y-1/2" />
            ) : null}
          </div>
        ) : null}
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          aria-multiselectable={multiple || undefined}
          aria-activedescendant={searchable ? undefined : activeDescendant}
          tabIndex={searchable ? -1 : 0}
          onKeyDown={searchable ? undefined : onKeyDown}
          className="max-h-72 overflow-y-auto p-1.5"
        >
          {visible.length === 0 ? (
            <p className="px-2.5 py-3 text-sm text-text-muted">
              {loading ? 'Loading…' : emptyText}
            </p>
          ) : (
            visible.map((option, index) => {
              const isSelected = selected.includes(option.value);
              return (
                <div
                  key={option.value}
                  id={optionId(index)}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-xs font-medium text-text md:min-h-8',
                    index === activeIndex && 'bg-surface-hover',
                    option.disabled && 'cursor-not-allowed opacity-55',
                  )}
                >
                  {option.icon ? (
                    <span className="flex shrink-0 items-center">{option.icon}</span>
                  ) : null}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description ? (
                      <span className="truncate text-xs text-text-muted">{option.description}</span>
                    ) : null}
                  </span>
                  <Check
                    aria-hidden="true"
                    className={cn('size-4 shrink-0 text-primary-text', !isSelected && 'invisible')}
                  />
                </div>
              );
            })
          )}
        </div>
        {footer ? (
          <div className="border-t border-border p-1.5">
            <PickerFooter render={footer} query={query.trim()} close={() => closePanel(true)} />
          </div>
        ) : null}
      </Popover>
    </>
  );
}
