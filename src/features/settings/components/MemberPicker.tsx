import { Search, X } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { PersonAvatar, Spinner } from '@/components/ui';
import { Field } from '@/components/ui/Field';
import { controlClasses, describedBy, fieldIds } from '@/components/ui/fieldUtils';
import { cn } from '@/utils/cn';

import { flattenPages, useMember, useMembers } from '../api/hooks';
import { useDebouncedValue } from '@/hooks';
import type { Member, MemberStatus } from '../types';

export interface MemberPickerProps {
  label: string;
  /** The selected member's user id. */
  value: string | null;
  onChange: (userId: string | null) => void;
  /** Leaves one person out of the results (a member cannot be their own manager). */
  excludeUserId?: string;
  /** Restricts the search; undefined searches active and suspended members. */
  status?: MemberStatus;
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  disabled?: boolean;
  /**
   * `overlay` floats the results over what follows; `inline` pushes it down, for use
   * inside a scrolling container (a modal) that would clip an overlay.
   */
  listPlacement?: 'overlay' | 'inline';
  className?: string;
}

/**
 * Searchable single-member picker following the WAI-ARIA combobox pattern
 * (list autocomplete): type to search by name or email, arrow keys and Enter to choose.
 */
export function MemberPicker({
  label,
  value,
  onChange,
  excludeUserId,
  status,
  placeholder = 'Search by name or email',
  hint,
  error,
  disabled = false,
  listPlacement = 'overlay',
  className,
}: MemberPickerProps) {
  const ids = fieldIds(useId());
  const listId = `${ids.inputId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  // Remembered so the name shows at once, before the detail request for `value` answers.
  const [picked, setPicked] = useState<Member | null>(null);

  const query = useDebouncedValue(text.trim(), 250);
  const search = useMembers({ q: query || undefined, status }, { enabled: open });
  const selectedQuery = useMember(value && picked?.user_id !== value ? value : null);
  const selected = value
    ? picked?.user_id === value
      ? picked
      : (selectedQuery.data ?? null)
    : null;

  const options = flattenPages(search.data).filter((member) => member.user_id !== excludeUserId);
  const searching = search.isFetching;
  const activeOption = open ? options[Math.min(activeIndex, options.length - 1)] : undefined;
  const optionId = (member: Member) => `${listId}-${member.user_id}`;

  const close = () => {
    setOpen(false);
    setText('');
    setActiveIndex(0);
  };

  const choose = (member: Member) => {
    setPicked(member);
    onChange(member.user_id);
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
        if (open && activeOption) {
          event.preventDefault();
          choose(activeOption);
        }
        break;
      case 'Escape':
        if (open) {
          // Close the list only; a surrounding modal stays open.
          event.preventDefault();
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation();
          close();
        }
        break;
    }
  };

  const display = open ? text : (selected?.full_name ?? (value ? 'Selected person' : ''));

  return (
    <Field ids={ids} label={label} hint={hint} error={error} className={className}>
      <div
        ref={rootRef}
        className="relative"
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget)) close();
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
            aria-describedby={describedBy(ids, hint, error)}
            disabled={disabled}
            placeholder={selected?.full_name ?? placeholder}
            value={display}
            onChange={(event) => {
              setText(event.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(controlClasses, 'h-11 pr-11 pl-10 md:h-10')}
          />
          <span className="absolute inset-y-0 right-0 flex items-center pr-1">
            {open && searching ? (
              <span className="pr-2.5">
                <Spinner size="sm" />
              </span>
            ) : value && !disabled ? (
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
            'mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-border bg-surface shadow-card-raised p-1.5',
            listPlacement === 'overlay' && 'absolute top-full right-0 left-0 z-40 shadow-lg',
          )}
        >
          {open
            ? options.map((member) => {
                const active = member.user_id === activeOption?.user_id;
                return (
                  <li
                    key={member.user_id}
                    id={optionId(member)}
                    role="option"
                    aria-selected={member.user_id === value}
                    // Keep focus in the input so the blur handler does not close the list first.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(member)}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-1.5 md:min-h-9',
                      active ? 'bg-surface-hover' : 'hover:bg-surface-hover',
                    )}
                  >
                    <PersonAvatar
                      userId={member.user_id}
                      pictureVersion={member.avatar_updated_at}
                      name={member.full_name}
                      initials={member.initials}
                      colorKey={member.user_id}
                      size="sm"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-text">{member.full_name}</span>
                      <span className="truncate text-xs text-text-muted">{member.email}</span>
                    </span>
                  </li>
                );
              })
            : null}
          {open && options.length === 0 ? (
            <li role="presentation" className="px-2.5 py-2 text-sm text-text-muted">
              {search.isError
                ? 'Could not load the staff list.'
                : search.isPending || searching
                  ? 'Searching…'
                  : 'No staff found.'}
            </li>
          ) : null}
        </ul>
      </div>
    </Field>
  );
}
