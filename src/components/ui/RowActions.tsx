import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import type { DropdownActionItem, DropdownItem } from './Dropdown';
import { ROW_ACTION_CLASSES, rowActionColor, rowActionIcon } from './rowActionIcon';

export interface RowActionsProps {
  /** Names the group of actions for assistive technology: "Actions for Acme Ltd". */
  label: string;
  /** The actions of the row. Separators and headings are skipped: every action is a button. */
  items: ReadonlyArray<DropdownItem>;
  /** Shown instead of the buttons while the row is working ("Downloading…"). */
  status?: ReactNode;
  /** `sm` for dense tables with a narrow actions column (the clients grid). */
  size?: 'md' | 'sm';
  /**
   * Fixed places for the actions of a grid, in order, so an action is in the same place on every
   * row. A place is an action id, or several ids of actions that never show together. A place
   * with no action is left empty (nothing to click); actions without a place follow at the end.
   */
  slots?: ReadonlyArray<string | ReadonlyArray<string>>;
  className?: string;
}

function isAction(item: DropdownItem): item is DropdownActionItem {
  return !('separator' in item) && !('heading' in item);
}

/**
 * The tooltip and accessible name of an action. A menu label ends in "…" when it opens a dialog;
 * on an icon button that means nothing, so it is dropped (APT78).
 */
function rowActionName(label: string): string {
  return label.replace(/\s*(…|\.\.\.)$/, '');
}

/** The actions in their places: `null` where a place has no action on this row. */
function placeActions(
  actions: DropdownActionItem[],
  slots: ReadonlyArray<string | ReadonlyArray<string>> | undefined,
): Array<{ key: string; action: DropdownActionItem | null }> {
  if (!slots) return actions.map((action) => ({ key: action.id, action }));
  const placed = new Set<string>();
  const inSlots = slots.map((slot) => {
    const ids: ReadonlyArray<string> = typeof slot === 'string' ? [slot] : slot;
    ids.forEach((id) => placed.add(id));
    return { key: ids.join('|'), action: actions.find((item) => ids.includes(item.id)) ?? null };
  });
  const rest = actions.filter((action) => !placed.has(action.id));
  return [...inSlots, ...rest.map((action) => ({ key: action.id, action }))];
}

/**
 * The actions of a grid row as icon buttons in the row itself, each named by a tooltip and an
 * accessible label, so nothing hides behind a menu. Each icon is coloured by what it does (view blue,
 * edit violet, done green, archive orange, delete red) and tints its button on hover.
 */
export function RowActions({
  label,
  items,
  status,
  size = 'md',
  className,
  slots,
}: RowActionsProps) {
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
        : placeActions(actions, slots).map(({ key, action }) => {
            if (!action) {
              return (
                <span
                  key={key}
                  aria-hidden="true"
                  className={cn('shrink-0', size === 'sm' ? 'size-6' : 'size-7')}
                />
              );
            }
            const Icon = rowActionIcon(action.id, action.label);
            const name = rowActionName(action.label);
            return (
              <button
                key={key}
                type="button"
                title={name}
                aria-label={name}
                disabled={action.disabled}
                onClick={action.onSelect}
                className={cn(
                  'inline-flex shrink-0 items-center justify-center rounded-md',
                  size === 'sm' ? 'size-6' : 'size-7',
                  'transition-colors duration-fast ease-standard disabled:pointer-events-none disabled:opacity-45',
                  ROW_ACTION_CLASSES[
                    action.tone === 'danger' ? 'red' : rowActionColor(action.id, action.label)
                  ],
                  'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                )}
              >
                {action.icon ? (
                  // An icon the action brings is sized here, whatever size it was drawn at.
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-flex items-center justify-center',
                      size === 'sm' ? '[&>svg]:size-3.5' : '[&>svg]:size-4',
                    )}
                  >
                    {action.icon}
                  </span>
                ) : (
                  <Icon aria-hidden="true" className={size === 'sm' ? 'size-3.5' : 'size-4'} />
                )}
              </button>
            );
          })}
    </div>
  );
}
