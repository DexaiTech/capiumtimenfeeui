import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { backdrop, sheet } from '@/components/common/motion';
import { cn } from '@/utils/cn';

import { useFocusTrap } from './useFocusTrap';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  className?: string;
  children: ReactNode;
}

function SheetPanel({ onClose, label, className, children }: Omit<SheetProps, 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <motion.div
        variants={backdrop}
        initial="hidden"
        animate="visible"
        exit="hidden"
        aria-hidden="true"
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        variants={sheet}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className={cn(
          'relative flex h-dvh w-full flex-col bg-surface-raised pb-safe shadow-lg',
          className,
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * A full-height modal sheet for small screens (what a popover becomes on a phone). Traps
 * focus, closes on Escape and returns focus to the element that opened it. The content
 * supplies its own header with a close button.
 */
export function Sheet({ open, ...panelProps }: SheetProps) {
  return createPortal(
    <AnimatePresence>{open ? <SheetPanel key="sheet" {...panelProps} /> : null}</AnimatePresence>,
    document.body,
  );
}
