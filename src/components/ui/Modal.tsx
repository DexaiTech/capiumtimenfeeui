import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { backdrop, modal, sheet } from '@/components/common/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';

import { Button } from './Button';
import { useFocusTrap } from './useFocusTrap';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
  /** Set to false for flows that must not be dismissed by a stray click. Escape still closes. */
  closeOnBackdrop?: boolean;
  /**
   * Set to false for a blocking dialog (a required check-in): no close button, and neither the
   * backdrop nor Escape dismiss it. The content must then offer the way forward itself.
   */
  dismissible?: boolean;
  children?: ReactNode;
}

const sizes: Record<ModalSize, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
};

function ModalPanel({
  onClose,
  title,
  description,
  size = 'md',
  footer,
  closeOnBackdrop = true,
  dismissible = true,
  children,
}: Omit<ModalProps, 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // Bottom sheet below the md breakpoint, centred dialog above: the motion differs, not the tree.
  const isSheet = !useMediaQuery('(min-width: 48rem)');

  useFocusTrap(panelRef, true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (dismissible) onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, dismissible]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <motion.div
        variants={backdrop}
        initial="hidden"
        animate="visible"
        exit="hidden"
        aria-hidden="true"
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
        onClick={closeOnBackdrop && dismissible ? onClose : undefined}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        variants={isSheet ? sheet : modal}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-border bg-surface-raised shadow-lg',
          'md:max-h-[85dvh] md:rounded-xl',
          sizes[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 md:px-6">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-base font-semibold text-text">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-xs text-text-muted">
                {description}
              </p>
            ) : null}
          </div>
          {dismissible ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close dialog"
              onClick={onClose}
              className="-mt-1 -mr-2"
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          ) : null}
        </header>
        {children ? <div className="overflow-y-auto px-5 pb-5 md:px-6">{children}</div> : null}
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-border px-5 pt-4 pb-safe-4 sm:flex-row sm:justify-end md:px-6">
            {footer}
          </footer>
        ) : null}
      </motion.div>
    </div>
  );
}

/**
 * Dialog rendered in a portal. Traps focus, closes on Escape and returns focus to
 * the element that opened it. A bottom sheet on small screens.
 */
export function Modal({ open, ...panelProps }: ModalProps) {
  return createPortal(
    <AnimatePresence>{open ? <ModalPanel key="modal" {...panelProps} /> : null}</AnimatePresence>,
    document.body,
  );
}
