import { Columns3 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from './Button';
import { Popover } from './Popover';

export interface ColumnVisibilityOption {
  id: string;
  label: string;
  /** Columns that cannot be hidden (the name) are listed but locked. */
  locked?: boolean;
}

export interface ColumnVisibilityMenuProps {
  columns: ReadonlyArray<ColumnVisibilityOption>;
  /** Ids of the hidden columns. */
  hidden: ReadonlySet<string>;
  onChange: (hidden: ReadonlySet<string>) => void;
  label?: string;
}

/** The "Show/Hide Columns" outline button and its checklist. */
export function ColumnVisibilityMenu({
  columns,
  hidden,
  onChange,
  label = 'Show/Hide Columns',
}: ColumnVisibilityMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const toggle = (id: string, visible: boolean) => {
    const next = new Set(hidden);
    if (visible) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <>
      <Button
        ref={anchorRef}
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        leftIcon={<Columns3 aria-hidden="true" className="size-4" />}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label="Visible columns"
        align="end"
        className="w-60 p-2"
      >
        <p className="px-2 pt-1 pb-2 text-xs font-medium text-text-subtle">Visible columns</p>
        <ul className="flex flex-col">
          {columns.map((column) => (
            <li key={column.id}>
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-sm text-text hover:bg-surface-hover">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={!hidden.has(column.id)}
                  disabled={column.locked}
                  onChange={(event) => toggle(column.id, event.target.checked)}
                />
                {column.label}
              </label>
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}
