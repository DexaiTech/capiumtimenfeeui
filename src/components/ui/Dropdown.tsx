import { AnimatePresence, motion } from 'motion/react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { popover } from '@/components/common/motion';
import { cn } from '@/utils/cn';

export interface DropdownActionItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

export interface DropdownSeparator {
  id: string;
  separator: true;
}

export interface DropdownHeading {
  id: string;
  heading: string;
}

export type DropdownItem = DropdownActionItem | DropdownSeparator | DropdownHeading;

export interface DropdownProps {
  /** Visual content of the trigger button. */
  trigger: ReactNode;
  /** Accessible name of the trigger button. */
  label: string;
  items: ReadonlyArray<DropdownItem>;
  align?: 'start' | 'end';
  /** Non-interactive content above the items (for example the signed-in user). */
  header?: ReactNode;
  /** Called with the new state whenever the menu opens or closes (and once on mount). */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

function isAction(item: DropdownItem): item is DropdownActionItem {
  return !('separator' in item) && !('heading' in item);
}

function isHeading(item: DropdownItem): item is DropdownHeading {
  return 'heading' in item;
}

/** Menu button following the WAI-ARIA menu pattern: arrow keys, Home/End, Escape, outside click. */
export function Dropdown({
  trigger,
  label,
  items,
  align = 'end',
  header,
  onOpenChange,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  // Where the menu sits (viewport coordinates). It is drawn in the page body, not inside the
  // trigger's parent, so a table or card that clips its overflow cannot cut it off.
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const enabledItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const MARGIN = 8;
    const rect = trigger.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = menu;
    // Below the trigger; above it when there is no room below and enough above.
    let top = rect.bottom + MARGIN;
    if (top + height > window.innerHeight - MARGIN && rect.top - MARGIN - height >= MARGIN) {
      top = rect.top - MARGIN - height;
    }
    const left = align === 'end' ? rect.right - width : rect.left;
    setPosition({
      top: Math.max(MARGIN, top),
      left: Math.min(Math.max(MARGIN, left), window.innerWidth - width - MARGIN),
    });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    enabledItems()[0]?.focus();
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (rootRef.current?.contains(target) || menuRef.current?.contains(target));
    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target)) setOpen(false);
    };
    // The menu is placed from the trigger's position: it would drift if the page moved.
    const onScroll = (event: Event) => {
      if (!inside(event.target)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = enabledItems();
    const index = list.findIndex((element) => element === document.activeElement);
    const focusAt = (next: number) => list[(next + list.length) % list.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(list.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full md:min-h-9 md:min-w-9"
      >
        {trigger}
      </button>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              variants={popover}
              initial="hidden"
              animate="visible"
              onKeyDown={onMenuKeyDown}
              style={{
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                visibility: position ? 'visible' : 'hidden',
              }}
              className={cn(
                'fixed z-50 min-w-56 rounded-xl border border-border bg-surface shadow-card-raised p-1.5 shadow-lg',
                align === 'end' ? 'origin-top-right' : 'origin-top-left',
              )}
            >
              {header ? (
                <div className="border-b border-border px-2.5 pt-1.5 pb-2.5">{header}</div>
              ) : null}
              <div className={header ? 'pt-1.5' : undefined}>
                {items.map((item) =>
                  isAction(item) ? (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      disabled={item.disabled}
                      onClick={() => {
                        close(true);
                        item.onSelect();
                      }}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-xs font-medium md:min-h-8',
                        'transition-colors duration-fast ease-standard hover:bg-surface-hover focus-visible:bg-surface-hover',
                        'disabled:pointer-events-none disabled:opacity-55',
                        item.tone === 'danger' ? 'text-danger' : 'text-text',
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ) : isHeading(item) ? (
                    <div
                      key={item.id}
                      role="presentation"
                      className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-text-subtle uppercase first:pt-1"
                    >
                      {item.heading}
                    </div>
                  ) : (
                    <div key={item.id} role="separator" className="my-1.5 h-px bg-border" />
                  ),
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
