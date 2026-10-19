import { SlidersHorizontal, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';

import { Button } from './Button';
import { Modal } from './Modal';

export interface FilterChipItem {
  id: string;
  /** "Status: In progress". */
  label: string;
  onRemove: () => void;
}

export interface FilterChipsProps {
  chips: readonly FilterChipItem[];
  onClearAll?: () => void;
  className?: string;
}

/** The active filters as removable chips, with "Clear all". Renders nothing when there are none. */
export function FilterChips({ chips, onClearAll, className }: FilterChipsProps) {
  if (chips.length === 0) return null;
  return (
    <ul
      aria-label="Active filters"
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {chips.map((chip) => (
        <li key={chip.id}>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove filter ${chip.label}`}
            className="inline-flex h-7 max-w-64 items-center gap-1 rounded-full bg-primary-soft pr-1.5 pl-2.5 text-xs font-medium text-primary-text transition-colors duration-fast ease-standard hover:bg-surface-hover"
          >
            <span className="truncate">{chip.label}</span>
            <X aria-hidden="true" className="size-3.5 shrink-0" />
          </button>
        </li>
      ))}
      {onClearAll ? (
        <li>
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex h-7 items-center rounded-full px-2 text-xs font-medium text-text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Clear all
          </button>
        </li>
      ) : null}
    </ul>
  );
}

export interface FilterBarProps {
  /** Always visible: the search field. */
  search?: ReactNode;
  /** The filter controls. Inline from md up; inside a sheet behind a "Filters" button below. */
  children: ReactNode;
  /** Always visible, at the end: sort, view switches, saved views. */
  trailing?: ReactNode;
  /** How many filters are active, shown on the mobile "Filters" button. */
  activeCount?: number;
  onClearAll?: () => void;
  chips?: readonly FilterChipItem[];
  /** Title of the mobile sheet. */
  title?: string;
  className?: string;
}

const DESKTOP_QUERY = '(min-width: 48rem)';

/**
 * The frame of a list's filters: search, controls, trailing actions and the active-filter
 * chips. Below the md breakpoint the controls move into a bottom sheet.
 */
export function FilterBar({
  search,
  children,
  trailing,
  activeCount = 0,
  onClearAll,
  chips = [],
  title = 'Filters',
  className,
}: FilterBarProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div role="search" aria-label={title} className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {search ? <div className="min-w-0 flex-1 basis-56 md:max-w-xs">{search}</div> : null}
        {isDesktop ? null : (
          <Button
            onClick={() => setSheetOpen(true)}
            leftIcon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
            aria-haspopup="dialog"
          >
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </Button>
        )}
        {trailing ? (
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">{trailing}</div>
        ) : null}
      </div>
      {isDesktop ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      <FilterChips chips={chips} onClearAll={onClearAll} />
      {isDesktop ? null : (
        <Modal
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={title}
          footer={
            <>
              {onClearAll ? (
                <Button onClick={onClearAll} disabled={activeCount === 0}>
                  Clear all
                </Button>
              ) : null}
              <Button variant="primary" onClick={() => setSheetOpen(false)}>
                Show results
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 [&>*]:w-full">{children}</div>
        </Modal>
      )}
    </div>
  );
}
