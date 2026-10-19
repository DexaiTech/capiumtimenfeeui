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

export interface AnchoredPanelProps {
  open: boolean;
  /** Called on Escape and on a press outside the panel and its own nested panels. */
  onClose: () => void;
  /** The element the panel hangs from; focus returns to it on Escape. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Accessible name of the panel. */
  label: string;
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}

const GAP = 6;
const EDGE = 8;

/**
 * A `Popover` for content that opens panels of its own (a form with pickers). The plain popover
 * closes on any press outside its element, and a picker's list is drawn in a portal, so it
 * counts as outside. Here a press inside any other dialog-like panel (`role="dialog"`) does not
 * close this one; a press anywhere else, or Escape, does.
 */
export function AnchoredPanel({
  open,
  onClose,
  anchorRef,
  label,
  align = 'start',
  className,
  children,
}: AnchoredPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      // A panel opened from inside this one (a picker's list) is part of it.
      if (target.closest('[role="dialog"]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, onClose, anchorRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
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
          key="panel"
          ref={panelRef}
          role="dialog"
          aria-label={label}
          variants={popover}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onKeyDown={onKeyDown}
          style={{ top: 0, left: 0, visibility: 'hidden' }}
          className={cn(
            'fixed z-[60] flex max-w-[calc(100vw-1rem)] min-w-56 flex-col overflow-y-auto rounded-xl border border-border bg-surface shadow-card-raised shadow-lg',
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
