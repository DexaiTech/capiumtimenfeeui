import { ChevronDown, Plus, RefreshCw, Search, Tag } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button, OptionPicker, buttonClasses, type PickerOption } from '@/components/ui';
import { cn } from '@/utils/cn';

import { NEW_TICKET_BUTTON_NAME } from '../../constants';
import type { FilterChanges } from '../../hooks/useTicketFilters';
import type { TicketFilters, TicketTag } from '../../types';
import { isFiltered } from '../../utils/filters';
import { PRIORITY_PICKER_OPTIONS, STATUS_PICKER_OPTIONS, tagPickerOptions } from './options';

interface FilterPickerProps {
  /** What the button says while nothing is chosen ("All Tags", "Priority", "Status"). */
  label: string;
  icon?: ReactNode;
  options: PickerOption[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  loading?: boolean;
  searchable?: boolean;
}

/** A dropdown filter that takes several values: its button names the choice (or how many). */
function FilterPicker({
  label,
  icon,
  options,
  value,
  onChange,
  loading,
  searchable,
}: FilterPickerProps) {
  const chosen = options.filter((option) => value.includes(option.value));
  const text =
    chosen.length === 0
      ? label
      : chosen.length === 1
        ? (chosen[0]?.label ?? label)
        : `${label} · ${String(chosen.length)}`;
  return (
    <OptionPicker
      label={text}
      options={options}
      value={value}
      onChange={onChange}
      multiple
      searchable={searchable}
      searchPlaceholder="Find a tag…"
      loading={loading}
      emptyText="Nothing to choose from"
      triggerClassName={buttonClasses({ variant: chosen.length > 0 ? 'brand-outline' : 'outline' })}
    >
      {icon}
      <span className="max-w-40 truncate">{text}</span>
      <ChevronDown aria-hidden="true" className="size-3.5" />
    </OptionPicker>
  );
}

export interface TicketsToolbarProps {
  filters: TicketFilters;
  search: { text: string; setText: (value: string) => void };
  tags: ReadonlyArray<TicketTag>;
  tagsLoading: boolean;
  onChange: (changes: FilterChanges) => void;
  onClear: () => void;
  /** Absent for a person who may not raise tickets: no primary button. */
  onCreate?: () => void;
}

/**
 * The toolbar card of the ticket list: the primary "Application Testing" button, a wide search
 * (debounced into the URL), the tag, priority and status filters, and "Clear".
 */
export function TicketsToolbar({
  filters,
  search,
  tags,
  tagsLoading,
  onChange,
  onClear,
  onCreate,
}: TicketsToolbarProps) {
  const active = isFiltered(filters) || search.text.trim() !== '';

  return (
    <div
      role="search"
      aria-label="Filter tickets"
      className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-surface p-2"
    >
      {onCreate ? (
        <Button
          variant="primary"
          size="sm"
          aria-haspopup="dialog"
          aria-label={NEW_TICKET_BUTTON_NAME}
          leftIcon={<Plus aria-hidden="true" className="size-4" />}
          onClick={onCreate}
        >
          Application Testing
        </Button>
      ) : null}
      <div className="relative min-w-56 flex-1 basis-72">
        <input
          type="search"
          aria-label="Search tickets"
          placeholder="Search tickets, subject or description..."
          maxLength={200}
          value={search.text}
          onChange={(event) => search.setText(event.target.value)}
          className={cn(
            'h-11 w-full rounded-md border border-brand bg-surface pr-9 pl-3 text-base font-normal text-text md:h-[29px] md:text-xs',
            'transition-[border-color,box-shadow] duration-fast ease-standard hover:border-brand-hover focus-visible:border-brand',
            '[&::-webkit-search-cancel-button]:hidden',
          )}
        />
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-text-muted"
        />
      </div>
      <FilterPicker
        label="All Tags"
        icon={<Tag aria-hidden="true" className="size-3.5" />}
        options={tagPickerOptions(tags)}
        value={filters.tag_id}
        onChange={(value) => onChange({ tag: value })}
        loading={tagsLoading}
        searchable
      />
      <FilterPicker
        label="Priority"
        options={PRIORITY_PICKER_OPTIONS}
        value={filters.priority}
        onChange={(value) => onChange({ priority: value })}
      />
      <FilterPicker
        label="Status"
        options={STATUS_PICKER_OPTIONS}
        value={filters.status}
        onChange={(value) => onChange({ status: value })}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={!active}
        leftIcon={<RefreshCw aria-hidden="true" className="size-3.5" />}
      >
        Clear
      </Button>
    </div>
  );
}
