import { CircleAlert, CircleCheck, NotebookPen } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { Spinner } from '@/components/ui';
import { cn } from '@/utils/cn';

import type { CellState } from '../../utils/autosave';

export type CellMove = 'up' | 'down';

export interface HoursCellProps {
  /** `row:day`, to move between cells with the arrow keys. */
  position: string;
  /** Names the cell for assistive technology: row, day and what it holds. */
  label: string;
  /** The saved value as text ("1:30"), empty when nothing is recorded. */
  value: string;
  state?: CellState;
  editable: boolean;
  /** Minutes in the cell, for the read-only and several-entries displays. */
  minutes: number;
  /** More than one entry in the cell: it opens the day instead of being typed in. */
  entryCount: number;
  /** The cell holds entries whose details can be opened (to see, edit or delete them). */
  hasDetails: boolean;
  /** An entry of the cell has a description or a note. */
  detailed: boolean;
  detailsLabel: string;
  weekend?: boolean;
  onEdit: (text: string) => void;
  onCommit: () => void;
  onRevert: () => void;
  onRetry: () => void;
  onMove: (move: CellMove) => void;
  onOpenDetails: () => void;
  onOpenDay: () => void;
}

function Status({ state }: { state?: CellState }) {
  if (!state) return null;
  if (state.status === 'saving') {
    return (
      <>
        <Spinner size="sm" />
        <span className="sr-only">Saving</span>
      </>
    );
  }
  if (state.status === 'saved') {
    return (
      <>
        <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
        <span className="sr-only">Saved</span>
      </>
    );
  }
  if (state.status === 'error') {
    return (
      <>
        <CircleAlert className="size-3.5 text-danger" aria-hidden="true" />
        <span className="sr-only">Could not be saved</span>
      </>
    );
  }
  return null;
}

/**
 * One day of one row of the week grid: an h:mm field that saves itself, a small status mark
 * (saving, saved, not saved: an icon and a hidden word, never only a colour) and the entry's
 * details. A cell of several entries, or one that may not be edited, is plain text.
 */
export function HoursCell({
  position,
  label,
  value,
  state,
  editable,
  minutes,
  entryCount,
  hasDetails,
  detailed,
  detailsLabel,
  weekend = false,
  onEdit,
  onCommit,
  onRevert,
  onRetry,
  onMove,
  onOpenDetails,
  onOpenDay,
}: HoursCellProps) {
  const text = state?.text ?? value;
  const failed = state?.status === 'error';

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onCommit();
      onMove('down');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onMove('down');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      onMove('up');
    } else if (event.key === 'Escape' && state?.text !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      onRevert();
    }
  };

  const body =
    entryCount > 1 ? (
      <button
        type="button"
        onClick={onOpenDay}
        aria-label={`${label}: ${entryCount} entries, open the day`}
        className="flex h-8 min-w-16 flex-col items-center justify-center rounded-md border border-dashed border-border-strong px-2 text-text tabular-nums hover:bg-surface-hover"
      >
        <span>{value || text}</span>
        <span className="text-2xs text-text-muted">{entryCount} entries</span>
      </button>
    ) : editable ? (
      <div className="relative">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          data-cell={position}
          aria-label={label}
          aria-invalid={failed || undefined}
          aria-describedby={failed ? `${position}-error` : undefined}
          placeholder={weekend ? '' : '–'}
          value={text}
          onChange={(event) => onEdit(event.target.value)}
          onBlur={onCommit}
          onKeyDown={onKeyDown}
          className={cn(
            'h-8 w-[4.5rem] rounded-md border bg-surface pr-6 pl-2 text-right text-xs font-medium text-text tabular-nums',
            'transition-[border-color,box-shadow] duration-fast ease-standard hover:border-border-strong',
            'focus-visible:border-brand',
            failed ? 'border-danger' : 'border-border',
            weekend && 'bg-surface-sunken',
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center">
          <Status state={state} />
        </span>
      </div>
    ) : (
      <span
        aria-label={`${label}: ${value || 'no time'}`}
        className="inline-flex h-8 min-w-[4.5rem] items-center justify-end px-2 text-xs font-medium text-text tabular-nums"
      >
        {minutes > 0 ? value : <span className="text-text-subtle">–</span>}
      </span>
    );

  return (
    <div className="flex items-center justify-end gap-0.5">
      {body}
      {failed ? (
        <>
          <button
            type="button"
            onClick={onRetry}
            className="sr-only focus:not-sr-only focus:rounded-sm focus:border focus:border-danger focus:px-1 focus:text-2xs"
          >
            Try again
          </button>
          <span id={`${position}-error`} role="alert" className="sr-only">
            {state.message}
          </span>
        </>
      ) : null}
      {hasDetails ? (
        <button
          type="button"
          aria-label={detailsLabel}
          title={detailsLabel}
          onClick={onOpenDetails}
          className={cn(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-text-subtle',
            'hover:bg-surface-hover hover:text-text focus-visible:text-text',
            detailed && 'text-brand-text',
          )}
        >
          <NotebookPen className="size-3.5" aria-hidden="true" />
        </button>
      ) : (
        <span className="size-6 shrink-0" aria-hidden="true" />
      )}
    </div>
  );
}
