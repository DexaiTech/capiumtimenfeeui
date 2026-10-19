import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Popover } from '@/components/ui';
import { cn } from '@/utils/cn';

export interface MenuAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

export interface ActionMenuProps {
  /** Accessible name of the trigger and the menu. */
  label: string;
  items: ReadonlyArray<MenuAction>;
  /** Content of the trigger button. */
  children: ReactNode;
  triggerClassName?: string;
  align?: 'start' | 'end';
  disabled?: boolean;
}

/**
 * A menu button whose list is drawn in a portal (so a scrolling table never clips it), with the
 * WAI-ARIA menu keys: arrows, Home/End, Escape.
 */
export function ActionMenu({
  label,
  items,
  children,
  triggerClassName,
  align = 'end',
  disabled,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const enabled = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The menu is drawn in a portal, but React events still bubble to the table row; only
    // Escape goes on, to the popover that closes the menu.
    if (event.key !== 'Escape') event.stopPropagation();
    const list = enabled();
    const index = list.findIndex((element) => element === document.activeElement);
    const focusAt = (next: number) => list[(next + list.length) % list.length]?.focus();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusAt(list.length - 1);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        className={triggerClassName}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
          // Focus the first item once the menu is drawn.
          requestAnimationFrame(() => enabled()[0]?.focus());
        }}
        onKeyDown={(event) => {
          // Enter/Space on the trigger must not reach the row's own keyboard handler.
          event.stopPropagation();
        }}
      >
        {children}
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label={label}
        role="group"
        align={align}
        className="capium-clients cc-popover"
      >
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              className={cn('cc-menu-item', item.tone === 'danger' && 'cc-menu-item--danger')}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
