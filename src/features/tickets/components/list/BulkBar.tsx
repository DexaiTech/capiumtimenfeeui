import { ChevronDown, Trash2 } from 'lucide-react';

import { Button, OptionPicker, buttonClasses, type PickerOption } from '@/components/ui';

import type { BulkAction, TicketTag } from '../../types';
import { PRIORITY_PICKER_OPTIONS, STATUS_PICKER_OPTIONS, tagPickerOptions } from './options';

type ChoiceAction = Exclude<BulkAction, 'delete'>;

interface BulkPickerProps {
  label: string;
  options: PickerOption[];
  onChoose: (value: string) => void;
  disabled: boolean;
  searchable?: boolean;
}

/** A button that opens the choices of one bulk action; choosing one runs it. */
function BulkPicker({ label, options, onChoose, disabled, searchable }: BulkPickerProps) {
  return (
    <OptionPicker
      label={label}
      options={options}
      value={[]}
      onChange={([choice]) => {
        if (choice) onChoose(choice);
      }}
      disabled={disabled}
      searchable={searchable}
      searchPlaceholder="Find a tag…"
      emptyText="No tags yet"
      triggerClassName={buttonClasses({ variant: 'outline' })}
    >
      {label}
      <ChevronDown aria-hidden="true" className="size-3.5" />
    </OptionPicker>
  );
}

export interface BulkBarProps {
  count: number;
  tags: ReadonlyArray<TicketTag>;
  canUpdate: boolean;
  canDelete: boolean;
  /** A bulk call is running. */
  busy: boolean;
  onAction: (action: ChoiceAction, value: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Above the table while rows are ticked: how many, and what to do with them (`POST /tickets/bulk`).
 * The buttons a role may not use are not offered.
 */
export function BulkBar({
  count,
  tags,
  canUpdate,
  canDelete,
  busy,
  onAction,
  onDelete,
  onClear,
}: BulkBarProps) {
  const tagOptions = tagPickerOptions(tags);
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2"
    >
      <p aria-live="polite" className="mr-1 text-xs font-semibold text-brand-text">
        {count} selected
      </p>
      {canUpdate ? (
        <>
          <BulkPicker
            label="Set status"
            options={STATUS_PICKER_OPTIONS}
            onChoose={(value) => onAction('set_status', value)}
            disabled={busy}
          />
          <BulkPicker
            label="Set priority"
            options={PRIORITY_PICKER_OPTIONS}
            onChoose={(value) => onAction('set_priority', value)}
            disabled={busy}
          />
          <BulkPicker
            label="Add tag"
            options={tagOptions}
            onChoose={(value) => onAction('add_tag', value)}
            disabled={busy}
            searchable
          />
          <BulkPicker
            label="Remove tag"
            options={tagOptions}
            onChoose={(value) => onAction('remove_tag', value)}
            disabled={busy}
            searchable
          />
        </>
      ) : null}
      {canDelete ? (
        <Button
          size="sm"
          disabled={busy}
          onClick={onDelete}
          leftIcon={<Trash2 aria-hidden="true" className="size-3.5" />}
          className="text-danger! hover:text-danger!"
        >
          Delete
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear selection
      </Button>
    </div>
  );
}
