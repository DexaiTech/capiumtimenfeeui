import { AnimatePresence, motion } from 'motion/react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { popover } from '@/components/common/motion';
import { cn } from '@/utils/cn';

export interface PopoverProps {
  open: boolean;
  /** Called on Escape, on a click outside and when the page scrolls the anchor away. */
  onClose: () => void;
  /** The element the panel hangs from; focus returns to it on Escape. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Accessible name of the panel. */
  label: string;
  role?: 'dialog' | 'group';
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}

const GAP = 6;
const EDGE = 8;

/**
 * A panel anchored to an element, rendered in a portal with fixed positioning so that it is
 * never clipped by a scrolling list or a modal. It flips above the anchor when there is more
 * room there, stays inside the viewport, and closes on Escape or an outside press.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  label,
  role = 'dialog',
  align = 'start',
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Positioning writes straight to the element: it follows scrolling without re-rendering.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const rect = anchor.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.scrollHeight;
      const below = window.innerHeight - rect.bottom - GAP - EDGE;
      const above = rect.top - GAP - EDGE;
      const placeAbove = height > below && above > below;
      const maxHeight = Math.max(160, placeAbove ? above : below);
      const shown = Math.min(height, maxHeight);
      const wanted = align === 'end' ? rect.right - width : rect.left;
      const left = Math.max(EDGE, Math.min(wanted, window.innerWidth - width - EDGE));
      const top = placeAbove ? Math.max(EDGE, rect.top - GAP - shown) : rect.bottom + GAP;
      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
      panel.style.maxHeight = `${maxHeight}px`;
      panel.style.visibility = 'visible';
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, onClose, anchorRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      // A popover inside a modal closes alone; the modal stays.
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onClose();
      anchorRef.current?.focus();
    }
  };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="popover"
          ref={panelRef}
          role={role}
          aria-label={label}
          variants={popover}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onKeyDown={onKeyDown}
          style={{ top: 0, left: 0, visibility: 'hidden' }}
          className={cn(
            'fixed z-[60] flex max-w-[calc(100vw-1rem)] min-w-56 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card-raised shadow-lg',
            className,
          )}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
