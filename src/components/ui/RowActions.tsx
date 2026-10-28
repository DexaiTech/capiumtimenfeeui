import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import type { DropdownActionItem, DropdownItem } from './Dropdown';
import { rowActionIcon } from './rowActionIcon';

export interface RowActionsProps {
  /** Names the group of actions for assistive technology: "Actions for Acme Ltd". */
  label: string;
  /** The actions of the row. Separators and headings are skipped: every action is a button. */
  items: ReadonlyArray<DropdownItem>;
  /** Shown instead of the buttons while the row is working ("Downloading…"). */
  status?: ReactNode;
  /** `sm` for dense tables with a narrow actions column (the clients grid). */
  size?: 'md' | 'sm';
  className?: string;
}

function isAction(item: DropdownItem): item is DropdownActionItem {
  return !('separator' in item) && !('heading' in item);
}

/**
 * The actions of a grid row as icon buttons in the row itself, each named by a tooltip and an
 * accessible label, so nothing hides behind a menu. A destructive action turns red on hover.
 */
export function RowActions({ label, items, status, size = 'md', className }: RowActionsProps) {
  const actions = items.filter(isAction);
  if (actions.length === 0 && !status) return null;
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-nowrap items-center justify-end gap-0.5', className)}
    >
      {status ?? null}
      {status
        ? null
        : actions.map((action) => {
            const Icon = rowActionIcon(action.id, action.label);
            return (
              <button
                key={action.id}
                type="button"
                title={action.label}
                aria-label={action.label}
                disabled={action.disabled}
                onClick={action.onSelect}
                className={cn(
                  'inline-flex shrink-0 items-center justify-center rounded-md text-text-muted',
                  size === 'sm' ? 'size-6' : 'size-7',
                  'transition-colors duration-fast ease-standard disabled:pointer-events-none disabled:opacity-45',
                  action.tone === 'danger'
                    ? 'hover:bg-danger-soft hover:text-danger'
                    : 'hover:bg-primary-soft hover:text-primary-text',
                  'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                )}
              >
                {action.icon ?? (
                  <Icon aria-hidden="true" className={size === 'sm' ? 'size-3.5' : 'size-4'} />
                )}
              </button>
            );
          })}
    </div>
  );
}
