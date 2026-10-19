import { Funnel, ListFilter } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

import { Button, Popover } from '@/components/ui';

export interface FilterPopoverProps {
  /** Names the panel, for example "Filter staff". */
  title: string;
  /** How many filters are active; shown on the button. */
  count: number;
  onClear: () => void;
  children: ReactNode;
}

/** The "Filter" outline button of a list toolbar and the panel of filter controls under it. */
export function FilterPopover({ title, count, onClear, children }: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={anchorRef}
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        leftIcon={<Funnel aria-hidden="true" className="size-4" />}
        onClick={() => setOpen((value) => !value)}
      >
        Filter
        {count > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-2xs font-semibold text-brand-fg">
            <span aria-hidden="true">{count}</span>
            <span className="sr-only">, {count} filters applied</span>
          </span>
        ) : null}
      </Button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={title}
        align="end"
        className="w-[min(24rem,calc(100vw-1rem))]"
      >
        <div className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto p-4">{children}</div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <Button
            size="sm"
            onClick={onClear}
            disabled={count === 0}
            leftIcon={<ListFilter aria-hidden="true" className="size-4" />}
          >
            Clear filters
          </Button>
          <Button size="sm" variant="primary" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </Popover>
    </>
  );
}
