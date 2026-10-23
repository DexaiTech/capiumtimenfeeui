import { ChevronDown, Trash2 } from 'lucide-react';

import { Button } from './Button';
import { buttonClasses } from './buttonStyles';
import { OptionPicker, type PickerOption } from './OptionPicker';

export interface BulkBarProps {
  /** Rows ticked. */
  count: number;
  /** A bulk call is running: the buttons wait. */
  busy?: boolean;
  /** What to read out to screen readers after a bulk action ("3 jobs updated"). */
  announcement?: string;
  onClear: () => void;
  /**
   * The edits on offer (for example Status, Manager, Due date); choosing one calls `onEdit` with
   * its value. Leave out for a person who may not edit: no Edit menu is drawn.
   */
  editOptions?: ReadonlyArray<PickerOption>;
  onEdit?: (value: string) => void;
  /** Leave out for a person who may not delete: no Delete button is drawn. */
  onDelete?: () => void;
  /** More rows than this cannot go in one call: the actions are disabled and the bar says so. */
  limit?: number;
  /** Name of what is selected, for the accessible name of the region ("jobs"). */
  noun?: string;
}

/**
 * Above a table while its rows are ticked: how many, Clear, an Edit menu and a danger Delete. The
 * buttons a role may not use are not drawn; what each one does (a picker, a confirmation) is the
 * page's. The result of the last action is announced politely.
 */
export function BulkBar({
  count,
  busy = false,
  announcement,
  onClear,
  editOptions,
  onEdit,
  onDelete,
  limit,
  noun = 'rows',
}: BulkBarProps) {
  const tooMany = limit !== undefined && count > limit;
  const wait = busy || tooMany;
  return (
    <div
      role="region"
      aria-label={`Bulk actions for ${noun}`}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2"
    >
      <p aria-live="polite" className="mr-1 text-xs font-semibold text-brand-text">
        {count} selected
      </p>
      {tooMany ? (
        <p className="text-xs text-danger">
          Select at most {limit} {noun} to act on them together.
        </p>
      ) : null}
      <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
        Clear
      </Button>
      {editOptions && editOptions.length > 0 && onEdit ? (
        <OptionPicker
          label="Edit"
          options={editOptions}
          value={[]}
          onChange={([choice]) => {
            if (choice) onEdit(choice);
          }}
          disabled={wait}
          triggerClassName={buttonClasses({ variant: 'outline', size: 'sm' })}
        >
          Edit
          <ChevronDown aria-hidden="true" className="size-3.5" />
        </OptionPicker>
      ) : null}
      {onDelete ? (
        <Button
          variant="danger"
          size="sm"
          disabled={wait}
          leftIcon={<Trash2 aria-hidden="true" className="size-3.5" />}
          onClick={onDelete}
        >
          Delete
        </Button>
      ) : null}
      <p role="status" className="sr-only">
        {announcement ?? ''}
      </p>
    </div>
  );
}
