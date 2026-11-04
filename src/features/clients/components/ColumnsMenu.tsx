import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';

import { Popover } from '@/components/ui';
import { useBranchesEnabled, useSegmentsEnabled } from '@/features/settings';

import { TOGGLEABLE_COLUMNS, type ToggleableColumnId } from '../constants';

export interface ColumnsMenuProps {
  hidden: ReadonlySet<ToggleableColumnId>;
  onChange: (column: ToggleableColumnId, hidden: boolean) => void;
  onShowAll: () => void;
}

/** "Show/Hide Columns ⌄": a checklist of the table columns. */
export function ColumnsMenu({ hidden, onChange, onShowAll }: ColumnsMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const segmentsOn = useSegmentsEnabled();
  const branchesOn = useBranchesEnabled();
  const columns = TOGGLEABLE_COLUMNS.filter(
    (column) => (segmentsOn || column.id !== 'segment') && (branchesOn || column.id !== 'branch'),
  );
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="cc-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        style={{ gap: 12 }}
      >
        Show/Hide Columns
        <ChevronDown aria-hidden="true" />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label="Show or hide columns"
        className="capium-clients cc-popover"
      >
        <p className="cc-popover-title">Columns</p>
        <label className="cc-check">
          <input type="checkbox" className="cc-checkbox" checked disabled />
          Client
        </label>
        {columns.map((column) => (
          <label key={column.id} className="cc-check">
            <input
              type="checkbox"
              className="cc-checkbox"
              checked={!hidden.has(column.id)}
              onChange={(event) => onChange(column.id, !event.target.checked)}
            />
            {column.label}
          </label>
        ))}
        <div className="cc-menu-sep" />
        <button
          type="button"
          className="cc-menu-item"
          onClick={onShowAll}
          // Only the columns listed count: Segment and Branch stay hidden while switched off.
          disabled={!columns.some((column) => hidden.has(column.id))}
        >
          Show all columns
        </button>
      </Popover>
    </>
  );
}
